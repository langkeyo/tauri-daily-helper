use rusqlite::{Connection, Result};
use std::fs;
use std::{thread, time::Duration};
use chrono::{Datelike, Timelike};
use handlebars::Handlebars;
use serde::{Deserialize, Serialize};
use calamine::{Reader, Xlsx, open_workbook, DataType};
use xlsxwriter::Workbook;
use xlsxwriter::format;
use tempfile::Builder;
use tauri_plugin_dialog::DialogExt;
use umya_spreadsheet::{reader, writer};
use reqwest::Client;
use std::error::Error;
use tokio;

#[derive(Serialize, Deserialize, Clone)]
pub struct Task {
    pub task: String,
    pub status: String,
    pub remarks: String,
    pub task_id: Option<String>,      // 任务编号
    pub task_name: Option<String>,    // 任务名称
    pub plan_start_time: Option<String>, // 计划开始时间
    pub plan_end_time: Option<String>,   // 计划结束时间
    pub actual_start_time: Option<String>, // 实际开始时间
    pub actual_end_time: Option<String>,   // 实际结束时间
    pub plan_hours: Option<String>,        // 计划工时
    pub actual_hours: Option<String>,      // 实际工时
}

#[derive(Serialize, Deserialize)]
pub struct ReportTemplate {
    pub tasks: Vec<Task>,
    pub next_week_plan: String,
    pub column_indices: std::collections::HashMap<String, usize>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DailyReport {
    pub id: Option<i64>,
    pub date: String,
    pub task_id: Option<String>,
    pub task_name: Option<String>,
    pub should_complete: String,
    pub completed: String,
    pub uncompleted: String,
    pub plan_hours: Option<String>,
    pub actual_hours: Option<String>,
    pub remarks: String,
}

#[derive(Serialize, Deserialize)]
pub struct UserInfo {
    pub position: String,
    pub department: String,
    pub name: String,
    pub date: String, // 格式：2024-04
}

// Supabase 配置
const SUPABASE_URL: &str = "https://bvhdzrqukpvltlrjgjoe.supabase.co";
const SUPABASE_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aGR6cnF1a3B2bHRscmpnam9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDM3MDksImV4cCI6MjA2MjExOTcwOX0.7D5nkvbRdxXltw2aPlRClwteQI2mtFTzHLgaw8HdOTg";

pub fn init_db() -> Result<Connection> {
    let conn = Connection::open("daily.db")?;

    // 检查表结构是否有UNIQUE约束
    let mut need_migrate = false;
    {
        let pragma = conn.prepare("PRAGMA table_info(dailies)");
        if let Ok(mut stmt) = pragma {
            let columns: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap_or_default();
            if columns.contains(&"date".to_string()) {
                // 检查UNIQUE约束
                let idx: i64 = conn
                    .prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='dailies' AND sql LIKE '%UNIQUE%'")
                    .unwrap()
                    .query_row([], |row| row.get(0))
                    .unwrap_or(0);
                if idx > 0 {
                    need_migrate = true;
                }
            }
        }
    }

    if need_migrate {
        // 1. 备份旧数据
        let mut old_rows = Vec::new();
        {
            let mut stmt = conn.prepare("SELECT date, content, should, done, undone FROM dailies").unwrap();
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1).ok(),
                        row.get::<_, String>(2).ok(),
                        row.get::<_, String>(3).ok(),
                        row.get::<_, String>(4).ok(),
                    ))
                })
                .unwrap();
            for row in rows {
                let (date, content, should, done, undone) = row.unwrap();
                old_rows.push((date, content, should, done, undone));
            }
        }
        // 2. 删除原表
        conn.execute("DROP TABLE dailies", []).unwrap();
        // 3. 创建新表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS dailies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                content TEXT,
                should TEXT,
                done TEXT,
                undone TEXT
            )",
            [],
        )?;
        // 4. 导入旧数据
        for (date, content, should, done, undone) in old_rows {
            conn.execute(
                "INSERT INTO dailies (date, content, should, done, undone) VALUES (?1, ?2, ?3, ?4, ?5)",
                [
                    &date,
                    &content.unwrap_or_default(), // 这是remarks字段
                    &should.unwrap_or_default(),  // 这是should_complete字段
                    &done.unwrap_or_default(),    // 这是completed字段
                    &undone.unwrap_or_default(),  // 这是uncompleted字段
                ],
            ).unwrap();
        }
    } else {
        // 新表结构直接创建
        conn.execute(
            "CREATE TABLE IF NOT EXISTS dailies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                content TEXT,
                should TEXT,
                done TEXT,
                undone TEXT
            )",
            [],
        )?;
    }

    // 自动补字段（防止老库升级）
    {
        let columns = conn.prepare("PRAGMA table_info(dailies)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        if !columns.contains(&"should".to_string()) {
            conn.execute("ALTER TABLE dailies ADD COLUMN should TEXT", [])?;
        }
        if !columns.contains(&"done".to_string()) {
            conn.execute("ALTER TABLE dailies ADD COLUMN done TEXT", [])?;
        }
        if !columns.contains(&"undone".to_string()) {
            conn.execute("ALTER TABLE dailies ADD COLUMN undone TEXT", [])?;
        }
        if !columns.contains(&"content".to_string()) {
            conn.execute("ALTER TABLE dailies ADD COLUMN content TEXT", [])?;
        }
    }
    
    // 添加：检查数据对应关系，进行字段修正
    fix_field_mapping(&conn)?;
    
    Ok(conn)
}

