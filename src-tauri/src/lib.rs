mod database;
mod idle;
mod dingtalk;
mod notify;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      crate::database::save_daily,
      crate::database::auto_generate_weekly,
      crate::idle::start_idle_detection,
      crate::dingtalk::send_to_dingtalk,
      crate::database::read_text_file,
      crate::database::save_template,
      crate::database::read_template,
      crate::database::render_daily_with_template,
      crate::database::parse_excel_template,
      crate::database::generate_excel_report,
      crate::database::save_report_template,
      crate::database::load_report_template,
      crate::database::generate_monthly_report,
      crate::database::select_file,
      crate::database::select_save_path,
    ])
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      crate::database::start_weekly_timer();
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
