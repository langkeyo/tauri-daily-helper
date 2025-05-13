"use client"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import Link from "next/link"
import { Input, TextArea, Button } from "@/components/ui"
import { DailyCard } from "@/components/ui/DailyCard"
import { authService } from "@/lib/services"  // 导入authService
import DatabaseErrorHandler from "@/components/DatabaseErrorHandler" // 导入数据库错误处理组件

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
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("")
  const [dbError, setDbError] = useState(false) // 数据库错误状态

  // 自动加载当前日期日报
  useEffect(() => {
    const fetchDaily = async () => {
      try {
        setIsLoading(true)
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
      } finally {
        setIsLoading(false)
      }
    }
    fetchDaily()
    // eslint-disable-next-line
  }, [form.date])

  // 检测数据库错误
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        // 尝试导入数据库并执行一个简单的查询
        const { db } = await import('@/lib/db')
        await db.offlineActions.count()
        setDbError(false)
      } catch (error) {
        console.error('数据库访问错误:', error)
        if (String(error).includes('IDBKeyRange') || String(error).includes('indexedDB')) {
          setDbError(true)
        }
      }
    }
    checkDatabase()
  }, [])

  // 在useEffect中添加自动修复数据库结构的代码
  useEffect(() => {
    const autoFixDatabaseStructure = async () => {
      try {
        console.log('正在自动检查数据库结构...')
        // 尝试测试Supabase连接
        const connectionResult = await invoke("test_supabase_connection").catch(e => null)

        if (connectionResult) {
          console.log('Supabase连接成功')
          // 尝试自动确保user_id列存在
          await invoke("add_user_id_column").catch(e => {
            console.warn('添加user_id列时出现非致命错误:', e)
          })
        }
      } catch (error) {
        console.error('自动修复数据库结构失败:', error)
        // 失败也继续，不阻止应用使用
      }
    }

    // 执行自动修复
    autoFixDatabaseStructure()
  }, [])

  // 如果检测到数据库错误，显示错误处理组件
  if (dbError) {
    return <DatabaseErrorHandler />
  }

  // 保存日报
  const saveDaily = async () => {
    if (!form.date) {
      setStatus("请选择日期")
      return
    }
    try {
      setIsLoading(true)
      setStatus("正在保存...")

      // 获取当前用户ID
      const currentUser = authService.getCurrentUser()
      // 修改：不添加用户ID到请求中，除非确认Supabase表结构支持
      // const userId = currentUser?.id !== 'anonymous' ? currentUser?.id : undefined

      const safeData = {
        ...form,
        task_id: getTaskIdForToday(form.date),
        task_name: form.task_name || '',
        should_complete: form.should_complete || '',
        completed: form.completed || '',
        uncompleted: form.uncompleted || '',
        plan_hours: form.plan_hours || '',
        actual_hours: form.actual_hours || '',
        remarks: form.remarks || '',
        // 移除user_id字段，避免与Supabase表结构不匹配
        // user_id: userId
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
      console.error("保存日报失败:", e)
      setStatus(`保存失败：${e}`)

      // 如果错误信息中包含user_id列不存在，尝试自动修复并提示
      const errorStr = String(e)
      if (errorStr.includes("user_id") && (errorStr.includes("column") || errorStr.includes("not exist"))) {
        setConnectionStatus("正在自动尝试修复数据库结构...")

        try {
          // 调用后端修复命令
          const result = await invoke("add_user_id_column")
          setConnectionStatus(`数据库结构已修复，请重新尝试保存！(${result})`)

          // 2秒后清除状态
          setTimeout(() => {
            setConnectionStatus("")
          }, 5000)
        } catch (fixError) {
          setConnectionStatus(`自动修复失败: ${fixError}`)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 测试Supabase连接
  const testConnection = async () => {
    try {
      setConnectionStatus("正在测试连接...")
      setIsLoading(true)
      const result = await invoke<string>("test_supabase_connection")
      setConnectionStatus(`连接测试结果: ${result}`)
    } catch (e) {
      setConnectionStatus(`连接失败: ${e}`)
    } finally {
      setIsLoading(false)
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

      <DailyCard
        title={
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-900 dark:text-white">编辑今日日报</span>
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              {status && <span className={status.includes("成功") ? "text-green-500" : (status.includes("失败") ? "text-red-500" : "")}>{status}</span>}
            </span>
          </div>
        }
        footer={
          <div className="flex justify-between items-center w-full">
            <div>
              {connectionStatus && (
                <span className="text-sm text-blue-500 dark:text-blue-400">{connectionStatus}</span>
              )}
            </div>
            <Button
              variant="primary"
              onClick={saveDaily}
              loading={isLoading}
            >
              保存日报
            </Button>
          </div>
        }
        className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <Input
              label="日期"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="md:col-span-1 grid grid-cols-2 gap-4">
            <Input
              label="任务ID"
              value={getTaskIdForToday(form.date)}
              readOnly
              onChange={() => { }} // 只读不需要真正的处理程序，但需要满足类型要求
            />
            <Input
              label="任务名称"
              value={form.task_name || ''}
              onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4">
          <TextArea
            label="应完成"
            value={form.should_complete}
            onChange={e => setForm(f => ({ ...f, should_complete: e.target.value }))}
            rows={4}
          />
        </div>

        <div className="mt-4">
          <TextArea
            label="已完成"
            value={form.completed}
            onChange={e => setForm(f => ({ ...f, completed: e.target.value }))}
            rows={4}
          />
        </div>

        <div className="mt-4">
          <TextArea
            label="未完成"
            value={form.uncompleted}
            onChange={e => setForm(f => ({ ...f, uncompleted: e.target.value }))}
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label="计划工时"
            value={form.plan_hours || ''}
            onChange={e => setForm(f => ({ ...f, plan_hours: e.target.value }))}
          />
          <Input
            label="实际工时"
            value={form.actual_hours || ''}
            onChange={e => setForm(f => ({ ...f, actual_hours: e.target.value }))}
          />
        </div>

        <div className="mt-4">
          <Input
            label="备注"
            value={form.remarks || ''}
            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
          />
        </div>
      </DailyCard>
    </main>
  )
}
