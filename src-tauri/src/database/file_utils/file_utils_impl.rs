use std::fs;
use tauri_plugin_dialog::DialogExt;
use serde_json;

pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn select_file(app_handle: tauri::AppHandle, title: String, filters: Vec<serde_json::Value>) -> Result<String, String> {
    // 创建文件选择对话框
    let dialog = app_handle.dialog();
    let mut dialog_builder = dialog.file().set_title(&title);
    
    // 设置筛选条件
    for filter in filters {
        if let Some(filter_obj) = filter.as_object() {
            if let (Some(name), Some(extensions)) = (
                filter_obj.get("name").and_then(|v| v.as_str()),
                filter_obj.get("extensions").and_then(|v| v.as_array())
            ) {
                // 将String转为&str以匹配API需求
                let exts: Vec<&str> = extensions
                    .iter()
                    .filter_map(|e| e.as_str())
                    .collect();
                
                dialog_builder = dialog_builder.add_filter(name, &exts);
            }
        }
    }
    
    // 使用一个异步阻塞的方式获取结果
    let (tx, rx) = std::sync::mpsc::channel();
    
    dialog_builder.pick_file(move |file_path| {
        let _ = tx.send(file_path);
    });
    
    // 等待结果
    match rx.recv() {
        Ok(Some(path)) => Ok(path.to_string()),
        Ok(None) => Err("用户取消选择".to_string()),
        Err(_) => Err("选择文件时发生错误".to_string())
    }
}

pub fn select_save_path(app_handle: tauri::AppHandle, title: String, default_path: String, filters: Vec<serde_json::Value>) -> Result<String, String> {
    // 创建保存对话框
    let dialog = app_handle.dialog();
    let mut dialog_builder = dialog.file()
        .set_title(&title)
        .set_file_name(&default_path);
    
    // 设置筛选条件
    for filter in filters {
        if let Some(filter_obj) = filter.as_object() {
            if let (Some(name), Some(extensions)) = (
                filter_obj.get("name").and_then(|v| v.as_str()),
                filter_obj.get("extensions").and_then(|v| v.as_array())
            ) {
                // 将String转为&str以匹配API需求
                let exts: Vec<&str> = extensions
                    .iter()
                    .filter_map(|e| e.as_str())
                    .collect();
                
                dialog_builder = dialog_builder.add_filter(name, &exts);
            }
        }
    }
    
    // 使用一个异步阻塞的方式获取结果
    let (tx, rx) = std::sync::mpsc::channel();
    
    dialog_builder.save_file(move |file_path| {
        let _ = tx.send(file_path);
    });
    
    // 等待结果
    match rx.recv() {
        Ok(Some(path)) => Ok(path.to_string()),
        Ok(None) => Err("用户取消选择".to_string()),
        Err(_) => Err("选择保存路径时发生错误".to_string())
    }
}
