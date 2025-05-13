// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// 临时注释掉这一行以在Windows上显示控制台窗口
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
use database::*;

// 添加日志记录的初始化
fn setup_logging() {
    eprintln!("=== 应用启动，日志记录开始 ===");
}

// 添加一个记录日志的命令
#[tauri::command]
fn log_message(level: &str, message: &str) {
    match level {
        "info" => eprintln!("[INFO] {}", message),
        "warn" => eprintln!("[WARN] {}", message),
        "error" => eprintln!("[ERROR] {}", message),
        "debug" => eprintln!("[DEBUG] {}", message),
        _ => eprintln!("[LOG] {}", message),
    }
}

#[tauri::command]
async fn greet(name: &str) -> Result<String, String> {
    eprintln!("执行greet命令: {}", name);
    Ok(format!("Hello, {}! You've been greeted from Rust!", name))
}

// 初始化Supabase的命令，能在应用启动后通过前端调用
#[tauri::command]
async fn init_database() -> Result<String, String> {
    eprintln!("开始初始化数据库...");
    
    match init_supabase().await {
        Ok(_) => {
            eprintln!("Supabase初始化完成");
            Ok("数据库初始化成功".to_string())
        },
        Err(e) => {
            eprintln!("Supabase初始化失败: {}", e);
            Err(format!("数据库初始化失败: {}", e))
        }
    }
}

#[tauri::command]
async fn main_add_user_id_column() -> Result<String, String> {
    eprintln!("执行添加user_id列的命令...");
    
    match database::supabase::add_user_id_column().await {
        Ok(message) => {
            eprintln!("添加user_id列成功: {}", message);
            Ok(message)
        },
        Err(e) => {
            eprintln!("添加user_id列失败: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
fn get_git_changes(repo_path: &str, prefix: &str) -> Result<String, String> {
    eprintln!("执行获取Git更改的命令，仓库路径: {}", repo_path);
    database::git_utils::get_git_changes(repo_path, prefix)
}

#[tauri::command]
fn get_git_last_commit(repo_path: &str) -> Result<String, String> {
    eprintln!("执行获取Git最后提交的命令，仓库路径: {}", repo_path);
    database::git_utils::get_git_last_commit(repo_path)
}

#[tokio::main]
async fn main() {
    // 初始化日志
    setup_logging();
    eprintln!("应用程序开始初始化");
    
    start_weekly_timer();

    // 初始化Supabase连接，确保数据库结构正确
    match database::supabase::init_supabase().await {
        Ok(_) => eprintln!("Supabase初始化成功，数据库结构已检查"),
        Err(e) => eprintln!("Supabase初始化警告: {}", e),
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            log_message,
            save_daily,
            auto_generate_weekly,
            read_text_file,
            save_template,
            read_template,
            render_daily_with_template,
            parse_excel_template,
            generate_excel_report,
            save_report_template,
            load_report_template,
            import_excel_tasks,
            save_daily_report,
            get_recent_daily_reports,
            get_recent_daily_reports_by_user,
            get_daily_report_by_date,
            generate_weekly_from_daily,
            export_with_template,
            select_file,
            select_save_path,
            generate_monthly_report,
            test_supabase_connection,
            init_database,
            main_add_user_id_column,
            get_git_changes,
            get_git_last_commit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
