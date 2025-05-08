"use client"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

export default function DingtalkPage() {
    const [token, setToken] = useState("")
    const [content, setContent] = useState("")
    const [status, setStatus] = useState("")

    const send = async () => {
        try {
            await invoke("send_to_dingtalk", { token, content })
            setStatus("推送成功！")
        } catch (e) {
            setStatus("推送失败：" + e)
        }
    }

    // 可选：自动读取最新周报内容
    const loadWeekly = async () => {
        try {
            const weekly = await invoke<string>("read_text_file", { path: "weekly.md" })
            setContent(weekly)
        } catch { }
    }

    return (
        <div className="card">
            <h2>钉钉推送</h2>
            <div style={{ marginBottom: 16 }}>
                <input
                    type="text"
                    placeholder="钉钉机器人 token"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, border: "1px solid #ddd" }}
                />
                <button className="primary-btn" style={{ marginBottom: 8 }} onClick={loadWeekly}>自动填充为最新周报</button>
                <textarea
                    rows={8}
                    style={{ width: "100%", marginBottom: 16 }}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="请输入要推送的内容..."
                />
            </div>
            <button className="primary-btn" onClick={send}>推送到钉钉</button>
            <div style={{ marginTop: 16, color: status.includes("成功") ? "green" : "red" }}>{status}</div>
        </div>
    )
}
