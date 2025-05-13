"use client"
import React, { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Input, TextArea, Button } from "@/components/ui"
import { DailyCard } from "@/components/ui/DailyCard"
import { authService } from "@/lib/services"
import { open } from "@tauri-apps/plugin-dialog"
import { supabase } from "@/lib/supabaseClient"
import { initializeDatabase } from "@/lib/initSupabase"  // 导入initializeDatabase函数
import { db } from "@/lib/db"
import { DailyReport } from "@/types"  // 导入统一的DailyReport类型

// 修改日志函数，确保只在客户端执行
async function logToBackend(level: string, message: string) {
    if (typeof window === 'undefined') {
        return // 在服务器端不执行
    }

    console.log(`[${level.toUpperCase()}] ${message}`) // 在前端控制台也显示
    try {
        await invoke("log_message", { level, message })
    } catch (error) {
        console.error("发送日志到后端失败:", error)
    }
}

// 获取当前用户ID，返回一个有效的字符串ID
const getCurrentUserId = () => {
    if (typeof window === 'undefined') {
        return "guest" // 在服务器端返回默认值
    }

    const user = authService.getCurrentUser()
    logToBackend("debug", `获取到的用户信息: ${JSON.stringify(user || {})}`)

    // 如果user为null或undefined，返回"guest"
    if (!user) {
        logToBackend("warn", "用户未登录，使用临时ID: guest")
        return "guest"
    }

    // 如果user.id是'anonymous'或undefined/null，返回"guest"
    if (!user.id || user.id === 'anonymous') {
        logToBackend("warn", "用户ID无效，使用临时ID: guest")
        return "guest"
    }

    // 否则返回实际用户ID
    logToBackend("info", `使用实际用户ID: ${user.id}`)
    return user.id
}

// 自动初始化数据库函数
const initDatabaseAutomatically = async () => {
    try {
        logToBackend("info", "正在自动初始化数据库...")

        // 使用我们新编写的supabase数据库初始化函数
        try {
            const result = await initializeDatabase()
            logToBackend("info", "Supabase数据库初始化成功")

            // 这个函数是Tauri命令，保留它以保持兼容性
            await invoke("init_database").catch(err => {
                console.log("Tauri init_database调用失败，但这不影响数据库初始化:", err)
            })

            logToBackend("info", "数据库自动初始化完成")
            return result as { offlineMode: boolean, userId: string }
        } catch (supabaseError) {
            // 处理Supabase初始化错误
            console.error("Supabase数据库初始化失败:", supabaseError)
            logToBackend("error", `Supabase数据库初始化失败: ${supabaseError}`)

            // 检查是否是user_id列不存在
            const errorMsg = String(supabaseError)
            if (errorMsg.includes("user_id") && errorMsg.includes("column") && errorMsg.includes("does not exist")) {
                logToBackend("warn", "检测到user_id列不存在错误，尝试使用Tauri后端命令修复")

                // 尝试使用Tauri命令修复
                try {
                    await invoke("add_user_id_column").catch(e => {
                        console.warn("通过Tauri添加user_id列失败:", e)
                    })
                } catch (fixError) {
                    console.warn("尝试修复user_id列失败:", fixError)
                }

                // 即使修复失败，也返回一个有效结果，让应用继续运行
                logToBackend("info", "继续初始化过程，将使用本地数据库")
                return { offlineMode: true, userId: getCurrentUserId() }
            }

            // 非user_id错误或修复失败，尝试Tauri初始化
            try {
                await invoke("init_database")
                logToBackend("info", "通过Tauri命令初始化数据库成功")
                return { offlineMode: false, userId: getCurrentUserId() }
            } catch (tauriError) {
                console.error("Tauri数据库初始化失败:", tauriError)
                logToBackend("error", `Tauri数据库初始化失败: ${tauriError}`)
                return { offlineMode: true, userId: getCurrentUserId() }
            }
        }
    } catch (error) {
        console.error("数据库自动初始化过程中发生未处理异常:", error)
        logToBackend("error", `数据库自动初始化发生未处理异常: ${error}`)
        return { offlineMode: true, userId: "guest" }
    }
}

