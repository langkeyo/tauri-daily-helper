use xlsxwriter::Workbook;
use xlsxwriter::format;
use tauri_plugin_dialog::DialogExt;
use umya_spreadsheet::{reader, writer};
use std::collections::HashMap;
use crate::database::types::{Task, UserInfo, DailyReport};
use crate::database::sqlite::init_db;

pub fn generate_excel_report(
    app_handle: tauri::AppHandle,
    start_date: String,
    end_date: String,
    tasks: Vec<Task>,
    next_week_plan: String,
) -> Result<(), String> {
    // 文件名建议
    let suggested_filename = format!("周报_{}_至_{}.xlsx", start_date, end_date);
    
    // 创建临时文件目录，但不让它自动删除
    let temp_file_path = std::env::temp_dir().join(&suggested_filename);
    let temp_path_str = temp_file_path.to_str().expect("路径转换失败").to_string();
    
    // 创建Excel文件
    let workbook = Workbook::new(&temp_path_str)
        .map_err(|e| format!("创建Excel文件失败: {}", e))?;
    
    // 创建工作表
    let mut sheet = workbook.add_worksheet(Some("周报"))
        .map_err(|e| format!("创建工作表失败: {}", e))?;
    
    // 设置列宽
    sheet.set_column(0, 0, 10.0, None) // 日期
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(1, 1, 15.0, None) // 任务编号
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(2, 2, 15.0, None) // 任务名称
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(3, 3, 45.0, None) // 任务内容
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(4, 4, 16.0, None) // 计划开始时间
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(5, 5, 16.0, None) // 计划结束时间
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(6, 6, 12.0, None) // 任务状态
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(7, 7, 12.0, None) // 计划工时
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(8, 8, 12.0, None) // 实际工时
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(9, 9, 12.0, None) // 任务负责人
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    sheet.set_column(10, 10, 20.0, None) // 备注
        .map_err(|e| format!("设置列宽失败: {}", e))?;
    
    // 样式设置
    let mut title_format = format::Format::new();
    title_format.set_bold();
    title_format.set_font_size(14.0);
    title_format.set_align(format::FormatAlignment::Center);
    
    let mut header_format = format::Format::new();
    header_format.set_bold();
    header_format.set_pattern(format::FormatPatterns::Solid);
    header_format.set_bg_color(format::FormatColor::Custom(22)); // 深蓝色
    header_format.set_font_color(format::FormatColor::Custom(1)); // 白色
    header_format.set_align(format::FormatAlignment::Center);
    
    let mut black_header_format = format::Format::new();
    black_header_format.set_pattern(format::FormatPatterns::Solid);
    black_header_format.set_bg_color(format::FormatColor::Black);
    black_header_format.set_font_color(format::FormatColor::Custom(1)); // 白色

    // 内容格式
    let mut content_format = format::Format::new();
    content_format.set_align(format::FormatAlignment::Left);
    content_format.set_text_wrap();
    
    // 时间格式
    let mut date_format = format::Format::new();
    date_format.set_align(format::FormatAlignment::Center);
    
    // 状态格式
    let mut status_format = format::Format::new();
    status_format.set_align(format::FormatAlignment::Center);
    
    // 设置主标题
    sheet.merge_range(0, 0, 0, 10, &format!("周工作进度计划与完成表 ({} 至 {})", start_date, end_date), Some(&title_format))
        .map_err(|e| format!("写入标题失败: {}", e))?;
    
    // 添加一个空行
    sheet.set_row(1, 15.0, None).map_err(|e| format!("设置行高失败: {}", e))?;
    
    // 添加子标题 - 黑色背景
    sheet.merge_range(2, 0, 2, 10, "（一）周报概况", Some(&black_header_format))
        .map_err(|e| format!("写入子标题失败: {}", e))?;
    
    // 表头行
    let header_row = 3;
    sheet.write_string(header_row, 0, "日期", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 1, "任务编号", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 2, "任务名称", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 3, "任务描述", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 4, "计划开始时间", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 5, "计划完成时间", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 6, "任务状态", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 7, "计划工时(小时)", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 8, "实际工时(小时)", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 9, "任务负责人", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    sheet.write_string(header_row, 10, "备注", Some(&header_format))
        .map_err(|e| format!("写入表头失败: {}", e))?;
    
    // 获取日期部分
    let date_parts: Vec<&str> = start_date.split('-').collect();
    let month = if date_parts.len() >= 2 {
        date_parts[1].trim_start_matches('0')
    } else {
        "1"
    };
    
    // 写入任务内容
    for (i, task) in tasks.iter().enumerate() {
        let row = i as u32 + header_row + 1;
        
        // 计算当前任务的日期
        let day_offset = i as u32 % 5; // 假设每周5个工作日
        let day_num = if date_parts.len() >= 3 {
            date_parts[2].parse::<u32>().unwrap_or(1) + day_offset
        } else {
            1 + day_offset
        };
        
        let task_date = format!("{}月{}日", month, day_num);
        
        // 日期
        sheet.write_string(row, 0, &task_date, Some(&date_format))
            .map_err(|e| format!("写入日期失败: {}", e))?;
        
        // 任务编号
        if let Some(task_id) = &task.task_id {
            sheet.write_string(row, 1, task_id, Some(&content_format))
                .map_err(|e| format!("写入任务编号失败: {}", e))?;
        } else {
            sheet.write_string(row, 1, &format!("任务{:03}", i+1), Some(&content_format))
                .map_err(|e| format!("写入任务编号失败: {}", e))?;
        }
        
        // 任务名称
        if let Some(task_name) = &task.task_name {
            sheet.write_string(row, 2, task_name, Some(&content_format))
                .map_err(|e| format!("写入任务名称失败: {}", e))?;
        } else {
            let short_name = if task.task.len() > 20 {
                format!("{}...", &task.task[0..20])
            } else {
                task.task.clone()
            };
            sheet.write_string(row, 2, &short_name, Some(&content_format))
                .map_err(|e| format!("写入任务名称失败: {}", e))?;
        }
        
        // 任务内容
        sheet.write_string(row, 3, &task.task, Some(&content_format))
            .map_err(|e| format!("写入任务内容失败: {}", e))?;
        
        // 计划开始时间
        if let Some(time) = &task.plan_start_time {
            sheet.write_string(row, 4, time, Some(&date_format))
                .map_err(|e| format!("写入计划开始时间失败: {}", e))?;
        } else {
            sheet.write_string(row, 4, &start_date, Some(&date_format))
                .map_err(|e| format!("写入计划开始时间失败: {}", e))?;
        }
        
        // 计划结束时间
        if let Some(time) = &task.plan_end_time {
            sheet.write_string(row, 5, time, Some(&date_format))
                .map_err(|e| format!("写入计划结束时间失败: {}", e))?;
        } else {
            sheet.write_string(row, 5, &end_date, Some(&date_format))
                .map_err(|e| format!("写入计划结束时间失败: {}", e))?;
        }
        
        // 任务状态
        sheet.write_string(row, 6, &task.status, Some(&status_format))
            .map_err(|e| format!("写入任务状态失败: {}", e))?;
        
        // 计划工时
        if let Some(hours) = &task.plan_hours {
            sheet.write_string(row, 7, hours, Some(&content_format))
                .map_err(|e| format!("写入计划工时失败: {}", e))?;
        } else {
            sheet.write_string(row, 7, "8", Some(&content_format))
                .map_err(|e| format!("写入计划工时失败: {}", e))?;
        }
        
        // 实际工时
        if let Some(hours) = &task.actual_hours {
            sheet.write_string(row, 8, hours, Some(&content_format))
                .map_err(|e| format!("写入实际工时失败: {}", e))?;
        } else {
            sheet.write_string(row, 8, "8", Some(&content_format))
                .map_err(|e| format!("写入实际工时失败: {}", e))?;
        }
        
        // 默认负责人 - 留空
        sheet.write_string(row, 9, "", Some(&content_format))
            .map_err(|e| format!("写入负责人失败: {}", e))?;
        
        // 备注
        sheet.write_string(row, 10, &task.remarks, Some(&content_format))
            .map_err(|e| format!("写入备注失败: {}", e))?;
    }
    
    // 添加一个空行
    let next_row = tasks.len() as u32 + header_row + 2;
    sheet.set_row(next_row, 15.0, None).map_err(|e| format!("设置行高失败: {}", e))?;
    
    // 添加下周计划部分 - 标题采用黑色背景
    sheet.merge_range(next_row + 1, 0, next_row + 1, 10, "（二）下周工作计划", Some(&black_header_format))
        .map_err(|e| format!("写入下周计划标题失败: {}", e))?;
    
    if !next_week_plan.is_empty() {
        sheet.merge_range(next_row + 2, 0, next_row + 2, 10, &next_week_plan, Some(&content_format))
            .map_err(|e| format!("写入下周计划内容失败: {}", e))?;
    }
    
    // 关闭工作簿，写入临时文件
    workbook.close().map_err(|e| format!("保存Excel文件失败: {}", e))?;
    
    // 使用tauri-plugin-dialog进行文件保存对话框
    let dialog = app_handle.dialog();
    dialog.file()
        .add_filter("Excel文件", &["xlsx"])
        .set_file_name(&suggested_filename)
        .save_file(move |path_opt| {
            if let Some(path) = path_opt {
                // 将临时文件复制到用户选择的位置
                if let Err(e) = std::fs::copy(&temp_path_str, path.to_string()) {
                    eprintln!("保存文件失败: {}", e);
                } else {
                    // 删除临时文件
                    let _ = std::fs::remove_file(&temp_path_str);
                }
            }
        });
    
    Ok(())
}

pub fn export_with_template(
    template_path: String,
    output_path: String,
    tasks: Vec<Task>,
    next_week_plan: String,
) -> Result<(), String> {
    // 1. 打开模板
    let mut book = reader::xlsx::read(&template_path)
        .map_err(|e| format!("读取模板失败: {}", e))?;
    let sheet_name = book.get_sheet_collection().get(0).unwrap().get_name().to_string();
    let sheet = book.get_sheet_by_name_mut(&sheet_name).ok_or("找不到工作表")?;

    // 2. 查找表头行和列索引
    let mut col_map = HashMap::new();
    let mut header_row = 0u32;
    'outer: for row in 1..=20 {
        for col in 1..=20 {
            let cell = sheet.get_cell((col, row));
            if let Some(cell) = cell {
                let text = cell.get_value();
                if text.contains("任务内容") || text.contains("工作内容") {
                    col_map.insert("task", col);
                }
                if text.contains("任务编号") || text.contains("编号") {
                    col_map.insert("task_id", col);
                }
                if text.contains("任务名称") || text.contains("名称") {
                    col_map.insert("task_name", col);
                }
                if text.contains("计划开始") {
                    col_map.insert("plan_start_time", col);
                }
                if text.contains("计划结束") {
                    col_map.insert("plan_end_time", col);
                }
                if text.contains("实际开始") {
                    col_map.insert("actual_start_time", col);
                }
                if text.contains("实际结束") {
                    col_map.insert("actual_end_time", col);
                }
                if text.contains("任务状态") || text.contains("状态") {
                    col_map.insert("status", col);
                }
                if text.contains("计划工时") {
                    col_map.insert("plan_hours", col);
                }
                if text.contains("实际工时") {
                    col_map.insert("actual_hours", col);
                }
                if text.contains("备注") {
                    col_map.insert("remarks", col);
                }
            }
        }
        if col_map.len() >= 3 {
            header_row = row;
            break 'outer;
        }
    }
    if header_row == 0 {
        return Err("未能识别模板表头，请检查模板格式".to_string());
    }

    // 3. 批量写入任务内容（假设数据区紧跟表头行）
    for (i, task) in tasks.iter().enumerate() {
        let row = header_row + 1 + i as u32;
        if let Some(&col) = col_map.get("task") {
            sheet.get_cell_mut((col, row)).set_value(&task.task);
        }
        if let Some(&col) = col_map.get("task_id") {
            sheet.get_cell_mut((col, row)).set_value(task.task_id.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("task_name") {
            sheet.get_cell_mut((col, row)).set_value(task.task_name.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("plan_start_time") {
            sheet.get_cell_mut((col, row)).set_value(task.plan_start_time.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("plan_end_time") {
            sheet.get_cell_mut((col, row)).set_value(task.plan_end_time.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("actual_start_time") {
            sheet.get_cell_mut((col, row)).set_value(task.actual_start_time.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("actual_end_time") {
            sheet.get_cell_mut((col, row)).set_value(task.actual_end_time.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("status") {
            sheet.get_cell_mut((col, row)).set_value(&task.status);
        }
        if let Some(&col) = col_map.get("plan_hours") {
            sheet.get_cell_mut((col, row)).set_value(task.plan_hours.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("actual_hours") {
            sheet.get_cell_mut((col, row)).set_value(task.actual_hours.clone().unwrap_or_default());
        }
        if let Some(&col) = col_map.get("remarks") {
            sheet.get_cell_mut((col, row)).set_value(&task.remarks);
        }
    }

    // 4. 查找"下周计划"关键字并写入内容
    for row in (header_row + tasks.len() as u32 + 1)..=(header_row + tasks.len() as u32 + 10) {
        for col in 1..=20 {
            let cell = sheet.get_cell_mut((col, row));
            if cell.get_value().contains("下周") && cell.get_value().contains("计划") {
                // 写到下方一行
                sheet.get_cell_mut((col, row + 1)).set_value(&next_week_plan);
                break;
            }
        }
    }

    // 5. 保存
    writer::xlsx::write(&book, &output_path).map_err(|e| format!("保存Excel失败: {}", e))?;
    Ok(())
}

pub fn generate_monthly_report(
    _app_handle: tauri::AppHandle,
    template_path: String,
    output_path: String,
    year_month: String, // 例如 "2024-04"
    user_info: UserInfo,
) -> Result<(), String> {
    // 1. 读取模板
    let mut book = reader::xlsx::read(&template_path)
        .map_err(|e| format!("读取模板失败: {}", e))?;
    let sheet_name = book.get_sheet_collection().get(0).unwrap().get_name().to_string();
    let sheet = book.get_sheet_by_name_mut(&sheet_name).ok_or("找不到工作表")?;

    // 2. 填充表头（岗位/部门/姓名/时间）
    // 假设表头分别在B2、D2、F2、H2
    sheet.get_cell_mut((2, 2)).set_value(user_info.position.clone());
    sheet.get_cell_mut((4, 2)).set_value(user_info.department.clone());
    sheet.get_cell_mut((6, 2)).set_value(user_info.name.clone());
    sheet.get_cell_mut((8, 2)).set_value(user_info.date.clone());

    // 3. 查询本月所有日报
    let conn = init_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT date, content, should, done, undone FROM dailies WHERE date LIKE ?1 ORDER BY date ASC"
    ).map_err(|e| e.to_string())?;
    let like_pattern = format!("{}-%", year_month);
    let daily_rows = stmt.query_map([like_pattern], |row| {
        Ok(DailyReport {
            id: None,
            user_id: None,
            date: row.get(0)?,
            task_id: None,
            task_name: None,
            should_complete: row.get(2).unwrap_or_default(),
            completed: row.get(3).unwrap_or_default(),
            uncompleted: row.get(4).unwrap_or_default(),
            plan_hours: None,
            actual_hours: None,
            remarks: row.get(1).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;
    let mut reports = Vec::new();
    for report in daily_rows {
        reports.push(report.map_err(|e| e.to_string())?);
    }

    // 4. 合成"本月工作总结"表格内容
    // 假设表格从第6行开始，列顺序为：任务内容、状态、备注
    let start_row = 6u32;
    for (i, report) in reports.iter().enumerate() {
        let row = start_row + i as u32;
        sheet.get_cell_mut((1, row)).set_value(&report.should_complete); // 任务内容
        sheet.get_cell_mut((2, row)).set_value("已完成"); // 状态
        sheet.get_cell_mut((3, row)).set_value(&report.remarks); // 备注
    }

    // 5. 合成"下月工作计划"
    // 假设在第20行第1列
    let mut plan_text = String::new();
    for report in &reports {
        if !report.uncompleted.trim().is_empty() {
            plan_text.push_str(&report.uncompleted);
            plan_text.push_str("\n");
        }
    }
    sheet.get_cell_mut((1, 20)).set_value(plan_text.trim());

    // 6. 保存
    writer::xlsx::write(&book, &output_path).map_err(|e| format!("保存Excel失败: {}", e))?;
    Ok(())
} 