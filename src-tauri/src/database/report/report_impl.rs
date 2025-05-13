use std::{thread, time::Duration};
use handlebars::Handlebars;
use chrono::{Datelike, Timelike};
use std::fs;
use crate::database::sqlite::{init_db, save_daily_report_to_sqlite};
use crate::database::types::DailyReport;

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

pub fn save_template(content: String) -> Result<(), String> {
    std::fs::write("template.md", content).map_err(|e| e.to_string())
}

pub fn read_template() -> Result<String, String> {
    std::fs::read_to_string("template.md").map_err(|e| e.to_string())
}

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
