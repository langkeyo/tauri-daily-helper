// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
use database::*;

#[tauri::command]
async fn greet(name: &str) -> Result<String, String> {
    Ok(format!("Hello, {}! You've been greeted from Rust!", name))
}

fn main() {
    start_weekly_timer();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
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
            get_daily_report_by_date,
            generate_weekly_from_daily,
            export_with_template,
            select_file,
            select_save_path,
            generate_monthly_report,
            test_supabase_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
