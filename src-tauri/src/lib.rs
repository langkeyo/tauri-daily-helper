mod database;
mod idle;
mod dingtalk;
mod notify;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      crate::database::save_daily,
      crate::idle::start_idle_detection,
      crate::dingtalk::send_to_dingtalk,
      crate::database::excel::parse_excel_template,
      crate::database::excel::generate_excel_report,
      crate::database::excel::save_report_template,
      crate::database::excel::load_report_template,
      crate::database::excel::generate_monthly_report,
      crate::database::excel::export_with_template,
      crate::database::excel::import_excel_tasks,
      crate::database::excel::generate_weekly_from_daily,
      crate::database::report::auto_generate_weekly,
      crate::database::report::save_template,
      crate::database::report::read_template, 
      crate::database::report::render_daily_with_template,
      crate::database::file_utils::read_text_file,
      crate::database::file_utils::select_file,
      crate::database::file_utils::select_save_path,
      crate::database::supabase::save_daily_report,
      crate::database::supabase::get_recent_daily_reports,
      crate::database::supabase::get_daily_report_by_date,
      crate::database::supabase::test_supabase_connection,
    ])
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      crate::database::report::start_weekly_timer();
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
