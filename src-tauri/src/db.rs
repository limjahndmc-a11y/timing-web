use std::path::PathBuf;

use chrono::{Datelike, Duration, TimeZone, Utc};
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::models::{
    BootstrapData, Category, DashboardStats, DeleteProjectInput, NewEntryInput, NewProjectInput,
    Project, TimeEntry, TrackerStatus, TrendPoint, UpdateEntryInput, UpdateProjectInput,
};

#[derive(Clone)]
pub struct Database {
    pub path: PathBuf,
}

impl Database {
    pub fn new(path: PathBuf) -> Result<Self, String> {
        let db = Self { path };
        db.init()?;
        Ok(db)
    }

    fn connection(&self) -> Result<Connection, String> {
        Connection::open(&self.path).map_err(|e| e.to_string())
    }

    fn init(&self) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS categories(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                icon TEXT
            );
            CREATE TABLE IF NOT EXISTS projects(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category_id TEXT NOT NULL,
                color TEXT NOT NULL,
                hourly_rate REAL NOT NULL DEFAULT 0,
                FOREIGN KEY(category_id) REFERENCES categories(id)
            );
            CREATE TABLE IF NOT EXISTS time_entries(
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                project_id TEXT NOT NULL,
                app TEXT,
                window_title TEXT,
                start_utc TEXT NOT NULL,
                end_utc TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                source TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );
            CREATE INDEX IF NOT EXISTS idx_time_entries_start ON time_entries(start_utc);
            CREATE TABLE IF NOT EXISTS activity_segments(
                id TEXT PRIMARY KEY,
                app TEXT,
                window_title TEXT,
                started_at_utc TEXT NOT NULL,
                ended_at_utc TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                is_idle INTEGER NOT NULL DEFAULT 0
            );
            ",
        )
        .map_err(|e| e.to_string())?;
        self.seed_defaults(&conn)
    }

    fn seed_defaults(&self, conn: &Connection) -> Result<(), String> {
        let existing: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if existing > 0 {
            return Ok(());
        }

        conn.execute(
            "INSERT INTO categories(id,name,color,icon) VALUES (?1,?2,?3,?4)",
            params!["c1", "Work", "#3B82F6", "briefcase"],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO categories(id,name,color,icon) VALUES (?1,?2,?3,?4)",
            params!["c2", "Communication", "#8B5CF6", "message"],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO categories(id,name,color,icon) VALUES (?1,?2,?3,?4)",
            params!["c3", "Browsing", "#F59E0B", "globe"],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO categories(id,name,color,icon) VALUES (?1,?2,?3,?4)",
            params!["c4", "Personal", "#10B981", "user"],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO projects(id,name,category_id,color,hourly_rate) VALUES (?1,?2,?3,?4,?5)",
            params!["p1", "General Tracking", "c1", "#2563EB", 100.0_f64],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO projects(id,name,category_id,color,hourly_rate) VALUES (?1,?2,?3,?4,?5)",
            params!["p2", "Communication", "c2", "#8B5CF6", 0.0_f64],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO projects(id,name,category_id,color,hourly_rate) VALUES (?1,?2,?3,?4,?5)",
            params!["p3", "Break", "c4", "#10B981", 0.0_f64],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn bootstrap(&self, tracker_status: TrackerStatus) -> Result<BootstrapData, String> {
        Ok(BootstrapData {
            categories: self.list_categories()?,
            projects: self.list_projects()?,
            entries: self.list_entries()?,
            tracker_status,
        })
    }

    pub fn list_categories(&self) -> Result<Vec<Category>, String> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare("SELECT id,name,color,icon FROM categories ORDER BY name")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    icon: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn list_projects(&self) -> Result<Vec<Project>, String> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare("SELECT id,name,category_id,color,hourly_rate FROM projects ORDER BY name")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    category_id: row.get(2)?,
                    color: row.get(3)?,
                    hourly_rate: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn list_entries(&self) -> Result<Vec<TimeEntry>, String> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id,title,project_id,app,window_title,start_utc,end_utc,duration_seconds,source
                 FROM time_entries ORDER BY start_utc DESC LIMIT 2000",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(TimeEntry {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    project_id: row.get(2)?,
                    app: row.get(3)?,
                    window_title: row.get(4)?,
                    start: row.get(5)?,
                    end: row.get(6)?,
                    duration_seconds: row.get(7)?,
                    source: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn create_project(&self, input: NewProjectInput) -> Result<Project, String> {
        let conn = self.connection()?;
        let id = format!("p{}", Uuid::new_v4().simple());
        conn.execute(
            "INSERT INTO projects(id,name,category_id,color,hourly_rate) VALUES(?1,?2,?3,?4,?5)",
            params![id, input.name, input.category_id, input.color, input.hourly_rate],
        )
        .map_err(|e| e.to_string())?;
        Ok(Project {
            id,
            name: input.name,
            category_id: input.category_id,
            color: input.color,
            hourly_rate: input.hourly_rate,
        })
    }

    pub fn update_project(&self, input: UpdateProjectInput) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE projects SET name=?1,category_id=?2,color=?3,hourly_rate=?4 WHERE id=?5",
            params![input.name, input.category_id, input.color, input.hourly_rate, input.id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_project(&self, input: DeleteProjectInput) -> Result<(), String> {
        let conn = self.connection()?;
        // Delete associated time entries first to avoid orphaned records
        conn.execute(
            "DELETE FROM time_entries WHERE project_id = ?1",
            params![input.id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM projects WHERE id = ?1",
            params![input.id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn create_entry(&self, input: NewEntryInput) -> Result<TimeEntry, String> {
        let start = chrono::DateTime::parse_from_rfc3339(&input.start).map_err(|e| e.to_string())?;
        let end = chrono::DateTime::parse_from_rfc3339(&input.end).map_err(|e| e.to_string())?;
        let duration_seconds = end.signed_duration_since(start).num_seconds().max(0);
        let id = format!("e{}", Uuid::new_v4().simple());

        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO time_entries(id,title,project_id,app,window_title,start_utc,end_utc,duration_seconds,source)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                id,
                input.title,
                input.project_id,
                Option::<String>::None,
                Option::<String>::None,
                input.start,
                input.end,
                duration_seconds,
                "manual"
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(TimeEntry {
            id,
            title: input.title,
            project_id: input.project_id,
            app: None,
            window_title: None,
            start: input.start,
            end: input.end,
            duration_seconds,
            source: "manual".to_string(),
        })
    }

    pub fn update_entry(&self, input: UpdateEntryInput) -> Result<(), String> {
        let start = chrono::DateTime::parse_from_rfc3339(&input.start).map_err(|e| e.to_string())?;
        let end = chrono::DateTime::parse_from_rfc3339(&input.end).map_err(|e| e.to_string())?;
        let duration_seconds = end.signed_duration_since(start).num_seconds().max(0);
        let conn = self.connection()?;
        conn.execute(
            "UPDATE time_entries
             SET title=?1, project_id=?2, start_utc=?3, end_utc=?4, duration_seconds=?5
             WHERE id=?6",
            params![
                input.title,
                input.project_id,
                input.start,
                input.end,
                duration_seconds,
                input.id
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn insert_tracking_entry(
        &self,
        title: String,
        app: Option<String>,
        window_title: Option<String>,
        start: chrono::DateTime<Utc>,
        end: chrono::DateTime<Utc>,
        is_idle: bool,
    ) -> Result<(), String> {
        let duration = end.signed_duration_since(start).num_seconds();
        if duration < 5 {
            return Ok(());
        }
        let project_id = if is_idle { "p3" } else { "p1" };
        let source = if is_idle { "auto_idle" } else { "auto_activity" };
        let entry_id = format!("e{}", Uuid::new_v4().simple());
        let segment_id = format!("s{}", Uuid::new_v4().simple());
        let start_utc = start.to_rfc3339();
        let end_utc = end.to_rfc3339();

        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO activity_segments(id,app,window_title,started_at_utc,ended_at_utc,duration_seconds,is_idle)
             VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![
                segment_id,
                app,
                window_title,
                start_utc,
                end_utc,
                duration,
                if is_idle { 1 } else { 0 }
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO time_entries(id,title,project_id,app,window_title,start_utc,end_utc,duration_seconds,source)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![entry_id, title, project_id, app, window_title, start_utc, end_utc, duration, source],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn dashboard_stats(&self) -> Result<DashboardStats, String> {
        let conn = self.connection()?;
        let total_seconds: i64 = conn
            .query_row("SELECT COALESCE(SUM(duration_seconds),0) FROM time_entries", [], |r| {
                r.get(0)
            })
            .map_err(|e| e.to_string())?;
        let total_earnings: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM((te.duration_seconds / 3600.0) * p.hourly_rate),0)
                 FROM time_entries te
                 JOIN projects p ON p.id = te.project_id",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        let focus_seconds: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_seconds),0) FROM time_entries WHERE source='auto_activity'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        let distractions: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM time_entries WHERE source='auto_idle' AND duration_seconds >= 60",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        let productivity_score = if total_seconds == 0 {
            0
        } else {
            ((focus_seconds as f64 / total_seconds as f64) * 100.0).round() as i64
        };
        Ok(DashboardStats {
            total_seconds,
            total_earnings,
            productivity_score,
            focus_seconds,
            distractions,
        })
    }

    pub fn trend_7_days(&self) -> Result<Vec<TrendPoint>, String> {
        let conn = self.connection()?;
        let now = Utc::now().date_naive();
        let mut points = Vec::new();
        for i in (0..7).rev() {
            let day = now - Duration::days(i);
            let day_start = Utc
                .with_ymd_and_hms(day.year(), day.month(), day.day(), 0, 0, 0)
                .single()
                .ok_or_else(|| "invalid day".to_string())?;
            let day_end = day_start + Duration::days(1);
            let secs: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(duration_seconds),0) FROM time_entries WHERE start_utc >= ?1 AND start_utc < ?2",
                    params![day_start.to_rfc3339(), day_end.to_rfc3339()],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            points.push(TrendPoint {
                date: day.format("%b %d").to_string(),
                hours: (secs as f64 / 3600.0 * 100.0).round() / 100.0,
            });
        }
        Ok(points)
    }
}
