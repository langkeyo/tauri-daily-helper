// Database module - entry point
mod types;
pub mod sqlite;
pub mod report;
pub mod supabase;
pub mod excel;
pub mod file_utils;
pub mod git_utils;

// Re-export types
pub use types::*;

// Re-export main functionality
pub use sqlite::init_db;
pub use sqlite::{save_daily_report_to_sqlite, fix_field_mapping};
pub use report::{auto_generate_weekly, render_daily_with_template, save_template, read_template, start_weekly_timer};
pub use supabase::{
    save_daily_report, 
    get_recent_daily_reports, 
    get_recent_daily_reports_by_user,
    get_daily_report_by_date, 
    test_supabase_connection,
    save_daily_to_supabase,
    get_dailies_from_supabase,
    init_supabase
};
pub use excel::{parse_excel_template, generate_excel_report, save_report_template, load_report_template,
               import_excel_tasks, generate_weekly_from_daily, export_with_template, generate_monthly_report};
pub use file_utils::{read_text_file, select_file, select_save_path};
pub use git_utils::{get_git_changes, get_git_last_commit};

// Tauri commands re-exports
#[tauri::command]
pub async fn save_daily(
    date: String,
    content: String,
    should: String,
    done: String,
    undone: String,
    user_id: Option<String>
) -> Result<String, String> {
    let report = DailyReport {
        id: None,
        user_id,
        date,
        task_id: None,
        task_name: None,
        should_complete: should,
        completed: done,
        uncompleted: undone,
        plan_hours: None,
        actual_hours: None,
        remarks: content,
    };
    
    // 先保存到本地SQLite，确保数据不会丢失
    let local_result = match sqlite::save_daily_report_to_sqlite(&report) {
        Ok(_) => "本地保存成功".to_string(),
        Err(e) => {
            eprintln!("保存到SQLite失败: {}", e);
            format!("本地保存失败: {}", e)
        }
    };
    
    // 然后尝试保存到Supabase，无论结果如何都返回消息而不是错误
    let remote_result = match supabase::save_daily_to_supabase(&report).await {
        Ok(_) => "远程保存成功".to_string(),
        Err(e) => {
            eprintln!("保存到Supabase时出错: {}", e);
            format!("远程保存失败: {}", e)
        }
    };
    
    // 返回完整的状态信息，而不是错误
    Ok(format!("{}，{}", local_result, remote_result))
} 