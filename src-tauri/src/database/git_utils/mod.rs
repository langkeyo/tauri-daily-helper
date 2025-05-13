use std::process::Command;
use std::path::Path;

/// 获取指定仓库路径的Git未提交更改列表
/// 
/// # 参数
/// * `repo_path` - Git仓库所在的路径
/// 
/// # 返回值
/// * `Result<Vec<String>, String>` - 成功时返回未提交的文件更改列表，失败时返回错误信息
pub fn get_uncommitted_changes(repo_path: &str) -> Result<Vec<String>, String> {
    // 验证路径是否存在
    if !Path::new(repo_path).exists() {
        return Err(format!("路径不存在: {}", repo_path));
    }

    // 验证是否是git仓库
    let status_command = Command::new("git")
        .args(&["-C", repo_path, "rev-parse", "--is-inside-work-tree"])
        .output();
    
    match status_command {
        Ok(output) => {
            if !output.status.success() {
                return Err(format!("指定路径不是一个Git仓库: {}", repo_path));
            }
        },
        Err(e) => {
            return Err(format!("执行Git命令失败: {}", e));
        }
    }

    // 获取未暂存和已暂存的更改
    let git_status = Command::new("git")
        .args(&["-C", repo_path, "status", "--porcelain"])
        .output();

    match git_status {
        Ok(output) => {
            if !output.status.success() {
                return Err(format!("获取Git状态失败, 退出码: {}", output.status));
            }

            let output_str = String::from_utf8_lossy(&output.stdout);
            let changes: Vec<String> = output_str
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    // 提取文件名，忽略状态标志
                    let parts: Vec<&str> = line[3..].trim().split(" -> ").collect();
                    // 如果是重命名操作，使用新名称
                    parts.last().unwrap_or(&"").to_string()
                })
                .collect();

            if changes.is_empty() {
                return Ok(vec!["无未提交的更改".to_string()]);
            }

            Ok(changes)
        },
        Err(e) => {
            Err(format!("执行Git命令失败: {}", e))
        }
    }
}

/// 获取最后一次提交的信息
pub fn get_last_commit_info(repo_path: &str) -> Result<String, String> {
    // 验证路径是否存在
    if !Path::new(repo_path).exists() {
        return Err(format!("路径不存在: {}", repo_path));
    }

    // 获取最后一次提交信息
    let git_log = Command::new("git")
        .args(&["-C", repo_path, "log", "-1", "--pretty=format:%s"])
        .output();

    match git_log {
        Ok(output) => {
            if !output.status.success() {
                return Err(format!("获取Git日志失败, 退出码: {}", output.status));
            }

            let commit_msg = String::from_utf8_lossy(&output.stdout).to_string();
            if commit_msg.is_empty() {
                return Ok("无提交记录".to_string());
            }

            Ok(commit_msg)
        },
        Err(e) => {
            Err(format!("执行Git命令失败: {}", e))
        }
    }
}

/// 格式化Git未提交更改为日报格式
/// 
/// # 参数
/// * `repo_path` - Git仓库所在的路径
/// * `prefix` - 每一行的前缀，比如可以是"- "或者数字序号等
/// 
/// # 返回值
/// * `Result<String, String>` - 成功时返回格式化后的更改列表，失败时返回错误信息
pub fn format_git_changes_for_daily(repo_path: &str, prefix: &str) -> Result<String, String> {
    match get_uncommitted_changes(repo_path) {
        Ok(changes) => {
            // 格式化为带前缀的行，适合日报格式
            let formatted = changes
                .iter()
                .map(|change| format!("{}{}", prefix, change))
                .collect::<Vec<String>>()
                .join("\n");
            
            Ok(formatted)
        },
        Err(e) => Err(e)
    }
}

/// Tauri命令：获取Git未提交更改
pub fn get_git_changes(repo_path: &str, prefix: &str) -> Result<String, String> {
    format_git_changes_for_daily(repo_path, prefix)
}

/// Tauri命令：获取最后一次提交信息
pub fn get_git_last_commit(repo_path: &str) -> Result<String, String> {
    get_last_commit_info(repo_path)
}

/// 格式化Git更改输出
fn format_changes(changes: &str, prefix: &str, title: &str) -> String {
    if changes.trim().is_empty() {
        return String::new();
    }
    
    let mut result = format!("{}{}:\n", prefix, title);
    
    for line in changes.lines() {
        if line.trim().is_empty() {
            continue;
        }
        
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() < 2 {
            continue;
        }
        
        let status = parts[0];
        let file = parts[1];
        
        let status_text = match status {
            "M" => "修改",
            "A" => "新增",
            "D" => "删除",
            "R" => "重命名",
            "C" => "复制",
            "U" => "未合并",
            _ => "变更",
        };
        
        result.push_str(&format!("{}  {} {}\n", prefix, status_text, file));
    }
    
    result
} 