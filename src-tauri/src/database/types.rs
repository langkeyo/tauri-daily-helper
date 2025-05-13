use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct Task {
    pub task: String,
    pub status: String,
    pub remarks: String,
    pub task_id: Option<String>,      // 任务编号
    pub task_name: Option<String>,    // 任务名称
    pub plan_start_time: Option<String>, // 计划开始时间
    pub plan_end_time: Option<String>,   // 计划结束时间
    pub actual_start_time: Option<String>, // 实际开始时间
    pub actual_end_time: Option<String>,   // 实际结束时间
    pub plan_hours: Option<String>,        // 计划工时
    pub actual_hours: Option<String>,      // 实际工时
}

#[derive(Serialize, Deserialize)]
pub struct ReportTemplate {
    pub tasks: Vec<Task>,
    pub next_week_plan: String,
    pub column_indices: HashMap<String, usize>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DailyReport {
    pub id: Option<i64>,
    pub user_id: Option<String>,  // 添加用户ID字段
    pub date: String,
    pub task_id: Option<String>,
    pub task_name: Option<String>,
    pub should_complete: String,
    pub completed: String,
    pub uncompleted: String,
    pub plan_hours: Option<String>,
    pub actual_hours: Option<String>,
    pub remarks: String,
}

#[derive(Serialize, Deserialize)]
pub struct UserInfo {
    pub position: String,
    pub department: String,
    pub name: String,
    pub date: String, // 格式：2024-04
}

// Supabase 配置
pub const SUPABASE_URL: &str = "https://bvhdzrqukpvltlrjgjoe.supabase.co";
pub const SUPABASE_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aGR6cnF1a3B2bHRscmpnam9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDM3MDksImV4cCI6MjA2MjExOTcwOX0.7D5nkvbRdxXltw2aPlRClwteQI2mtFTzHLgaw8HdOTg";

