"use client"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

interface DailyReport {
    id?: number
    date: string
    task_id?: string
    task_name?: string
    should_complete: string
    completed: string
    uncompleted: string
    plan_hours?: string
    actual_hours?: string
    remarks: string
}

export default function DailyPage() {
    const [date, setDate] = useState<string>("")
    const [shouldComplete, setShouldComplete] = useState<string>("")
    const [completed, setCompleted] = useState<string>("")
    const [uncompleted, setUncompleted] = useState<string>("")
    const [remarks, setRemarks] = useState<string>("")
    const [taskId, setTaskId] = useState<string>("")
    const [taskName, setTaskName] = useState<string>("")
    const [planHours, setPlanHours] = useState<string>("8")
    const [actualHours, setActualHours] = useState<string>("8")

    const [status, setStatus] = useState<string>("")
    const [recentReports, setRecentReports] = useState<DailyReport[]>([])

    // 初始化日期为今天
    useEffect(() => {
        const now = new Date()
        setDate(now.toISOString().split('T')[0])
        loadRecentReports()
    }, [])

    // 加载最近的日报
    const loadRecentReports = async () => {
        try {
            const reports = await invoke<DailyReport[]>("get_recent_daily_reports")
            setRecentReports(reports)
        } catch (error) {
            console.error("加载日报失败:", error)
            setStatus("加载日报失败")
        }
    }

    // 加载指定日期的日报
    const loadDailyReport = async (selectedDate: string) => {
        try {
            setStatus("正在加载...")
            const report = await invoke<DailyReport>("get_daily_report_by_date", {
                date: selectedDate
            })

            // 确保所有值不为null
            setDate(report.date || selectedDate)
            setShouldComplete(report.should_complete || "")
            setCompleted(report.completed || "")
            setUncompleted(report.uncompleted || "")
            setRemarks(report.remarks || "")
            setTaskId(report.task_id || "")
            setTaskName(report.task_name || "")
            setPlanHours(report.plan_hours || "8")
            setActualHours(report.actual_hours || "8")

            setStatus("日报加载成功")
        } catch (error) {
            console.error("加载日报失败:", error)
            // 如果是新日期，则清空表单
            clearForm()
            setStatus("新建日报")
        }
    }

    // 清空表单
    const clearForm = () => {
        setShouldComplete("")
        setCompleted("")
        setUncompleted("")
        setRemarks("")
        setTaskId("")
        setTaskName("")
        setPlanHours("8")
        setActualHours("8")
    }

    // 保存日报
    const saveDailyReport = async () => {
        if (!date) {
            setStatus("请选择日期")
            return
        }

        try {
            setStatus("正在保存...")
            const report: DailyReport = {
                date,
                task_id: taskId || '',
                task_name: taskName || '',
                should_complete: shouldComplete || '',
                completed: completed || '',
                uncompleted: uncompleted || '',
                plan_hours: planHours || '8',
                actual_hours: actualHours || '8',
                remarks: remarks || ''
            }

            await invoke("save_daily_report", { report })
            setStatus("日报保存成功")
            loadRecentReports()
        } catch (error) {
            console.error("保存日报失败:", error)
            setStatus(`保存失败: ${error}`)
        }
    }

    // 从日报快速生成周报
    const generateWeeklyFromDaily = async () => {
        // 获取当前日期所在的周一和周五
        const currentDate = new Date(date)
        const day = currentDate.getDay() || 7
        const mondayDate = new Date(currentDate)
        mondayDate.setDate(currentDate.getDate() - day + 1)

        const fridayDate = new Date(currentDate)
        fridayDate.setDate(currentDate.getDate() - day + 5)

        const startDate = mondayDate.toISOString().split('T')[0]
        const endDate = fridayDate.toISOString().split('T')[0]

        try {
            setStatus("正在生成周报...")
            // 调用后端函数从日报生成周报
            await invoke("generate_weekly_from_daily", { startDate, endDate })
            setStatus("周报生成成功，请前往周报页面查看")
        } catch (error) {
            console.error("生成周报失败:", error)
            setStatus(`生成周报失败: ${error}`)
        }
    }

    // 日期变更时加载对应日报
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value
        setDate(newDate)
        loadDailyReport(newDate)
    }

    return (
        <div className="card">
            <h2>日报管理
                <span className="help-tooltip">
                    <span className="help-tooltip-icon">?</span>
                    <span className="help-tooltip-text">
                        记录每日工作内容，系统将自动根据日报生成周报。
                        记录当天应完成的任务、已完成任务和未完成任务，将自动整合到周报中。
                    </span>
                </span>
            </h2>

            {/* 日期选择 */}
            <div style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">选择日期</label>
                <input
                    type="date"
                    value={date}
                    onChange={handleDateChange}
                    className="form-input"
                />
            </div>

            {/* 日报内容 */}
            <div className="task-field-group">
                <div className="task-meta-field">
                    <label className="form-label">任务编号</label>
                    <input
                        type="text"
                        value={taskId}
                        onChange={(e) => setTaskId(e.target.value)}
                        className="form-input task-id-field"
                        placeholder="选填"
                    />
                </div>
                <div className="task-flex-field">
                    <label className="form-label">任务名称</label>
                    <input
                        type="text"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        className="form-input"
                        placeholder="选填"
                    />
                </div>
            </div>

            <div className="task-field-group">
                <div className="task-meta-field">
                    <label className="form-label">计划工时</label>
                    <input
                        type="text"
                        value={planHours}
                        onChange={(e) => setPlanHours(e.target.value)}
                        className="form-input"
                    />
                </div>
                <div className="task-meta-field">
                    <label className="form-label">实际工时</label>
                    <input
                        type="text"
                        value={actualHours}
                        onChange={(e) => setActualHours(e.target.value)}
                        className="form-input"
                    />
                </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">今日应完成事项</label>
                <textarea
                    value={shouldComplete}
                    onChange={(e) => setShouldComplete(e.target.value)}
                    className="form-input"
                    placeholder="今日计划完成的工作项，每行一项"
                    style={{ minHeight: "100px" }}
                ></textarea>
            </div>

            <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">今日已完成事项</label>
                <textarea
                    value={completed}
                    onChange={(e) => setCompleted(e.target.value)}
                    className="form-input"
                    placeholder="今日实际完成的工作项，每行一项"
                    style={{ minHeight: "100px" }}
                ></textarea>
            </div>

            <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">今日未完成事项</label>
                <textarea
                    value={uncompleted}
                    onChange={(e) => setUncompleted(e.target.value)}
                    className="form-input"
                    placeholder="今日未完成的工作项及原因，每行一项"
                    style={{ minHeight: "100px" }}
                ></textarea>
            </div>

            <div style={{ marginBottom: "1rem" }}>
                <label className="form-label">备注</label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="form-input"
                    placeholder="其他需要说明的事项"
                    style={{ minHeight: "60px" }}
                ></textarea>
            </div>

            {/* 操作按钮 */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                    className="primary-btn"
                    onClick={saveDailyReport}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                    }}
                >
                    <span style={{ fontSize: "1.2rem" }}>💾</span> 保存日报
                </button>
                <button
                    className="secondary-btn"
                    onClick={clearForm}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                    }}
                >
                    <span style={{ fontSize: "1.2rem" }}>🗑️</span> 清空表单
                </button>
                <button
                    className="secondary-btn"
                    onClick={generateWeeklyFromDaily}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                    }}
                >
                    <span style={{ fontSize: "1.2rem" }}>📊</span> 生成周报
                </button>
            </div>

            {/* 状态信息 */}
            {status && (
                <div className={`status-message ${status.includes('失败') || status.includes('错误') ? 'status-error' : 'status-success'}`}>
                    {status}
                </div>
            )}

            {/* 最近日报列表 */}
            {recentReports.length > 0 && (
                <div style={{ marginTop: "2rem" }}>
                    <h3>最近的日报</h3>
                    <div className="recent-reports">
                        {recentReports.map((report, index) => (
                            <div
                                key={index}
                                className="recent-report-item"
                                onClick={() => loadDailyReport(report.date)}
                            >
                                <div className="recent-report-date">{report.date}</div>
                                <div className="recent-report-content">
                                    已完成: {report.completed.split('\n').length} 项
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
} 