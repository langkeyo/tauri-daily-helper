use crate::database::types::Task;

// 辅助函数：从文本中提取任务项（按行分割）
pub fn extract_task_items(text: &str) -> Vec<String> {
    let mut items = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            items.push(trimmed.to_string());
        }
    }
    
    // 如果没有换行，尝试按逗号、分号或句号分割
    if items.len() <= 1 && !text.trim().is_empty() {
        let mut split_items = Vec::new();
        for item in text.split(|c| c == ',' || c == '；' || c == '。' || c == ';' || c == '.') {
            let trimmed = item.trim();
            if !trimmed.is_empty() {
                split_items.push(trimmed.to_string());
            }
        }
        
        if split_items.len() > 1 {
            return split_items;
        }
    }
    
    items
}

// 从日报中提取任务
pub fn extract_tasks_from_daily(daily_reports: &[crate::database::types::DailyReport]) -> Result<Vec<Task>, String> {
    let mut tasks: Vec<Task> = Vec::new();
    let mut task_map: std::collections::HashMap<String, Task> = std::collections::HashMap::new();
    
    // 遍历所有日报，提取和合并任务
    for report in daily_reports {
        // 处理应完成的任务
        let should_items = extract_task_items(&report.should_complete);
        for item in should_items {
            let task_key = item.clone();
            if !task_map.contains_key(&task_key) {
                // 新任务
                task_map.insert(task_key.clone(), Task {
                    task: item,
                    status: "进行中".to_string(),
                    remarks: String::new(),
                    task_id: report.task_id.clone(),
                    task_name: report.task_name.clone(),
                    plan_start_time: Some(report.date.clone()),
                    plan_end_time: Some(report.date.clone()),
                    actual_start_time: None,
                    actual_end_time: None,
                    plan_hours: report.plan_hours.clone(),
                    actual_hours: report.actual_hours.clone(),
                });
            }
        }
        
        // 处理已完成的任务
        let completed_items = extract_task_items(&report.completed);
        for item in completed_items {
            let task_key = item.clone();
            if task_map.contains_key(&task_key) {
                // 更新任务状态为已完成
                let mut task = task_map.get(&task_key).unwrap().clone();
                task.status = "已完成".to_string();
                // 更新完成日期
                task.actual_start_time = Some(report.date.clone());
                // 可选：也可以设置actual_end_time
                task.actual_end_time = Some(report.date.clone());
                task_map.insert(task_key, task);
            } else {
                // 如果是新任务，添加为已完成
                task_map.insert(task_key.clone(), Task {
                    task: item,
                    status: "已完成".to_string(),
                    remarks: String::new(),
                    task_id: report.task_id.clone(),
                    task_name: report.task_name.clone(),
                    plan_start_time: Some(report.date.clone()),
                    plan_end_time: Some(report.date.clone()),
                    actual_start_time: Some(report.date.clone()),
                    actual_end_time: Some(report.date.clone()),
                    plan_hours: report.plan_hours.clone(),
                    actual_hours: report.actual_hours.clone(),
                });
            }
        }
        
        // 处理未完成的任务
        let uncompleted_items = extract_task_items(&report.uncompleted);
        for item in uncompleted_items {
            let task_key = item.clone();
            if task_map.contains_key(&task_key) {
                // 更新任务状态为未完成
                let mut task = task_map.get(&task_key).unwrap().clone();
                task.status = "进行中".to_string();
                task.remarks = format!("{}未能完成: {}", report.date, task.remarks);
                // 可选：也可以设置actual_end_time
                task.actual_end_time = None;
                task_map.insert(task_key, task);
            } else {
                // 如果是新任务，添加为未完成
                task_map.insert(task_key.clone(), Task {
                    task: item,
                    status: "进行中".to_string(),
                    remarks: format!("{}未能完成", report.date),
                    task_id: report.task_id.clone(),
                    task_name: report.task_name.clone(),
                    plan_start_time: Some(report.date.clone()),
                    plan_end_time: None,
                    actual_start_time: None,
                    actual_end_time: None,
                    plan_hours: report.plan_hours.clone(),
                    actual_hours: report.actual_hours.clone(),
                });
            }
        }
    }
    
    // 将HashMap转换为Vec
    for (_, task) in task_map {
        tasks.push(task);
    }
    
    Ok(tasks)
} 