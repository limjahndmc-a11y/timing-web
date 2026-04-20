use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
#[cfg(target_os = "macos")]
use std::process::Command;

use chrono::{DateTime, Utc};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::{db::Database, models::TrackerStatus};

#[derive(Clone)]
pub struct TrackerHandle {
    running: Arc<AtomicBool>,
    status: Arc<Mutex<TrackerStatus>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
struct ForegroundActivity {
    app: Option<String>,
    title: Option<String>,
    idle: bool,
}

impl TrackerHandle {
    pub fn status(&self) -> TrackerStatus {
        self.status.lock().unwrap().clone()
    }
}

pub fn start_tracker(app: AppHandle, db: Database) -> TrackerHandle {
    let running = Arc::new(AtomicBool::new(true));
    let status = Arc::new(Mutex::new(TrackerStatus {
        state: "running".to_string(),
        detail: None,
    }));

    let running_ref = Arc::clone(&running);
    let status_ref = Arc::clone(&status);
    thread::spawn(move || {
        let mut last_activity = detect_activity().unwrap_or(ForegroundActivity {
            app: Some("Unknown".to_string()),
            title: Some("Unknown".to_string()),
            idle: false,
        });
        let mut last_change: DateTime<Utc> = Utc::now();

        while running_ref.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_secs(10));
            match detect_activity() {
                Ok(current) => {
                    if current != last_activity {
                        let now = Utc::now();
                        let title = if last_activity.idle {
                            "Idle".to_string()
                        } else {
                            last_activity
                                .title
                                .clone()
                                .unwrap_or_else(|| "Foreground activity".to_string())
                        };
                        let _ = db.insert_tracking_entry(
                            title,
                            last_activity.app.clone(),
                            last_activity.title.clone(),
                            last_change,
                            now,
                            last_activity.idle,
                        );
                        last_activity = current.clone();
                        last_change = now;
                        let _ = app.emit("tracker://activity-updated", current);
                    }
                    if let Ok(mut lock) = status_ref.lock() {
                        lock.state = "running".to_string();
                        lock.detail = None;
                    }
                }
                Err(err) => {
                    if let Ok(mut lock) = status_ref.lock() {
                        lock.state = "error".to_string();
                        lock.detail = Some(err);
                    }
                }
            }
        }
    });

    TrackerHandle { running, status }
}

pub fn stop_tracker(handle: &TrackerHandle) {
    handle.running.store(false, Ordering::SeqCst);
}

fn detect_activity() -> Result<ForegroundActivity, String> {
    #[cfg(target_os = "windows")]
    {
        detect_windows_activity()
    }
    #[cfg(target_os = "macos")]
    {
        detect_macos_activity()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(ForegroundActivity {
            app: Some("Unsupported OS".to_string()),
            title: Some("Tracking unavailable".to_string()),
            idle: false,
        })
    }
}

#[cfg(target_os = "macos")]
fn detect_macos_activity() -> Result<ForegroundActivity, String> {
    let app_name = run_osascript(
        r#"tell application "System Events" to get name of first application process whose frontmost is true"#,
    )?;
    let window_title = run_osascript(
        r#"tell application "System Events" to tell (first application process whose frontmost is true) to try
                value of attribute "AXTitle" of front window
              end try"#,
    )
    .unwrap_or_else(|_| String::new());
    let idle = macos_idle_seconds().unwrap_or(0) > 120;
    Ok(ForegroundActivity {
        app: if app_name.is_empty() { None } else { Some(app_name) },
        title: if window_title.is_empty() {
            None
        } else {
            Some(window_title)
        },
        idle,
    })
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Result<String, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(target_os = "macos")]
fn macos_idle_seconds() -> Result<u64, String> {
    let output = Command::new("ioreg")
        .args(["-c", "IOHIDSystem"])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);
    let key = "HIDIdleTime";
    let pos = text.find(key).ok_or_else(|| "HIDIdleTime unavailable".to_string())?;
    let slice = &text[pos..];
    let value: String = slice
        .chars()
        .skip_while(|c| !c.is_ascii_digit())
        .take_while(|c| c.is_ascii_digit())
        .collect();
    let nanos = value.parse::<u64>().map_err(|e| e.to_string())?;
    Ok(nanos / 1_000_000_000)
}

#[cfg(target_os = "windows")]
fn detect_windows_activity() -> Result<ForegroundActivity, String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, HWND};
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    let hwnd: HWND = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Err("No foreground window".to_string());
    }

    let mut pid: u32 = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
    }

    let mut title = None;
    let len = unsafe { GetWindowTextLengthW(hwnd) };
    if len > 0 {
        let mut buffer = vec![0u16; (len + 1) as usize];
        let read = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        if read > 0 {
            title = Some(String::from_utf16_lossy(&buffer[..read as usize]).trim().to_string());
        }
    }

    let mut app = None;
    if pid > 0 {
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) };
        if let Ok(process_handle) = handle {
            let mut exe = [0u16; 260];
            let mut size = exe.len() as u32;
            let query_ok = unsafe {
                windows::Win32::System::Threading::QueryFullProcessImageNameW(
                    process_handle,
                    windows::Win32::System::Threading::PROCESS_NAME_FORMAT(0),
                    PWSTR(exe.as_mut_ptr()),
                    &mut size,
                )
            };
            if query_ok.is_ok() && size > 0 {
                let path = String::from_utf16_lossy(&exe[..size as usize]);
                let name = path
                    .rsplit('\\')
                    .next()
                    .unwrap_or(&path)
                    .trim_end_matches(".exe")
                    .to_string();
                app = Some(name);
            }
            unsafe {
                let _ = CloseHandle(process_handle);
            }
        }
    }

    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    let ok = unsafe { GetLastInputInfo(&mut info) }.as_bool();
    let idle = if ok {
        let now = unsafe { GetTickCount() };
        now.saturating_sub(info.dwTime) > 120_000
    } else {
        false
    };

    Ok(ForegroundActivity { app, title, idle })
}
