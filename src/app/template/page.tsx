"use client"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

export default function TemplatePage() {
    const [template, setTemplate] = useState("")
    const [status, setStatus] = useState("")
    const [preview, setPreview] = useState("")
    const [should, setShould] = useState("")
    const [done, setDone] = useState("")
    const [undone, setUndone] = useState("")

    useEffect(() => {
        invoke<string>("read_template")
            .then(setTemplate)
            .catch(() => setTemplate("今天应完成：{{should}}\n今天已完成：{{done}}\n今天没完成：{{undone}}"))
    }, [])

    const save = async () => {
        try {
            await invoke("save_template", { content: template })
            setStatus("模板保存成功！")
        } catch (e) {
            setStatus("保存失败：" + e)
        }
    }

    const renderPreview = async () => {
        try {
            const today = new Date().toISOString().slice(0, 10)
            const result = await invoke<string>("render_daily_with_template", {
                date: today,
                should,
                done,
                undone
            })
            setPreview(result)
        } catch (e) {
            setPreview("渲染失败：" + e)
        }
    }

    return (
        <div className="card">
            <h2>模板管理</h2>
            <textarea
                rows={8}
                style={{ width: "100%", marginBottom: 16 }}
                value={template}
                onChange={e => setTemplate(e.target.value)}
                placeholder="请输入模板内容，如：今天应完成：{{should}}\n今天已完成：{{done}}\n今天没完成：{{undone}}"
            />
            <div style={{ marginBottom: 16 }}>
                <input
                    type="text"
                    placeholder="今天应完成"
                    value={should}
                    onChange={e => setShould(e.target.value)}
                    style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
                />
                <input
                    type="text"
                    placeholder="今天已完成"
                    value={done}
                    onChange={e => setDone(e.target.value)}
                    style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
                />
                <input
                    type="text"
                    placeholder="今天没完成"
                    value={undone}
                    onChange={e => setUndone(e.target.value)}
                    style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
                />
            </div>
            <button className="primary-btn" onClick={save}>保存模板</button>
            <button className="primary-btn" style={{ marginLeft: 12 }} onClick={renderPreview}>预览渲染</button>
            <div style={{ marginTop: 16, color: status.includes("成功") ? "green" : "red" }}>{status}</div>
            <pre style={{ marginTop: 24, background: "#f8f8f8", padding: 16, borderRadius: 8, minHeight: 80 }}>{preview}</pre>
        </div>
    )
}
