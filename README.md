<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Timing Desktop (Tauri 2 + Rust)

This app now runs as a desktop tracker powered by Tauri 2 and Rust.
Mock activity generation was removed in favor of real foreground activity collection.

## Run Locally

**Prerequisites:** Node.js and Rust toolchain (for Tauri builds)


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the web UI only:
   `npm run dev`
4. Run the full desktop app:
   `npm run tauri:dev`

## Build Desktop App

`npm run tauri:build`

## Notes

- Tracking data is persisted locally in a SQLite database managed by the Rust backend.
- On macOS, enable Accessibility permissions for reliable active-window titles.
