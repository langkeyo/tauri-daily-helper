// Supabase module
mod supabase_impl;

// Re-export with #[tauri::command] preservation
pub use supabase_impl::save_daily_to_supabase;
pub use supabase_impl::ensure_user_id_column_exists;

// 初始化函数，确保数据库结构正确
pub async fn init_supabase() -> Result<(), String> {
    // 尝试确保user_id列存在
    match ensure_user_id_column_exists().await {
        Ok(_) => {
            eprintln!("Supabase初始化成功");
            Ok(())
        },
        Err(e) => {
            eprintln!("Supabase初始化警告: {}", e);
            // 这里我们返回Ok而不是Err，这样即使初始化失败也不会中断应用启动
            // 用户可能需要手动修复数据库结构
            Ok(())
        }
    }
}

// 添加一个新的命令，专门用于添加user_id列
#[tauri::command]
pub async fn add_user_id_column() -> Result<String, String> {
    match ensure_user_id_column_exists().await {
        Ok(_) => Ok("成功添加或确认user_id列存在".to_string()),
        Err(e) => Err(format!("添加user_id列失败: {}", e))
    }
}

#[tauri::command]
pub async fn save_daily_report(report: crate::database::types::DailyReport) -> Result<String, String> {
    supabase_impl::save_daily_report(report).await
}

#[tauri::command]
pub async fn get_recent_daily_reports() -> Result<Vec<crate::database::types::DailyReport>, String> {
    supabase_impl::get_recent_daily_reports().await
}

#[tauri::command]
pub async fn get_recent_daily_reports_by_user(user_id: String) -> Result<Vec<crate::database::types::DailyReport>, String> {
    supabase_impl::get_recent_daily_reports_by_user(user_id).await
}

#[tauri::command]
pub async fn get_daily_report_by_date(date: String, user_id: Option<String>) -> Result<crate::database::types::DailyReport, String> {
    supabase_impl::get_daily_report_by_date(date, user_id).await
}

#[tauri::command]
pub async fn test_supabase_connection() -> Result<String, String> {
    supabase_impl::test_supabase_connection().await
}

pub async fn get_dailies_from_supabase(user_id: Option<String>) -> Result<Vec<crate::database::types::DailyReport>, String> {
    supabase_impl::get_dailies_from_supabase(user_id).await
} 
