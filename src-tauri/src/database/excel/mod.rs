// Excel module - entry point
mod parser;
mod generator;
mod template;
mod utils;

// Re-exports with #[tauri::command] macro preservation
#[tauri::command]
pub fn parse_excel_template(excel_data: Vec<u8>) -> Result<crate::database::types::ReportTemplate, String> {
    parser::parse_excel_template(excel_data)
}

#[tauri::command]
pub fn import_excel_tasks(file_data: Vec<u8>) -> Result<Vec<crate::database::types::Task>, String> {
    // 创建临时文件
    let temp_dir = tempfile::Builder::new().prefix("excel_import").tempdir()
        .map_err(|e| format!("无法创建临时目录: {}", e))?;
    let temp_path = temp_dir.path().join("import.xlsx");
    let temp_path_str = temp_path.to_str().ok_or("路径转换失败")?.to_string();
    
    // 写入Excel数据到临时文件
    std::fs::write(&temp_path, &file_data)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;
    
    // 调用原始函数处理文件
    parser::import_excel_tasks(temp_path_str)
}

#[tauri::command]
pub fn generate_excel_report(
    app_handle: tauri::AppHandle,
    start_date: String,
    end_date: String,
    tasks: Vec<crate::database::types::Task>,
    next_week_plan: String,
) -> Result<(), String> {
    generator::generate_excel_report(app_handle, start_date, end_date, tasks, next_week_plan)
}

#[tauri::command]
pub fn export_with_template(
    template_path: String,
    output_path: String,
    tasks: Vec<crate::database::types::Task>,
    next_week_plan: String,
) -> Result<(), String> {
    generator::export_with_template(template_path, output_path, tasks, next_week_plan)
}

#[tauri::command]
pub fn generate_monthly_report(
    app_handle: tauri::AppHandle,
    template_path: String,
    output_path: String,
    year_month: String,
    user_info: crate::database::types::UserInfo,
) -> Result<(), String> {
    generator::generate_monthly_report(app_handle, template_path, output_path, year_month, user_info)
}

#[tauri::command]
pub fn generate_weekly_from_daily(start_date: String, end_date: String) -> Result<crate::database::types::ReportTemplate, String> {
    template::generate_weekly_from_daily(start_date, end_date)
}

#[tauri::command]
pub fn save_report_template(tasks: Vec<crate::database::types::Task>, next_week_plan: String) -> Result<(), String> {
    template::save_report_template(tasks, next_week_plan)
}

#[tauri::command]
pub fn load_report_template() -> Result<crate::database::types::ReportTemplate, String> {
    template::load_report_template()
} 