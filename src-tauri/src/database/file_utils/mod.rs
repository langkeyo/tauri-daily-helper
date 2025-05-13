// File utils module
mod file_utils_impl;

// Re-export with #[tauri::command] preservation
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    file_utils_impl::read_text_file(path)
}

#[tauri::command]
pub fn select_file(app_handle: tauri::AppHandle, title: String, filters: Vec<serde_json::Value>) -> Result<String, String> {
    file_utils_impl::select_file(app_handle, title, filters)
}

#[tauri::command]
pub fn select_save_path(app_handle: tauri::AppHandle, title: String, default_path: String, filters: Vec<serde_json::Value>) -> Result<String, String> {
    file_utils_impl::select_save_path(app_handle, title, default_path, filters)
} 