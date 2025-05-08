"use client"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import Link from "next/link"

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

function getTaskIdForToday(dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date()
  let day = date.getDay()
  if (day === 0) day = 7 // 周日
  return `FE-${String(day).padStart(3, '0')}`
}

export default function DailyPage() {
  const [form, setForm] = useState<DailyReport>({
    date: new Date().toISOString().slice(0, 10),
    task_id: '',
    task_name: '',
    should_complete: '',
    completed: '',
    uncompleted: '',
    plan_hours: '',
    actual_hours: '',
    remarks: ''
  })
  const [status, setStatus] = useState("")
  const [isEdit, setIsEdit] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("")

  // 自动加载当前日期日报
  useEffect(() => {
    const fetchDaily = async () => {
      try {
        const report = await invoke<DailyReport>("get_daily_report_by_date", { date: form.date })
        // 确保所有值都不为null，如果是null则转为空字符串
        const safeReport = {
          ...report,
          date: report.date || form.date,
          task_name: report.task_name || '',
          should_complete: report.should_complete || '',
          completed: report.completed || '',
          uncompleted: report.uncompleted || '',
          plan_hours: report.plan_hours || '',
          actual_hours: report.actual_hours || '',
          remarks: report.remarks || ''
        }
        setForm(safeReport)
        setIsEdit(true)
        setStatus("已存在日报，修改后可更新")
      } catch (e) {
        setForm(f => ({ ...f, task_name: '', should_complete: '', completed: '', uncompleted: '', plan_hours: '', actual_hours: '', remarks: '' }))
        setIsEdit(false)
        setStatus("新建日报")
      }
    }
    fetchDaily()
    // eslint-disable-next-line
  }, [form.date])

  // 保存日报
  const saveDaily = async () => {
    if (!form.date) {
      setStatus("请选择日期")
      return
    }
    try {
      const safeData = {
        ...form,
        task_id: getTaskIdForToday(form.date),
        task_name: form.task_name || '',
        should_complete: form.should_complete || '',
        completed: form.completed || '',
        uncompleted: form.uncompleted || '',
        plan_hours: form.plan_hours || '',
        actual_hours: form.actual_hours || '',
        remarks: form.remarks || ''
      }

      if (isEdit) {
        // 更新日报
        await invoke("save_daily_report", { report: safeData })
        setStatus("日报已更新！")
      } else {
        // 新增日报
        await invoke("save_daily_report", { report: safeData })
        setStatus("日报已保存！")
        setIsEdit(true)
      }
    } catch (e) {
      setStatus("保存失败：" + e)
    }
  }

  // 测试Supabase连接
  const testConnection = async () => {
    try {
      setConnectionStatus("正在测试连接...")
      const result = await invoke<string>("test_supabase_connection")
      setConnectionStatus(`连接测试结果: ${result}`)
    } catch (e) {
      setConnectionStatus(`连接失败: ${e}`)
    }
  }

  return (
    <main className="main-container">
      <div className="header">
        <h1>日报周报助手</h1>
      </div>

      <div className="menu-container">
        <h2>选择功能</h2>
        <div className="menu-grid">
          <Link href="/daily" className="menu-item">
            <div className="menu-icon">📝</div>
            <div className="menu-title">日报管理</div>
            <div className="menu-desc">记录每日工作内容和完成情况</div>
          </Link>

          <Link href="/weekly" className="menu-item">
            <div className="menu-icon">📊</div>
            <div className="menu-title">周报生成</div>
            <div className="menu-desc">自动生成或导入Excel模板</div>
          </Link>
        </div>

        <div className="feature-list">
          <h3>主要功能</h3>
          <ul>
            <li>记录每日工作内容和完成情况</li>
            <li>从日报自动推导生成周报</li>
            <li>支持复杂Excel模板的导入与导出</li>
            <li>保留原始Excel表格的格式和结构</li>
            <li>智能识别和处理任务信息</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>编辑今日日报</h2>
        <input
          type="date"
          placeholder="日期"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="任务ID"
          value={getTaskIdForToday(form.date)}
          readOnly
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8, background: "#f5f5f5" }}
        />
        <input
          type="text"
          placeholder="任务名称"
          value={form.task_name}
          onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="应完成"
          value={form.should_complete}
          onChange={e => setForm(f => ({ ...f, should_complete: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="已完成"
          value={form.completed}
          onChange={e => setForm(f => ({ ...f, completed: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="未完成"
          value={form.uncompleted}
          onChange={e => setForm(f => ({ ...f, uncompleted: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="计划工时"
          value={form.plan_hours}
          onChange={e => setForm(f => ({ ...f, plan_hours: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="实际工时"
          value={form.actual_hours}
          onChange={e => setForm(f => ({ ...f, actual_hours: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <input
          type="text"
          placeholder="备注"
          value={form.remarks}
          onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
          style={{ width: "100%", marginBottom: 8, borderRadius: 6, border: "1px solid #ddd", padding: 8 }}
        />
        <button className="primary-btn" style={{ marginTop: 12 }} onClick={saveDaily}>保存日报</button>
        <div style={{ marginTop: 16, color: status.includes("成功") ? "green" : "red" }}>{status}</div>

        {/* 添加测试连接按钮 */}
        <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 10 }}>
          <h3>诊断工具</h3>
          <button
            onClick={testConnection}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              cursor: 'pointer'
            }}
          >
            测试Supabase连接
          </button>
          <div style={{ marginTop: 8, fontSize: 14 }}>
            {connectionStatus && (
              <pre style={{
                padding: 8,
                backgroundColor: '#f5f5f5',
                borderRadius: 4,
                overflowX: 'auto',
                maxWidth: '100%'
              }}>
                {connectionStatus}
              </pre>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