// 修正数据库中字段映射错误的问题
fn fix_field_mapping(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 检查是否需要修正
    let needs_fix = conn.query_row(
        "SELECT COUNT(*) FROM dailies WHERE content IS NULL AND should IS NOT NULL LIMIT 1", 
        [], 
        |row| row.get::<_, i64>(0)
    ).unwrap_or(0) > 0;
    
    if needs_fix {
        // 获取所有需要修正的记录
        let mut stmt = conn.prepare(
            "SELECT id, date, content, should, done, undone FROM dailies WHERE content IS NULL AND should IS NOT NULL"
        )?;
        
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2).unwrap_or_default(),
                row.get::<_, Option<String>>(3).unwrap_or_default(),
                row.get::<_, Option<String>>(4).unwrap_or_default(),
                row.get::<_, Option<String>>(5).unwrap_or_default(),
            ))
        })?;
        
        // 修正映射关系：remarks(content) <-> should_complete(should)
        for result in rows {
            if let Ok((id, _, content, should, done, undone)) = result {
                conn.execute(
                    "UPDATE dailies SET content = ?1, should = ?2, done = ?3, undone = ?4 WHERE id = ?5",
                    [
                        &should, // should变为content(remarks)
                        &content, // content变为should(should_complete)
                        &done,
                        &undone,
                        &Some(id.to_string()),
                    ],
                )?;
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn save_daily(
    date: String,
    content: String,
    should: String,
    done: String,
    undone: String
) -> Result<String, String> {
    let report = DailyReport {
        id: None,
        date,
        task_id: None,
        task_name: None,
        should_complete: should,
        completed: done,
        uncompleted: undone,
        plan_hours: None,
        actual_hours: None,
        remarks: content,
    };
    
    // 先保存到本地SQLite，确保数据不会丢失
    let local_result = match save_daily_report_to_sqlite(&report) {
        Ok(_) => "本地保存成功".to_string(),
        Err(e) => {
            eprintln!("保存到SQLite失败: {}", e);
            format!("本地保存失败: {}", e)
        }
    };
    
    // 然后尝试保存到Supabase，无论结果如何都返回消息而不是错误
    let remote_result = match save_daily_to_supabase(&report).await {
        Ok(_) => "远程保存成功".to_string(),
        Err(e) => {
            eprintln!("保存到Supabase时出错: {}", e);
            format!("远程保存失败: {}", e)
        }
    };
    
    // 返回完整的状态信息，而不是错误
    Ok(format!("{}，{}", local_result, remote_result))
}

// 添加缺失的函数实现
fn save_daily_report_to_sqlite(report: &DailyReport) -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO dailies (date, content, should, done, undone) VALUES (?1, ?2, ?3, ?4, ?5)",
        [
            &report.date,
            &report.remarks,
            &report.should_complete,
            &report.completed,
            &report.uncompleted,
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub async fn save_daily_to_supabase(report: &DailyReport) -> Result<(), String> {
    eprintln!("开始保存数据到Supabase");
    
    // 验证日期格式
    if report.date.is_empty() {
        return Err("日期不能为空".to_string());
    }
    
    // 检查日期格式是否正确（yyyy-mm-dd）
    if !report.date.contains('-') || report.date.len() != 10 {
        return Err(format!("日期格式不正确: {}, 应为YYYY-MM-DD格式", report.date));
    }
    
    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(30)) // 增加超时时间到30秒
        .build() {
        Ok(client) => client,
        Err(e) => {
            eprintln!("创建HTTP客户端失败: {}", e);
            return Err(format!("创建HTTP客户端失败: {}", e));
        }
    };
    
    // 先检查是否已存在该日期的记录
    let check_url = format!("{}/rest/v1/dailies?date=eq.{}&select=id", SUPABASE_URL, report.date);
    eprintln!("检查日报是否存在: {}", check_url);
    
    let existing_report = match client
        .get(&check_url)
        .header("apikey", SUPABASE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
        .header("Content-Type", "application/json")
        .send()
        .await {
            Ok(res) => {
                if res.status().is_success() {
                    match res.json::<Vec<serde_json::Value>>().await {
                        Ok(reports) => !reports.is_empty(),
                        Err(_) => false
                    }
                } else {
                    false
                }
            },
            Err(_) => false
        };
    
    let base_url = format!("{}/rest/v1/dailies", SUPABASE_URL);
    let method = if existing_report { 
        "PATCH" 
    } else { 
        "POST" 
    };
    
    let url = if existing_report {
        format!("{}?date=eq.{}", base_url, report.date)
    } else {
        base_url
    };
    
    eprintln!("使用{}方法保存到URL: {}", method, url);
    
    // 创建一个新的JSON对象，确保包含所有必要字段
    let mut report_json = serde_json::json!({
        "date": report.date,
        "task_id": report.task_id,
        "task_name": report.task_name,
        "should_complete": report.should_complete,
        "completed": report.completed,
        "uncompleted": report.uncompleted,
        "plan_hours": report.plan_hours,
        "actual_hours": report.actual_hours,
        "remarks": report.remarks
    });
    
    // 如果是UPDATE操作，不要包含id字段
    // 如果是INSERT操作，设置一个id值（Supabase会忽略并使用自己的序列）
    if !existing_report {
        // 为新增设置一个临时ID，服务端会替换它
        report_json["id"] = serde_json::json!(1);
    }
    
    // 最多尝试3次
    for attempt in 1..=3 {
        eprintln!("尝试连接 (第{}次)...", attempt);
        
        // 根据是新增还是更新选择不同的HTTP方法
        let request = if existing_report {
            client.patch(&url)
        } else {
            client.post(&url)
        };
        
        // 设置通用请求头和JSON数据
        let _response = match request
            .header("apikey", SUPABASE_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal") // 不返回内容以提高性能
            .json(&report_json) // 使用我们构建的JSON而不是直接使用report
            .send()
            .await {
                Ok(res) => {
                    eprintln!("请求发送成功，状态码: {}", res.status());
                    if !res.status().is_success() {
                        let status = res.status();
                        let error_text = match res.text().await {
                            Ok(text) => text,
                            Err(_) => "无法读取错误详情".to_string()
                        };
                        let error_msg = format!("Supabase保存失败: 状态码 {}, 错误: {}", status, error_text);
                        eprintln!("{}", error_msg);
                        
                        // 如果是服务器错误并且不是最后一次尝试，则继续重试
                        if status.as_u16() >= 500 && attempt < 3 {
                            eprintln!("服务器错误，等待1秒后重试...");
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            continue;
                        }
                        
                        return Err(error_msg);
                    } else {
                        eprintln!("数据{}到Supabase成功", if existing_report { "更新" } else { "保存" });
                        return Ok(());
                    }
                },
                Err(e) => {
                    eprintln!("Supabase请求失败 (尝试 {}/3): {}", attempt, e);
                    if let Some(source) = e.source() {
                        eprintln!("错误源: {}", source);
                    }
                    if e.is_timeout() {
                        eprintln!("请求超时");
                    }
                    if e.is_connect() {
                        eprintln!("连接失败");
                    }
                    if e.is_request() {
                        eprintln!("请求构建失败");
                    }
                    
                    // 如果不是最后一次尝试，则等待一秒后重试
                    if attempt < 3 {
                        eprintln!("等待1秒后重试...");
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    
                    return Err(format!("网络请求失败: {}", e));
                }
            };
    }
    
    Err("超过最大重试次数".to_string())
}

#[tauri::command]
pub fn auto_generate_weekly() -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT date, content, should, done, undone FROM dailies WHERE date >= date('now', '-7 days') ORDER BY date ASC, id ASC"
    ).map_err(|e| e.to_string())?;

    let template = std::fs::read_to_string("template.md").unwrap_or("{{date}}\n应完成：{{should}}\n已完成：{{done}}\n未完成：{{undone}}\n".to_string());
    let mut handlebars = Handlebars::new();
    handlebars
        .register_template_string("tpl", template)
        .map_err(|e| e.to_string())?;

    let mut weekly = String::new();
    let rows = stmt
        .query_map([], |row| {
            let date: String = row.get(0)?;
            let _content: Option<String> = row.get(1)?;  // 备注
            let should: Option<String> = row.get(2)?;   // 应完成
            let done: Option<String> = row.get(3)?;     // 已完成
            let undone: Option<String> = row.get(4)?;   // 未完成
            Ok((
                date,
                should.unwrap_or_default(),
                done.unwrap_or_default(),
                undone.unwrap_or_default()
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (date, should, done, undone) = row.map_err(|e| e.to_string())?;
        let data = serde_json::json!({
            "date": date,
            "should": should,
            "done": done,
            "undone": undone
        });
        let rendered = handlebars.render("tpl", &data).map_err(|e| e.to_string())?;
        weekly.push_str(&rendered);
        weekly.push_str("\n\n");
    }

    std::fs::write("weekly.md", weekly).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

pub fn start_weekly_timer() {
    thread::spawn(|| {
        loop {
            // 每周日凌晨1点自动生成周报
            let now = chrono::Local::now();
            if now.weekday() == chrono::Weekday::Sun && now.hour() == 1 && now.minute() == 0 {
                let _ = auto_generate_weekly();
            }
            thread::sleep(Duration::from_secs(60)); // 每分钟检查一次
        }
    });
}

#[tauri::command]
pub fn save_template(content: String) -> Result<(), String> {
    std::fs::write("template.md", content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_template() -> Result<String, String> {
    std::fs::read_to_string("template.md").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn render_daily_with_template(
    date: String,
    should: String,
    done: String,
    undone: String
) -> Result<String, String> {
    let template = std::fs::read_to_string("template.md").map_err(|e| e.to_string())?;
    let mut handlebars = Handlebars::new();
    handlebars
        .register_template_string("tpl", template)
        .map_err(|e| e.to_string())?;
    let data = serde_json::json!({
        "date": date,
        "should": should,
        "done": done,
        "undone": undone
    });
    handlebars.render("tpl", &data).map_err(|e| e.to_string())
}

#[tauri::command]
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
    let mut col_indices = std::collections::HashMap::new();
    
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

#[tauri::command]
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

#[tauri::command]
pub fn save_report_template(tasks: Vec<Task>, next_week_plan: String) -> Result<(), String> {
    let template = ReportTemplate {
        tasks,
        next_week_plan,
        column_indices: std::collections::HashMap::new(),
    };
    
    let json = serde_json::to_string_pretty(&template)
        .map_err(|e| format!("序列化模板失败: {}", e))?;
    
    fs::write("report_template.json", json)
        .map_err(|e| format!("保存模板失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn load_report_template() -> Result<ReportTemplate, String> {
    let json = fs::read_to_string("report_template.json")
        .map_err(|e| format!("读取模板失败: {}", e))?;
    
    serde_json::from_str(&json)
        .map_err(|e| format!("解析模板失败: {}", e))
}

#[tauri::command]
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

#[tauri::command]
pub fn generate_weekly_from_daily(start_date: String, end_date: String) -> Result<ReportTemplate, String> {
    // 连接数据库
    let conn = init_db().map_err(|e| e.to_string())?;
    
    // 查询指定日期范围内的日报
    let mut stmt = conn.prepare(
        "SELECT id, date, content, should, done, undone FROM dailies WHERE date BETWEEN ?1 AND ?2 ORDER BY date ASC"
    ).map_err(|e| e.to_string())?;
    
    // 执行查询
    let daily_rows = stmt.query_map([&start_date, &end_date], |row| {
        Ok(DailyReport {
            id: row.get(0)?,
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
    let mut daily_reports: Vec<DailyReport> = Vec::new();
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
        column_indices: std::collections::HashMap::new(),
    })
}

// 辅助函数：从日报中提取任务
fn extract_tasks_from_daily(daily_reports: &[DailyReport]) -> Result<Vec<Task>, String> {
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

// 辅助函数：从文本中提取任务项（按行分割）
fn extract_task_items(text: &str) -> Vec<String> {
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

// 添加保存日报的函数
#[tauri::command]
pub async fn save_daily_report(report: DailyReport) -> Result<String, String> {
    // 只使用Supabase，完全跳过SQLite
    match save_daily_to_supabase(&report).await {
        Ok(_) => Ok("保存成功".to_string()),
        Err(e) => {
            eprintln!("保存到Supabase失败: {}", e);
            Err(format!("保存失败: {}", e))
        }
    }
}

// 获取最近的日报列表
#[tauri::command]
pub async fn get_recent_daily_reports() -> Result<Vec<DailyReport>, String> {
    get_dailies_from_supabase().await
}

pub async fn get_dailies_from_supabase() -> Result<Vec<DailyReport>, String> {
    eprintln!("开始从Supabase获取数据");
    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(30)) // 增加超时时间到30秒
        .build() {
        Ok(client) => client,
        Err(e) => {
            eprintln!("创建HTTP客户端失败: {}", e);
            // 返回空列表而不是直接失败
            return Ok(Vec::new());
        }
    };
    
    let url = format!("{}/rest/v1/dailies?select=*&order=date.desc&limit=10", SUPABASE_URL);
    eprintln!("请求URL: {}", url);
    
    // 最多尝试3次
    for attempt in 1..=3 {
        eprintln!("尝试连接 (第{}次)...", attempt);
        match client
            .get(&url)
            .header("apikey", SUPABASE_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
            .header("Content-Type", "application/json")
            .send()
            .await {
                Ok(res) => {
                    eprintln!("请求成功，状态码: {}", res.status());
                    if res.status().is_success() {
                        match res.json().await {
                            Ok(reports) => {
                                eprintln!("解析JSON成功");
                                return Ok(reports);
                            },
                            Err(e) => {
                                eprintln!("解析Supabase响应失败: {}", e);
                                return Ok(Vec::new());
                            }
                        }
                    } else {
                        let status = res.status();
                        let error_text = match res.text().await {
                            Ok(text) => text,
                            Err(_) => "无法读取错误详情".to_string()
                        };
                        eprintln!("Supabase查询失败: 状态码 {}, 错误: {}", status, error_text);
                        return Ok(Vec::new());
                    }
                },
                Err(e) => {
                    eprintln!("Supabase网络请求失败 (尝试 {}/3): {}", attempt, e);
                    if let Some(source) = e.source() {
                        eprintln!("错误源: {}", source);
                    }
                    if e.is_timeout() {
                        eprintln!("请求超时");
                    }
                    if e.is_connect() {
                        eprintln!("连接失败");
                    }
                    if e.is_request() {
                        eprintln!("请求构建失败");
                    }
                    
                    // 如果不是最后一次尝试，则等待一秒后重试
                    if attempt < 3 {
                        eprintln!("等待1秒后重试...");
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    
                    // 已尝试多次，返回空列表
                    return Ok(Vec::new());
                }
            }
    }
    
    // 不应该到达这里，但为了编译器而添加
    Ok(Vec::new())
}

// 获取指定日期的日报
#[tauri::command]
pub async fn get_daily_report_by_date(date: String) -> Result<DailyReport, String> {
    // 直接从Supabase获取，跳过SQLite
    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build() {
        Ok(client) => client,
        Err(e) => {
            return Err(format!("创建HTTP客户端失败: {}", e));
        }
    };
    
    let url = format!("{}/rest/v1/dailies?date=eq.{}&select=*", SUPABASE_URL, date);
    eprintln!("获取日报请求URL: {}", url);
    
    // 最多尝试3次
    for attempt in 1..=3 {
        eprintln!("尝试获取日报 (第{}次)...", attempt);
        
        match client
            .get(&url)
            .header("apikey", SUPABASE_KEY)
            .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
            .header("Content-Type", "application/json")
            .send()
            .await {
                Ok(res) => {
                    if res.status().is_success() {
                        match res.json::<Vec<DailyReport>>().await {
                            Ok(mut reports) => {
                                if let Some(report) = reports.pop() {
                                    return Ok(report);
                                } else {
                                    return Err("未找到日报".to_string());
                                }
                            },
                            Err(e) => return Err(format!("解析响应失败: {}", e))
                        }
                    } else {
                        let status = res.status();
                        if status.as_u16() == 404 {
                            return Err("未找到日报".to_string());
                        } else {
                            let error_text = match res.text().await {
                                Ok(text) => text,
                                Err(_) => "无法读取错误详情".to_string()
                            };
                            eprintln!("查询日报失败: 状态码 {}, 错误: {}", status, error_text);
                            
                            if attempt < 3 && status.as_u16() >= 500 {
                                eprintln!("服务器错误，等待1秒后重试...");
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                                continue;
                            }
                            
                            return Err(format!("查询失败: HTTP状态码 {}", status));
                        }
                    }
                },
                Err(e) => {
                    eprintln!("获取日报网络请求失败 (尝试 {}/3): {}", attempt, e);
                    if let Some(source) = e.source() {
                        eprintln!("错误源: {}", source);
                    }
                    
                    if attempt < 3 {
                        eprintln!("等待1秒后重试...");
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    
                    return Err(format!("网络请求失败: {}", e));
                }
            }
    }
    
    Err("超过最大重试次数".to_string())
}

#[tauri::command]
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
    let mut col_map = std::collections::HashMap::new();
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

#[tauri::command]
pub fn generate_monthly_report(
    _app_handle: tauri::AppHandle,
    template_path: String,
    output_path: String,
    year_month: String, // 例如 "2024-04"
    user_info: UserInfo,
) -> Result<(), String> {
    use umya_spreadsheet::{reader, writer};

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

#[tauri::command]
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

#[tauri::command]
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

#[tauri::command]
pub async fn test_supabase_connection() -> Result<String, String> {
    eprintln!("开始测试Supabase连接");
    
    // 1. 创建HTTP客户端
    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build() {
        Ok(client) => client,
        Err(e) => {
            let error_msg = format!("创建HTTP客户端失败: {}", e);
            eprintln!("{}", error_msg);
            return Err(error_msg);
        }
    };
    
    // 2. 构建简单的测试请求
    let url = format!("{}/rest/v1/dailies?limit=1", SUPABASE_URL);
    eprintln!("测试请求URL: {}", url);
    
    // 3. 发送请求
    match client
        .get(&url)
        .header("apikey", SUPABASE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
        .send()
        .await {
            Ok(res) => {
                let status = res.status();
                eprintln!("测试请求成功，状态码: {}", status);
                
                if status.is_success() {
                    Ok(format!("连接成功! 状态码: {}", status))
                } else {
                    let body = match res.text().await {
                        Ok(text) => text,
                        Err(_) => "无法读取响应内容".to_string()
                    };
                    Err(format!("Supabase连接失败，状态码: {}，响应: {}", status, body))
                }
            },
            Err(e) => {
                let error_msg = format!("Supabase连接测试失败: {}", e);
                eprintln!("{}", error_msg);
                
                // 提供更多诊断信息
                if e.is_timeout() {
                    eprintln!("错误是超时导致的");
                }
                if e.is_connect() {
                    eprintln!("错误是连接问题导致的");
                }
                
                Err(error_msg)
            }
        }
} 