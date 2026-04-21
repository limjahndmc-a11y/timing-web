use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub category_id: String,
    pub color: String,
    pub hourly_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEntry {
    pub id: String,
    pub title: String,
    pub project_id: String,
    pub app: Option<String>,
    pub window_title: Option<String>,
    pub start: String,
    pub end: String,
    pub duration_seconds: i64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerStatus {
    pub state: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_seconds: i64,
    pub total_earnings: f64,
    pub productivity_score: i64,
    pub focus_seconds: i64,
    pub distractions: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendPoint {
    pub date: String,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapData {
    pub categories: Vec<Category>,
    pub projects: Vec<Project>,
    pub entries: Vec<TimeEntry>,
    pub tracker_status: TrackerStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEntryInput {
    pub title: String,
    pub project_id: String,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEntryInput {
    pub id: String,
    pub title: String,
    pub project_id: String,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewProjectInput {
    pub name: String,
    pub category_id: String,
    pub color: String,
    pub hourly_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProjectInput {
    pub id: String,
    pub name: String,
    pub category_id: String,
    pub color: String,
    pub hourly_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteProjectInput {
    pub id: String,
}
