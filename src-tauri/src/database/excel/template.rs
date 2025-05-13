use std::fs;
use std::collections::HashMap;
use crate::database::types::{Task, ReportTemplate};
use crate::database::sqlite::init_db;
use crate::database::excel::utils::extract_tasks_from_daily;

pub fn save_report_template(tasks: Vec<Task>, next_week_plan: String) -> Result<(), String> {
    let template = ReportTemplate {
        tasks,
        next_week_plan,
        column_indices: HashMap::new(),
    };
    
    let json = serde_json::to_string_pretty(&template)
        .map_err(|e| format!("序列化模板失败: {}", e))?;
    
    fs::write("report_template.json", json)
        .map_err(|e| format!("保存模板失败: {}", e))?;
    
    Ok(())
}

pub fn load_report_template() -> Result<ReportTemplate, String> {
    let json = fs::read_to_string("report_template.json")
        .map_err(|e| format!("读取模板失败: {}", e))?;
    
    serde_json::from_str(&json)
        .map_err(|e| format!("解析模板失败: {}", e))
}

pub fn generate_weekly_from_daily(start_date: String, end_date: String) -> Result<ReportTemplate, String> {
    // 连接数据库
    let conn = init_db().map_err(|e| e.to_string())?;
    
    // 查询指定日期范围内的日报
    let mut stmt = conn.prepare(
        "SELECT id, date, content, should, done, undone FROM dailies WHERE date BETWEEN ?1 AND ?2 ORDER BY date ASC"
    ).map_err(|e| e.to_string())?;
    
    // 执行查询
    let daily_rows = stmt.query_map([&start_date, &end_date], |row| {
        Ok(crate::database::types::DailyReport {
            id: row.get(0)?,
            user_id: None,
            date: row.get(1)?,
            task_id: None,
            task_name: None,
            should_complete: row.get(2).unwrap_or_default(),
            completed: row.get(3).unwrap_or_default(),
            uncompleted: row.get(4).unwrap_or_default(),
            plan_hours: None,
            actual_hours: None,
            remarks: row.get(5).unwrap_or_default(),
        })
    }).map_err(|e| e.to_string())?;
    
    // 收集所有日报
    let mut daily_reports = Vec::new();
    for report in daily_rows {
        daily_reports.push(report.map_err(|e| e.to_string())?);
    }
    
    // 如果没有找到日报，返回错误
    if daily_reports.is_empty() {
        return Err(format!("未找到 {} 至 {} 期间的日报数据", start_date, end_date));
    }
    
    // 从日报中提取并整合任务
    let tasks = extract_tasks_from_daily(&daily_reports)?;
    
    // 生成下周计划（可以是最后一天日报中的未完成任务）
    let next_week_plan = if let Some(last_report) = daily_reports.last() {
        if !last_report.uncompleted.trim().is_empty() {
            format!("继续完成本周未完成工作：{}", last_report.uncompleted)
        } else {
            String::new()
        }
    } else {
        String::new()
    };
    
    // 返回周报模板
    Ok(ReportTemplate {
        tasks,
        next_week_plan,
        column_indices: HashMap::new(),
    })
} 