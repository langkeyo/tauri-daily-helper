// Report module
mod report_impl;

// Re-export with #[tauri::command] preservation
pub use report_impl::start_weekly_timer;

#[tauri::command]
pub fn auto_generate_weekly() -> Result<(), String> {
    report_impl::auto_generate_weekly()
}

#[tauri::command]
pub fn save_template(content: String) -> Result<(), String> {
    report_impl::save_template(content)
}

#[tauri::command]
pub fn read_template() -> Result<String, String> {
    report_impl::read_template()
}

#[tauri::command]
pub fn render_daily_with_template(
    date: String,
    should: String,
    done: String,
    undone: String
) -> Result<String, String> {
    report_impl::render_daily_with_template(date, should, done, undone)
} 