// 导入或定义getTaskIdForToday函数
function getTaskIdForToday(dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date()
    let day = date.getDay()
    if (day === 0) day = 7 // 周日
    return `FE-${String(day).padStart(3, '0')}`
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
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [recentReports, setRecentReports] = useState<DailyReport[]>([])
    const [databaseInitialized, setDatabaseInitialized] = useState<boolean>(false)
    const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false)

    // 将组件加载的日志移到useEffect中
    useEffect(() => {
        const initializeComponent = async () => {
            try {
                // 在组件加载后输出日志
                console.log("==================== DailyPage 组件已加载 ====================")
                logToBackend("info", "==================== DailyPage 组件已加载 ====================")
                console.log("日报页面当前版本: v1.0.4 - 增强的错误处理和UI修复")
                logToBackend("info", "日报页面当前版本: v1.0.4 - 增强的错误处理和UI修复")

                // 测试用户认证状态
                const currentUser = authService.getCurrentUser()
                console.log("当前用户信息:", currentUser)
                logToBackend("info", `当前用户信息: ${JSON.stringify(currentUser || {})}`)

                const now = new Date()
                const todayStr = now.toISOString().split('T')[0]
                console.log("初始化日期为:", todayStr)
                logToBackend("info", `初始化日期为: ${todayStr}`)
                setDate(todayStr)

                // 自动初始化数据库
                console.log("开始初始化数据库，包括dailies表...")
                try {
                    const initResult = await initDatabaseAutomatically()
                    console.log("数据库初始化结果:", initResult)
                    setDatabaseInitialized(true)
                    if (typeof initResult === 'object' && initResult?.offlineMode) {
                        setIsOfflineMode(true)
                        setStatus("当前处于离线模式，将使用本地数据")
                    }
                } catch (dbError) {
                    console.error("数据库初始化失败:", dbError)
                    setStatus("数据库初始化失败，将使用本地数据")
                    setIsOfflineMode(true)
                }

                // 然后加载日报列表，不管初始化是否成功
                try {
                    await loadRecentReports()
                } catch (loadError) {
                    console.error("加载最近日报失败:", loadError)
                }

                // 加载当天的日报（如果有）
                try {
                    await loadDailyReport(todayStr)
                } catch (todayError) {
                    console.error("加载今日日报失败:", todayError)
                    clearForm()
                    setStatus("创建新日报")
                }

                // 测试浏览器控制台是否正常显示
                setTimeout(() => {
                    console.log("延迟测试消息 - 如果能看到此消息，表示控制台输出正常")
                    logToBackend("debug", "延迟测试消息 - 如果能看到此消息，表示控制台输出正常")
                }, 2000)
            } catch (error) {
                console.error("组件初始化错误:", error)
                setStatus("页面初始化错误，请刷新重试")
            }
        }

        initializeComponent()
    }, [])

    // 加载最近的日报
    const loadRecentReports = async () => {
        setIsLoading(true)
        try {
            // 先尝试从IndexedDB加载
            const localReports = await db.dailyReports.orderBy('date').reverse().limit(10).toArray()

            if (localReports && localReports.length > 0) {
                console.log('从本地数据库加载日报列表', localReports)
                setRecentReports(localReports)

                // 如果是离线模式，就不再尝试从Supabase加载
                if (isOfflineMode) {
                    setStatus('使用本地缓存数据 (离线模式)')
                    return
                }
            }

            // 使用Supabase直接查询，而不是调用Tauri命令
            const { data, error } = await supabase
                .from('dailies')
                .select('*')
                .order('date', { ascending: false })
                .limit(10)

            if (error) throw error

            if (data && data.length > 0) {
                setRecentReports(data)

                // 更新本地缓存
                await db.dailyReports.bulkPut(data)
                console.log('更新本地日报缓存:', data.length, '条记录')
            } else if (localReports && localReports.length > 0) {
                // 如果Supabase没有数据但本地有，保留使用本地数据
                console.log('Supabase无数据，继续使用本地缓存')
            } else {
                console.log('没有找到任何日报记录')
            }
        } catch (error: any) {
            console.error('加载日报失败:', error)
            setStatus('加载日报失败: ' + (error.message || String(error)))

            // 尝试使用本地数据库
            try {
                const localReports = await db.dailyReports.toArray()
                if (localReports && localReports.length > 0) {
                    console.log('使用本地数据库中的日报', localReports)
                    setRecentReports(localReports)
                    setStatus('使用本地缓存数据 (离线模式)')
                }
            } catch (localError) {
                console.error('本地数据库加载也失败:', localError)
            }
        } finally {
            setIsLoading(false)
        }
    }

    // 加载指定日期的日报
    const loadDailyReport = async (selectedDate: string) => {
        try {
            setIsLoading(true)
            setStatus("正在加载...")

            // 获取当前用户ID，确保有一个有效值
            const userId = getCurrentUserId()

            console.log(`加载日期 ${selectedDate} 的日报，用户ID: ${userId}`)
            logToBackend("info", `加载日期 ${selectedDate} 的日报，用户ID: ${userId}`)

            try {
                // 先尝试从Supabase加载
                let query = supabase
                    .from('dailies')
                    .select('*')
                    .eq('date', selectedDate)

                // 尝试使用user_id过滤，但如果失败会有备用方案
                try {
                    const { data, error } = await query
                        .eq('user_id', userId)
                        .maybeSingle()

                    if (!error && data) {
                        console.log("成功加载日报:", data)
                        logToBackend("info", "成功加载日报记录")

                        // 更新表单数据
                        setDate(data.date || selectedDate)
                        setShouldComplete(data.should_complete || "")
                        setCompleted(data.completed || "")
                        setUncompleted(data.uncompleted || "")
                        setRemarks(data.remarks || "")
                        setTaskId(data.task_id || getTaskIdForToday(selectedDate))
                        setTaskName(data.task_name || "")
                        setPlanHours(data.plan_hours || "8")
                        setActualHours(data.actual_hours || "8")

                        setStatus("已加载日报")
                        return
                    } else if (error && error.message && error.message.includes("user_id")) {
                        // user_id列不存在，使用不带user_id的查询重试
                        console.warn("检测到user_id列错误，切换到不带user_id的查询:", error)
                        logToBackend("warn", "检测到user_id列不存在，使用备用查询方法")

                        // 不使用user_id参数重新查询
                        const noUserIdQuery = await supabase
                            .from('dailies')
                            .select('*')
                            .eq('date', selectedDate)
                            .maybeSingle()

                        if (!noUserIdQuery.error && noUserIdQuery.data) {
                            const data = noUserIdQuery.data
                            console.log("使用备用方法成功加载日报:", data)

                            // 更新表单数据
                            setDate(data.date || selectedDate)
                            setShouldComplete(data.should_complete || "")
                            setCompleted(data.completed || "")
                            setUncompleted(data.uncompleted || "")
                            setRemarks(data.remarks || "")
                            setTaskId(data.task_id || getTaskIdForToday(selectedDate))
                            setTaskName(data.task_name || "")
                            setPlanHours(data.plan_hours || "8")
                            setActualHours(data.actual_hours || "8")

                            setStatus("已加载日报 (备用方法)")
                            return
                        } else {
                            console.error("备用查询方法也失败:", noUserIdQuery.error)
                        }
                    } else {
                        console.log("Supabase中未找到该日期的日报记录:", error)
                    }
                } catch (userIdError) {
                    console.error("带user_id查询失败:", userIdError)
                    logToBackend("error", `带user_id查询失败: ${userIdError}`)

                    // 尝试不用user_id的查询
                    try {
                        const { data, error } = await supabase
                            .from('dailies')
                            .select('*')
                            .eq('date', selectedDate)
                            .maybeSingle()

                        if (!error && data) {
                            console.log("使用备用方法成功加载日报:", data)

                            // 更新表单数据
                            setDate(data.date || selectedDate)
                            setShouldComplete(data.should_complete || "")
                            setCompleted(data.completed || "")
                            setUncompleted(data.uncompleted || "")
                            setRemarks(data.remarks || "")
                            setTaskId(data.task_id || getTaskIdForToday(selectedDate))
                            setTaskName(data.task_name || "")
                            setPlanHours(data.plan_hours || "8")
                            setActualHours(data.actual_hours || "8")

                            setStatus("已加载日报 (备用方法)")
                            return
                        }
                    } catch (backupError) {
                        console.error("备用查询方法失败:", backupError)
                    }
                }

                // 如果走到这里，说明Supabase查询没有结果，尝试使用Tauri命令
                try {
                    const report = await invoke<DailyReport>("get_daily_report_by_date", {
                        date: selectedDate,
                        userId // 将user_id传递给Tauri命令
                    })

                    console.log("通过Tauri命令加载日报:", report)
                    logToBackend("info", "通过Tauri命令成功加载日报")

                    // 更新表单数据
                    setDate(report.date || selectedDate)
                    setShouldComplete(report.should_complete || "")
                    setCompleted(report.completed || "")
                    setUncompleted(report.uncompleted || "")
                    setRemarks(report.remarks || "")
                    setTaskId(report.task_id || getTaskIdForToday(selectedDate))
                    setTaskName(report.task_name || "")
                    setPlanHours(report.plan_hours || "8")
                    setActualHours(report.actual_hours || "8")

                    setStatus("已加载日报 (通过Tauri命令)")
                    return
                } catch (tauriError) {
                    console.error("加载日报失败:", tauriError)
                    logToBackend("error", `加载日报失败: ${tauriError}`)

                    // 最后尝试从本地IndexedDB加载
                    try {
                        const localReport = await db.dailyReports
                            .where('date')
                            .equals(selectedDate)
                            .first()

                        if (localReport) {
                            console.log("从本地数据库加载日报:", localReport)

                            // 使用本地数据
                            setDate(localReport.date || selectedDate)
                            setShouldComplete(localReport.should_complete || "")
                            setCompleted(localReport.completed || "")
                            setUncompleted(localReport.uncompleted || "")
                            setRemarks(localReport.remarks || "")
                            setTaskId(localReport.task_id || getTaskIdForToday(selectedDate))
                            setTaskName(localReport.task_name || "")
                            setPlanHours(localReport.plan_hours || "8")
                            setActualHours(localReport.actual_hours || "8")

                            setStatus("从本地缓存加载的日报 (离线模式)")
                            return
                        }
                    } catch (localError) {
                        console.error("本地数据库加载失败:", localError)
                    }

                    // 如果是新日期，则清空表单
                    clearForm()
                    setStatus("新建日报 (离线模式)")
                }
            } finally {
                setIsLoading(false)
            }
        } catch (error) {
            console.error("加载日报过程中发生未处理异常:", error)
            logToBackend("error", `加载日报过程中发生未处理异常: ${error}`)
            setIsLoading(false)
            setStatus("加载日报时出错，请刷新重试")
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
            setIsLoading(true)
            setStatus("正在保存...")

            // 获取当前用户ID，确保有一个有效值
            const userId = getCurrentUserId()

            console.log(`保存日期 ${date} 的日报，用户ID: ${userId}`)
            logToBackend("info", `保存日期 ${date} 的日报，用户ID: ${userId}`)

            const report: DailyReport = {
                date,
                task_id: taskId || '',
                task_name: taskName || '',
                should_complete: shouldComplete || '',
                completed: completed || '',
                uncompleted: uncompleted || '',
                plan_hours: planHours || '8',
                actual_hours: actualHours || '8',
                remarks: remarks || '',
                user_id: userId
            }

            console.log("即将保存的日报数据:", report)
            logToBackend("info", `即将保存的日报数据: ${JSON.stringify(report)}`)
            const result = await invoke("save_daily_report", { report })
            console.log("保存结果:", result)
            logToBackend("info", `保存结果: ${result}`)

            // 保存成功后，重新加载该日期的日报以更新界面状态
            setStatus(`保存成功: ${result}`)
            loadRecentReports()

            // 重新加载当前日报
            setTimeout(() => {
                logToBackend("debug", "延迟500ms后重新加载当前日报")
                loadDailyReport(date)
            }, 500)
        } catch (error) {
            console.error("保存日报失败:", error)
            logToBackend("error", `保存日报失败: ${error}`)
            setStatus(`保存失败: ${error}`)
        } finally {
            setIsLoading(false)
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
            setIsLoading(true)
            setStatus("正在生成周报...")
            // 调用后端函数从日报生成周报
            await invoke("generate_weekly_from_daily", { startDate, endDate })
            setStatus("周报生成成功，请前往周报页面查看")
        } catch (error) {
            console.error("生成周报失败:", error)
            setStatus(`生成周报失败: ${error}`)
        } finally {
            setIsLoading(false)
        }
    }

    // 获取Git未提交更改并添加到今日已完成事项
    const fetchGitChanges = async () => {
        try {
            setIsLoading(true)
            setStatus("正在获取Git更改...")

            // 打开文件夹对话框，选择Git仓库
            const repoPath = await open({
                directory: true,
                multiple: false,
                title: "选择Git仓库根目录"
            })

            if (!repoPath || Array.isArray(repoPath)) {
                setStatus("未选择有效的仓库路径")
                setIsLoading(false)
                return
            }

            // 调用Rust函数获取Git更改
            const changes = await invoke<string>("get_git_changes", {
                repoPath: repoPath,
                prefix: "- " // 使用无序列表格式
            })

            if (changes) {
                // 将结果添加到"今日已完成事项"
                setCompleted(prev => {
                    // 如果原来有内容，添加到后面，否则直接使用
                    return prev ? `${prev}\n\n${changes}` : changes
                })
                setStatus("Git更改已成功添加到今日已完成事项")
            } else {
                setStatus("没有找到未提交的更改")
            }
        } catch (error) {
            console.error("获取Git更改失败:", error)
            setStatus(`获取Git更改失败: ${error}`)
        } finally {
            setIsLoading(false)
        }
    }

    // 日期变更时加载对应日报
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value
        setDate(newDate)
        loadDailyReport(newDate)
    }

    return (
        <div className="p-4 max-w-5xl mx-auto">
            <DailyCard
                title={
                    <div className="flex justify-between items-center">
                        <span>日报管理 {isOfflineMode ? '(离线模式)' : ''}</span>
                        <div className="relative group">
                            <span className="cursor-help text-gray-500 hover:text-blue-500 bg-gray-100 dark:bg-gray-700 rounded-full h-6 w-6 flex items-center justify-center">?</span>
                            <div className="absolute right-0 w-64 p-2 mt-2 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                记录每日工作内容，系统将自动根据日报生成周报。
                                记录当天应完成的任务、已完成任务和未完成任务，将自动整合到周报中。
                            </div>
                        </div>
                    </div>
                }
                footer={
                    <div className="flex flex-wrap gap-3 justify-end">
                        <Button
                            variant="primary"
                            onClick={saveDailyReport}
                            loading={isLoading}
                            disabled={!date}
                        >
                            保存日报
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={generateWeeklyFromDaily}
                            loading={isLoading}
                        >
                            生成本周周报
                        </Button>
                        <Button
                            variant="outline"
                            onClick={fetchGitChanges}
                            loading={isLoading}
                        >
                            导入Git更改
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {/* 日期选择 */}
                    <div className="w-full mb-4">
                        <Input
                            label="选择日期"
                            type="date"
                            value={date}
                            onChange={handleDateChange}
                        />
                    </div>

                    {/* 任务信息 */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="w-full sm:w-1/3">
                            <Input
                                label="任务编号"
                                value={taskId}
                                onChange={(e) => setTaskId(e.target.value)}
                                placeholder="选填"
                            />
                        </div>
                        <div className="w-full sm:w-2/3">
                            <Input
                                label="任务名称"
                                value={taskName}
                                onChange={(e) => setTaskName(e.target.value)}
                                placeholder="选填"
                            />
                        </div>
                    </div>

                    {/* 工时信息 */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="w-full sm:w-1/2">
                            <Input
                                label="计划工时"
                                value={planHours}
                                onChange={(e) => setPlanHours(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-1/2">
                            <Input
                                label="实际工时"
                                value={actualHours}
                                onChange={(e) => setActualHours(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 工作内容 */}
                    <div className="mb-4">
                        <TextArea
                            label="今日应完成事项"
                            value={shouldComplete}
                            onChange={(e) => setShouldComplete(e.target.value)}
                            placeholder="今日计划完成的工作项，每行一项"
                            rows={5}
                        />
                    </div>

                    <div className="mb-4">
                        <TextArea
                            label="今日已完成事项"
                            value={completed}
                            onChange={(e) => setCompleted(e.target.value)}
                            placeholder="今日实际完成的工作项，每行一项"
                            rows={5}
                        />
                    </div>

                    <div className="mb-4">
                        <TextArea
                            label="今日未完成事项"
                            value={uncompleted}
                            onChange={(e) => setUncompleted(e.target.value)}
                            placeholder="今日未完成的工作项及原因，每行一项"
                            rows={5}
                        />
                    </div>

                    <div className="mb-4">
                        <TextArea
                            label="备注"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="其他需要说明的情况（选填）"
                            rows={3}
                        />
                    </div>

                    {status && (
                        <div className={`
                            p-3 rounded-md my-4 flex items-center text-sm
                            ${status.includes("成功")
                                ? "bg-green-50 text-green-800 border border-green-200"
                                : status.includes("失败") || status.includes("错误")
                                    ? "bg-red-50 text-red-800 border border-red-200"
                                    : "bg-blue-50 text-blue-800 border border-blue-200"
                            }
                        `}>
                            <span className="mr-2">
                                {status.includes("成功")
                                    ? "✅"
                                    : status.includes("失败") || status.includes("错误")
                                        ? "❌"
                                        : "ℹ️"
                                }
                            </span>
                            {status}
                        </div>
                    )}
                </div>

                {/* 最近的日报 */}
                {recentReports.length > 0 && (
                    <div className="mt-8 border-t pt-6 border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">最近的日报</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {recentReports.map((report, index) => (
                                <div
                                    key={index}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow duration-200"
                                    onClick={() => {
                                        setDate(report.date)
                                        loadDailyReport(report.date)
                                    }}
                                >
                                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                                        {new Date(report.date).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                                    </div>
                                    <div className="text-gray-700 dark:text-gray-300 truncate">
                                        {report.task_name || '无任务名称'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DailyCard>
        </div>
    )
} 