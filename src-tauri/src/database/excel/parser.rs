use calamine::{Reader, Xlsx, open_workbook, DataType};
use std::fs;
use std::collections::HashMap;
use tempfile::Builder;
use crate::database::types::{Task, ReportTemplate};

pub fn parse_excel_template(excel_data: Vec<u8>) -> Result<ReportTemplate, String> {
    // 创建临时文件
    let temp_dir = Builder::new().prefix("excel_template").tempdir()
        .map_err(|e| format!("无法创建临时目录: {}", e))?;
    let temp_path = temp_dir.path().join("template.xlsx");
    
    // 写入Excel数据到临时文件
    fs::write(&temp_path, &excel_data)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;
    
    // 使用calamine打开Excel文件
    let mut workbook: Xlsx<_> = open_workbook(&temp_path)
        .map_err(|e| format!("打开Excel文件失败: {}", e))?;
    
    let sheet_name = workbook.sheet_names().get(0)
        .ok_or("Excel文件没有工作表".to_string())?
        .clone();
    
    // 正确处理Option<Result<Range, XlsxError>>
    let range = match workbook.worksheet_range(&sheet_name) {
        Some(Ok(range)) => range,
        Some(Err(e)) => return Err(format!("读取工作表出错: {}", e)),
        None => return Err("没有找到工作表".to_string()),
    };
    
    // 解析Excel内容
    let mut tasks = Vec::new();
    let mut next_week_plan = String::new();

    // 尝试识别表格结构的列索引
    let mut col_indices = HashMap::new();
    
    // 要识别的列名称
    let column_names = [
        ("task_id", vec!["任务编号", "编号", "ID"]),
        ("task_name", vec!["任务名称", "名称"]),
        ("task", vec!["任务内容", "内容", "量化指标", "工作内容"]),
        ("plan_start", vec!["计划开始时间", "计划开始"]),
        ("plan_end", vec!["计划结束时间", "计划结束"]),
        ("actual_start", vec!["实际开始时间", "实际开始"]),
        ("actual_end", vec!["实际结束时间", "实际结束"]),
        ("status", vec!["任务状态", "状态", "完成状态"]),
        ("plan_hours", vec!["计划工时", "计划工时(小时)"]),
        ("actual_hours", vec!["实际工时", "实际工时(小时)"]),
        ("remarks", vec!["备注", "说明"])
    ];

    // 搜索表头找列索引
    'header_search: for row_idx in 0..std::cmp::min(20, range.height()) {
        let mut found_count = 0;
        
        for col_idx in 0..std::cmp::min(20, range.width()) {
            if let Some(cell) = range.get((row_idx, col_idx)) {
                if let Some(text) = cell.get_string() {
                    let text = text.trim();
                    
                    for (col_key, synonyms) in &column_names {
                        for &synonym in synonyms {
                            if text.contains(synonym) {
                                col_indices.insert(col_key.to_string(), col_idx);
                                found_count += 1;
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // 如果找到多个列头，认为这是表头行，记住行号并停止搜索
        if found_count >= 3 {
            col_indices.insert("header_row".to_string(), row_idx);
            break 'header_search;
        }
    }
    
    // 必须至少有任务内容列
    let task_col = match col_indices.get("task") {
        Some(&idx) => idx,
        None => {
            // 如果没找到，尝试使用第一列
            if range.width() > 0 { 0 } else { 
                return Err("表格结构无法识别，未找到任务内容列".to_string()) 
            }
        }
    };
    
    // 计算起始行（表头行+1）
    let start_row = match col_indices.get("header_row") {
        Some(&row) => row + 1,
        None => 1, // 默认从第二行开始
    };
    
    // 从表格中提取任务数据
    for row_idx in start_row..range.height() {
        // 获取任务内容
        let task_content = range.get((row_idx, task_col))
            .and_then(|cell| {
                match cell {
                    DataType::String(s) => Some(s.clone()),
                    DataType::Float(f) => Some(f.to_string()),
                    DataType::Int(i) => Some(i.to_string()),
                    _ => None,
                }
            });
        
        // 如果有任务内容并且不是空字符串
        if let Some(task) = task_content {
            if !task.trim().is_empty() && 
               !(task.contains("下周") && task.contains("计划")) { // 跳过下周计划行
                // 构建任务对象
                let mut task_obj = Task {
                    task,
                    status: "进行中".to_string(),
                    remarks: String::new(),
                    task_id: None,
                    task_name: None,
                    plan_start_time: None,
                    plan_end_time: None,
                    actual_start_time: None,
                    actual_end_time: None,
                    plan_hours: None,
                    actual_hours: None,
                };
                
                // 填充其他字段
                if let Some(&col) = col_indices.get("status") {
                    task_obj.status = range.get((row_idx, col))
                        .and_then(|cell| cell.get_string().map(|s| s.to_string()))
                        .unwrap_or_else(|| "进行中".to_string());
                }
                
                if let Some(&col) = col_indices.get("remarks") {
                    task_obj.remarks = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        })
                        .unwrap_or_default();
                }
                
                // 填充其他可选字段
                if let Some(&col) = col_indices.get("task_id") {
                    task_obj.task_id = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                if let Some(&col) = col_indices.get("task_name") {
                    task_obj.task_name = range.get((row_idx, col))
                        .and_then(|cell| cell.get_string().map(|s| s.to_string()));
                }
                
                if let Some(&col) = col_indices.get("plan_start") {
                    task_obj.plan_start_time = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                if let Some(&col) = col_indices.get("plan_end") {
                    task_obj.plan_end_time = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                if let Some(&col) = col_indices.get("actual_start") {
                    task_obj.actual_start_time = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                if let Some(&col) = col_indices.get("actual_end") {
                    task_obj.actual_end_time = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                if let Some(&col) = col_indices.get("plan_hours") {
                    task_obj.plan_hours = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                if let Some(&col) = col_indices.get("actual_hours") {
                    task_obj.actual_hours = range.get((row_idx, col))
                        .and_then(|cell| match cell {
                            DataType::String(s) => Some(s.clone()),
                            DataType::Float(f) => Some(f.to_string()),
                            DataType::Int(i) => Some(i.to_string()),
                            _ => None,
                        });
                }
                
                tasks.push(task_obj);
            }
        }
    }
    
    // 查找下周计划
    let plan_keywords = ["下周", "计划", "下周工作计划", "下一周", "未来工作"];
    'outer: for row_idx in 0..range.height() {
        for col_idx in 0..range.width() {
            if let Some(cell) = range.get((row_idx, col_idx)) {
                if let Some(text) = cell.get_string() {
                    for keyword in &plan_keywords {
                        if text.contains(keyword) {
                            // 尝试读取下面的内容
                            if row_idx + 1 < range.height() {
                                for i in row_idx + 1..std::cmp::min(row_idx + 10, range.height()) {
                                    if let Some(cell) = range.get((i, col_idx)) {
                                        if let Some(text) = cell.get_string() {
                                            if !text.trim().is_empty() {
                                                next_week_plan = text.to_string();
                                                break 'outer;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 如果任务列表为空，返回错误
    if tasks.is_empty() {
        return Err("未能从Excel中提取任务数据，请检查格式是否正确".to_string());
    }
    
    Ok(ReportTemplate {
        tasks,
        next_week_plan,
        column_indices: col_indices,
    })
}

pub fn import_excel_tasks(file_path: String) -> Result<Vec<Task>, String> {
    let mut workbook: Xlsx<_> = open_workbook(&file_path)
        .map_err(|e| format!("无法打开Excel文件: {}", e))?;
    
    let sheet_name = workbook.sheet_names().get(0)
        .ok_or_else(|| "Excel文件中没有工作表".to_string())?
        .clone();
    
    // 正确处理Option<Result<Range, XlsxError>>
    let range = match workbook.worksheet_range(&sheet_name) {
        Some(Ok(range)) => range,
        Some(Err(e)) => return Err(format!("读取工作表出错: {}", e)),
        None => return Err("没有找到工作表".to_string()),
    };
    
    let mut tasks = Vec::new();
    
    // 从第2行开始读取数据（跳过标题行）
    for row_idx in 1..range.height() {
        if row_idx < range.height() {
            let task_content = match range.get((row_idx, 0)) {
                Some(DataType::String(s)) => s.clone(),
                Some(DataType::Float(f)) => f.to_string(),
                Some(DataType::Int(i)) => i.to_string(),
                Some(_) | None => continue,
            };
            
            let status = match range.get((row_idx, 1)) {
                Some(DataType::String(s)) => s.clone(),
                Some(_) | None => "进行中".to_string(),
            };
            
            let remarks = match range.get((row_idx, 2)) {
                Some(DataType::String(s)) => s.clone(),
                Some(_) | None => "".to_string(),
            };
            
            tasks.push(Task {
                task: task_content,
                status,
                remarks,
                task_id: None,
                task_name: None,
                plan_start_time: None,
                plan_end_time: None,
                actual_start_time: None,
                actual_end_time: None,
                plan_hours: None,
                actual_hours: None,
            });
        }
    }
    
    Ok(tasks)
} 