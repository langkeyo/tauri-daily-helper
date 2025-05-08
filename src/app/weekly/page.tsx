"use client"
import { useState, useRef, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import './weekly-modern.css'

// 定义Task接口类型
interface Task {
    date?: string
    task: string
    status: string
    remarks: string
    task_id: string | null
    task_name: string | null
    plan_start_time: string | null
    plan_end_time: string | null
    actual_start_time: string | null
    actual_hours: string | null
    plan_hours: string | null
    priority?: string | null
    quantitative?: string | null
}

interface DailyReport {
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

interface WeeklyReport {
    start_date: string
    end_date: string
    quantitative: string // 量化指标
    summary: string // 总结
    plan: string // 下周计划
}

function getMonday(date: Date) {
    const d = new Date(date)
    const day = d.getDay() || 7
    if (day !== 1) d.setDate(d.getDate() - day + 1)
    return d
}

function getSunday(date: Date) {
    const d = getMonday(date)
    d.setDate(d.getDate() + 6)
    return d
}

export default function WeeklyPage() {
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [tasks, setTasks] = useState<Task[]>([{
        task: "",
        status: "进行中",
        remarks: "",
        task_id: "",
        task_name: "",
        plan_start_time: "",
        plan_end_time: "",
        actual_start_time: "",
        actual_hours: "",
        plan_hours: "",
        priority: "",
        quantitative: ""
    }])
    const [nextWeekPlan, setNextWeekPlan] = useState("")
    const [status, setStatus] = useState("")
    const [hasTemplate, setHasTemplate] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)
    const today = new Date()
    const [dailyList, setDailyList] = useState<DailyReport[]>([])
    const [weekly, setWeekly] = useState<WeeklyReport>({
        start_date: getMonday(today).toISOString().slice(0, 10),
        end_date: getSunday(today).toISOString().slice(0, 10),
        quantitative: "",
        summary: "",
        plan: ""
    })

    // 初始化日期为本周
    useEffect(() => {
        const now = new Date()
        const day = now.getDay() || 7
        const mondayDate = new Date(now)
        mondayDate.setDate(now.getDate() - day + 1)

        const fridayDate = new Date(now)
        fridayDate.setDate(now.getDate() - day + 5)

        setStartDate(mondayDate.toISOString().split('T')[0])
        setEndDate(fridayDate.toISOString().split('T')[0])
    }, [])

    // 获取本周日报
    useEffect(() => {
        const fetchWeeklyDailies = async () => {
            try {
                const start = weekly.start_date
                const end = weekly.end_date
                // 假设有 get_dailies_by_range tauri 命令，否则用 get_recent_daily_reports 并手动过滤
                let dailies: DailyReport[] = []
                try {
                    dailies = await invoke<DailyReport[]>("get_dailies_by_range", { start, end })
                } catch {
                    // fallback: get_recent_daily_reports + 过滤
                    const all = await invoke<DailyReport[]>("get_recent_daily_reports")
                    dailies = all.filter(d => d.date >= start && d.date <= end)
                }
                setDailyList(dailies)
            } catch (e) {
                setStatus("加载本周日报失败: " + e)
            }
        }
        fetchWeeklyDailies()
    }, [weekly.start_date, weekly.end_date])

    // 添加任务行
    const addTask = () => {
        setTasks([...tasks, {
            task: "",
            status: "进行中",
            remarks: "",
            task_id: "",
            task_name: "",
            plan_start_time: "",
            plan_end_time: "",
            actual_start_time: "",
            actual_hours: "",
            plan_hours: "",
            priority: "",
            quantitative: ""
        }])
    }

    // 更新任务内容
    const updateTask = (index: number, field: string, value: string) => {
        const newTasks = [...tasks]
        newTasks[index] = { ...newTasks[index], [field]: value }
        setTasks(newTasks)
    }

    // 删除任务行
    const removeTask = (index: number) => {
        const newTasks = [...tasks]
        newTasks.splice(index, 1)
        setTasks(newTasks.length > 0 ? newTasks : [{
            task: "",
            status: "进行中",
            remarks: "",
            task_id: "",
            task_name: "",
            plan_start_time: "",
            plan_end_time: "",
            actual_start_time: "",
            actual_hours: "",
            plan_hours: "",
            priority: "",
            quantitative: ""
        }])
    }

    // 处理Excel模板文件
    const handleTemplateFile = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        try {
            setStatus("正在处理Excel模板...")
            const file = files[0]
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)

            // 调用Rust后端处理Excel文件
            const result = await invoke<{
                tasks: Task[],
                nextWeekPlan: string,
                column_indices: Record<string, number>
            }>("parse_excel_template", {
                excelData: Array.from(uint8Array)
            })

            if (result.tasks && result.tasks.length > 0) {
                setTasks(result.tasks)

                // 显示更详细的状态信息，包括识别到的列
                const columnInfo = Object.keys(result.column_indices)
                    .filter(k => k !== "header_row")
                    .map(k => k.replace(/_/g, " "))
                    .join(", ")

                setStatus(`成功从Excel中提取了${result.tasks.length}个任务项。识别到的列: ${columnInfo}`)
            } else {
                setStatus("未能从Excel中提取任务数据，请检查格式")
            }

            if (result.nextWeekPlan) {
                setNextWeekPlan(result.nextWeekPlan)
                setStatus(prev => prev + "，并找到了下周计划")
            }

            setHasTemplate(true)
        } catch (e) {
            console.error("Excel模板解析错误:", e)
            setStatus(`模板导入失败: ${e}`)
        }
    }

    // 导出为Excel
    const exportToExcel = async () => {
        if (!startDate || !endDate) {
            setStatus("请选择周报时间范围")
            return
        }

        try {
            setStatus("正在生成Excel...")
            // 准备周报数据
            const reportData = {
                startDate,
                endDate,
                tasks,
                nextWeekPlan
            }

            // 调用Rust后端生成Excel
            await invoke("generate_excel_report", reportData)
            setStatus("周报已成功导出! 保留了原始表格格式，包括任务时间、工时等详细信息。")
        } catch (e) {
            console.error("导出失败:", e)
            setStatus(`导出失败: ${e}`)
        }
    }

    // 保存当前内容为模板
    const saveAsTemplate = async () => {
        try {
            await invoke("save_report_template", {
                tasks,
                nextWeekPlan
            })
            setStatus("模板保存成功！")
        } catch (e) {
            setStatus("模板保存失败: " + e)
        }
    }

    // 加载保存的模板
    const loadSavedTemplate = async () => {
        try {
            setStatus("正在加载模板...")
            const result = await invoke<{
                tasks: Task[],
                nextWeekPlan: string
            }>("load_report_template")

            if (result.tasks && result.tasks.length > 0) {
                setTasks(result.tasks)
            }
            if (result.nextWeekPlan) {
                setNextWeekPlan(result.nextWeekPlan)
            }

            setHasTemplate(true)
            setStatus("模板加载成功!")
        } catch (e) {
            setStatus("加载模板失败: " + e)
        }
    }

    // 从日报自动生成周报
    const generateFromDaily = async () => {
        if (!startDate || !endDate) {
            setStatus("请选择周报时间范围")
            return
        }

        try {
            setStatus("正在从日报生成周报...")
            // 调用Rust后端从日报生成周报
            const result = await invoke<{
                tasks: Task[],
                nextWeekPlan: string
            }>("generate_weekly_from_daily", {
                startDate,
                endDate
            })

            if (result.tasks && result.tasks.length > 0) {
                setTasks(result.tasks)
                setStatus(`成功从日报生成了 ${result.tasks.length} 个任务项`)

                if (result.nextWeekPlan) {
                    setNextWeekPlan(result.nextWeekPlan)
                }

                setHasTemplate(true)
            } else {
                setStatus("未能从日报中提取任务数据")
            }
        } catch (e) {
            console.error("从日报生成周报失败:", e)
            setStatus(`生成失败: ${e}`)
        }
    }

    // 拖拽处理
    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
        if (e.type === "dragleave") setDragActive(false)
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        handleTemplateFile(e.dataTransfer.files)
    }

    // 一键填充量化指标
    const fillQuantitative = () => {
        // 从每日任务中提取完成的任务，填充到任务明细表
        // 深拷贝当前任务列表
        let updatedTasks = [...tasks]

        // 遍历日报列表
        dailyList.forEach(daily => {
            if (daily.completed) {
                const existingTask = updatedTasks.find(t => t.task_id === daily.task_id)

                // 如果已有相同task_id的任务，更新它
                if (existingTask) {
                    const index = updatedTasks.findIndex(t => t.task_id === daily.task_id)
                    updatedTasks[index] = {
                        ...updatedTasks[index],
                        date: daily.date,
                        task: daily.completed,
                        status: "已完成",
                        quantitative: daily.completed
                    }
                } else {
                    // 否则添加新任务
                    updatedTasks.push({
                        date: daily.date,
                        task_id: daily.task_id || "",
                        task_name: daily.task_name || "",
                        task: daily.completed,
                        status: "已完成",
                        remarks: daily.remarks || "",
                        plan_start_time: "",
                        plan_end_time: "",
                        actual_start_time: "",
                        plan_hours: daily.plan_hours || "",
                        actual_hours: daily.actual_hours || "",
                        quantitative: daily.completed
                    })
                }
            }
        })

        setTasks(updatedTasks)
        setStatus("已从日报中填充任务明细")
    }

    return (
        <main className="weekly-main">
            {/* 左侧：本周日报列表 */}
            <div className="weekly-left">
                <h2>本周日报</h2>
                <div className="weekly-daily-list">
                    {dailyList.length === 0 && <div className="empty-tip">暂无本周日报</div>}
                    {dailyList.map((d, idx) => (
                        <div key={d.date} className="daily-item">
                            <div><b>{d.date}</b> <span className="daily-task-id">{d.task_id}</span></div>
                            <div className="daily-completed">已完成：{d.completed || <span style={{ color: '#bbb' }}>无</span>}</div>
                        </div>
                    ))}
                </div>
                <button className="primary-btn" onClick={fillQuantitative}>一键填充任务明细</button>
            </div>

            {/* 右侧：周报编辑区 */}
            <div className="weekly-right">
                <h2>周报编辑</h2>
                <div className="weekly-card">
                    {/* 周报时间范围 */}
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: 10 }}>周报时间范围：</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ maxWidth: 150, marginRight: 10 }}
                        />
                        <span style={{ margin: '0 10px' }}>至</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ maxWidth: 150 }}
                        />
                    </div>

                    {/* 岗位任务明细表 */}
                    <h3 style={{ marginBottom: 10, fontSize: 16 }}>前端岗位工作明细</h3>
                    <div className="task-table">
                        <div className="task-table-header">
                            <span>日期</span>
                            <span>任务编号</span>
                            <span>任务名称</span>
                            <span>任务描述</span>
                            <span>预计开始</span>
                            <span>预计完成</span>
                            <span>优先级</span>
                            <span>预计工时</span>
                            <span>实际工时</span>
                            <span>状态</span>
                            <span>量化指标</span>
                            <span>备注</span>
                            <span></span>
                        </div>

                        {tasks.map((task, idx) => (
                            <div className="task-table-row" key={idx}>
                                <input value={task.date || ''} onChange={e => updateTask(idx, 'date', e.target.value)} placeholder="日期" />
                                <input value={task.task_id || ''} onChange={e => updateTask(idx, 'task_id', e.target.value)} placeholder="编号" />
                                <input value={task.task_name || ''} onChange={e => updateTask(idx, 'task_name', e.target.value)} placeholder="名称" />
                                <input value={task.task || ''} onChange={e => updateTask(idx, 'task', e.target.value)} placeholder="描述" />
                                <input value={task.plan_start_time || ''} onChange={e => updateTask(idx, 'plan_start_time', e.target.value)} placeholder="预计开始" />
                                <input value={task.plan_end_time || ''} onChange={e => updateTask(idx, 'plan_end_time', e.target.value)} placeholder="预计完成" />
                                <input value={task.priority || ''} onChange={e => updateTask(idx, 'priority', e.target.value)} placeholder="优先级" />
                                <input value={task.plan_hours || ''} onChange={e => updateTask(idx, 'plan_hours', e.target.value)} placeholder="预计工时" />
                                <input value={task.actual_hours || ''} onChange={e => updateTask(idx, 'actual_hours', e.target.value)} placeholder="实际工时" />
                                <input value={task.status || ''} onChange={e => updateTask(idx, 'status', e.target.value)} placeholder="状态" />
                                <input value={task.quantitative || ''} onChange={e => updateTask(idx, 'quantitative', e.target.value)} placeholder="量化指标" />
                                <input value={task.remarks || ''} onChange={e => updateTask(idx, 'remarks', e.target.value)} placeholder="备注" />
                                <button className="delete-btn" onClick={() => removeTask(idx)}>×</button>
                            </div>
                        ))}
                    </div>

                    <button className="secondary-btn" onClick={addTask} style={{ marginTop: 10 }}>+ 添加任务</button>

                    {/* 下周计划 */}
                    <div className="weekly-extra-fields">
                        <label>下周工作计划：</label>
                        <textarea value={nextWeekPlan} onChange={e => setNextWeekPlan(e.target.value)} placeholder="请输入下周工作计划..." />
                    </div>

                    {/* 操作按钮 */}
                    <div className="task-table-actions">
                        <button className="primary-btn" onClick={exportToExcel}>导出Excel</button>
                        <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>导入模板</button>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx,.xls" onChange={e => handleTemplateFile(e.target.files)} />
                        <button className="secondary-btn" onClick={saveAsTemplate}>保存模板</button>
                        <button className="secondary-btn" onClick={loadSavedTemplate}>加载模板</button>
                        <button className="secondary-btn" onClick={generateFromDaily}>从日报生成</button>
                    </div>

                    {/* 状态信息 */}
                    {status && <div className="status-message">{status}</div>}
                </div>
            </div>
        </main>
    )
} 