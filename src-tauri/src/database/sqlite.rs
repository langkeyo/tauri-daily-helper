use rusqlite::{Connection, Result};
use crate::database::types::DailyReport;

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
                user_id TEXT,
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
                user_id TEXT,
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
        if !columns.contains(&"user_id".to_string()) {
            conn.execute("ALTER TABLE dailies ADD COLUMN user_id TEXT", [])?;
        }
    }
    
    // 添加：检查数据对应关系，进行字段修正
    fix_field_mapping(&conn)?;
    
    Ok(conn)
}

// 修正数据库中字段映射错误的问题
pub fn fix_field_mapping(conn: &Connection) -> Result<(), rusqlite::Error> {
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

// 添加缺失的函数实现
pub fn save_daily_report_to_sqlite(report: &DailyReport) -> Result<(), String> {
    let conn = init_db().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO dailies (user_id, date, content, should, done, undone) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        [
            &report.user_id.clone().unwrap_or_default(),
            &report.date,
            &report.remarks,
            &report.should_complete,
            &report.completed,
            &report.uncompleted,
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
