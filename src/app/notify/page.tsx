"use client"
import { sendNotification } from "@tauri-apps/plugin-notification"

export default function NotifyPage() {
    const handleNotify = () => {
        sendNotification({ title: "系统通知", body: "这是一条来自 Tauri 的系统通知！" })
    }

    return (
        <div className="card">
            <h2>系统通知演示</h2>
            <button className="primary-btn" onClick={handleNotify}>弹出系统通知</button>
        </div>
    )
}