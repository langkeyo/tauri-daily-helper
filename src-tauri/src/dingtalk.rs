use reqwest::blocking::Client;

#[tauri::command]
pub fn send_to_dingtalk(token: String, content: String) -> Result<(), String> {
    let url = format!("https://oapi.dingtalk.com/robot/send?access_token={}", token);
    let client = Client::new();
    let res = client.post(&url)
        .json(&serde_json::json!({
            "msgtype": "text",
            "text": { "content": content }
        }))
        .send()
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok(())
    } else {
        Err("Failed to send message".into())
    }
} 