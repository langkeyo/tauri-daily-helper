import { supabase } from "@/lib/supabaseClient"
import { db } from "@/lib/db"
import { dailyReportService } from "./dailyReportService"
import { weeklyReportService } from "./weeklyReportService"
import { taskService } from "./taskService"
import { authService } from "./authService"
import type { OfflineAction } from "@/types"
import { invoke } from "@tauri-apps/api/core"

interface GroupedActions {
    [table: string]: OfflineAction[]
}

interface ConnectionTestResult {
    isConnected: boolean
    message: string
}

export const syncService = {
    // 同步状态
    isSyncing: false,
    lastSyncTime: null as Date | null,
    isOnline: navigator.onLine,

    // 初始化同步服务
    init() {
        // 监听在线/离线状态
        window.addEventListener('online', this.handleOnlineStatus.bind(this))
        window.addEventListener('offline', this.handleOnlineStatus.bind(this))

        // 如果在线且已认证，立即尝试同步
        if (navigator.onLine && authService.isUserAuthenticated()) {
            this.syncOfflineActions().catch(console.error)
        }

        // 每10分钟尝试同步一次，但仅当用户已认证时
        setInterval(() => {
            if (navigator.onLine && authService.isUserAuthenticated()) {
                this.syncOfflineActions().catch(console.error)
            }
        }, 10 * 60 * 1000)
    },

    // 处理在线/离线状态变化
    handleOnlineStatus() {
        this.isOnline = navigator.onLine

        // 如果恢复在线且已认证，尝试同步
        if (this.isOnline && authService.isUserAuthenticated()) {
            this.syncOfflineActions().catch(console.error)
        }

        // 触发自定义事件，通知应用状态变化
        window.dispatchEvent(new CustomEvent('connectionChange', {
            detail: { isOnline: this.isOnline }
        }))
    },

    // 同步所有离线操作
    async syncOfflineActions(): Promise<void> {
        // 如果未认证，不进行同步
        if (!authService.isUserAuthenticated()) return

        if (this.isSyncing || !navigator.onLine) return

        try {
            this.isSyncing = true

            // 通知UI同步开始
            window.dispatchEvent(new CustomEvent('syncStart'))

            // 获取所有未同步的操作
            const actions = await db.getUnsyncedActions()

            if (actions.length === 0) {
                this.lastSyncTime = new Date()
                window.dispatchEvent(new CustomEvent('syncComplete', {
                    detail: { success: true }
                }))
                return
            }

            console.log(`同步 ${actions.length} 个离线操作`)

            // 对操作按表和时间戳分组，确保顺序正确
            const groupedActions = this.groupActionsByTable(actions)

            // 依次处理每个表的操作
            for (const [table, tableActions] of Object.entries(groupedActions)) {
                await this.processTableActions(table, tableActions)
            }

            this.lastSyncTime = new Date()

            // 通知UI同步完成
            window.dispatchEvent(new CustomEvent('syncComplete', {
                detail: { success: true }
            }))
        } catch (error) {
            console.error('同步失败:', error)

            // 通知UI同步失败
            window.dispatchEvent(new CustomEvent('syncComplete', {
                detail: { success: false, error }
            }))
        } finally {
            this.isSyncing = false
        }
    },

    // 按表格分组操作
    groupActionsByTable(actions: OfflineAction[]): GroupedActions {
        return actions.reduce((grouped: GroupedActions, action: OfflineAction) => {
            if (!grouped[action.table]) {
                grouped[action.table] = []
            }
            grouped[action.table].push(action)
            return grouped
        }, {})
    },

    // 处理一个表的所有操作
    async processTableActions(table: string, actions: OfflineAction[]): Promise<void> {
        // 按时间戳排序
        actions.sort((a: OfflineAction, b: OfflineAction) => a.timestamp - b.timestamp)

        for (const action of actions) {
            try {
                await this.processAction(action)
                // 标记为已同步
                if (action.id !== undefined) {
                    // 确保id是数字类型
                    const actionId = typeof action.id === 'string' ? parseInt(action.id, 10) : action.id
                    if (!isNaN(actionId)) {
                        await db.markActionSynced(actionId)
                    }
                }
            } catch (error) {
                console.error(`处理操作失败:`, action, error)
                // 不中断整个同步过程
            }
        }
    },

    // 处理单个操作
    async processAction(action: OfflineAction): Promise<void> {
        const { table, action: actionType, data } = action

        // 添加用户ID到数据
        if (data && !data.user_id && authService.currentUser) {
            data.user_id = authService.currentUser.id
        }

        try {
            switch (actionType) {
                case 'create':
                    await supabase.from(table).insert(data)
                    break

                case 'update':
                    await supabase
                        .from(table)
                        .update(data)
                        .eq('id', data.id)
                    break

                case 'delete':
                    await supabase
                        .from(table)
                        .delete()
                        .eq('id', data.id)
                    break
            }
        } catch (error) {
            console.error(`操作失败: ${actionType} ${table}`, error)
            throw error
        }
    },

    // 从服务器刷新本地缓存
    async refreshLocalCache(): Promise<void> {
        if (!navigator.onLine || !authService.isUserAuthenticated()) return

        // 并行获取多种数据
        await Promise.all([
            this.refreshRecentDailyReports(),
            this.refreshRecentWeeklyReports(),
            this.refreshRecentTasks()
        ])
    },

    // 刷新最近的日报缓存
    async refreshRecentDailyReports(): Promise<void> {
        try {
            await dailyReportService.refreshRecentDailyReports(30)
        } catch (error) {
            console.error('刷新日报缓存失败:', error)
        }
    },

    // 刷新最近的周报缓存
    async refreshRecentWeeklyReports(): Promise<void> {
        try {
            const { data } = await supabase
                .from('weekly_reports')
                .select('*')
                .order('end_date', { ascending: false })
                .limit(10)

            if (data?.length) {
                await db.weeklyReports.bulkPut(data)
            }
        } catch (error) {
            console.error('刷新周报缓存失败:', error)
        }
    },

    // 刷新最近的任务缓存
    async refreshRecentTasks(): Promise<void> {
        try {
            await taskService.refreshTasks()
        } catch (error) {
            console.error('刷新任务缓存失败:', error)
        }
    },

    // 测试连接状态
    async testConnection(): Promise<ConnectionTestResult> {
        try {
            // 使用后端函数进行测试，更可靠且提供更详细的错误信息
            const message = await invoke<string>("test_supabase_connection")

            return {
                isConnected: true,
                message: message || 'Supabase连接正常'
            }
        } catch (unknownError) {
            // 捕获并详细记录错误
            console.error('Supabase连接测试失败:', unknownError)

            let errorMessage: string

            if (unknownError instanceof Error) {
                errorMessage = unknownError.message
                // 如果有堆栈信息且在开发模式，记录更详细的信息
                if (process.env.NODE_ENV === 'development' && unknownError.stack) {
                    console.debug('错误堆栈:', unknownError.stack)
                }
            } else if (typeof unknownError === 'string') {
                errorMessage = unknownError
            } else {
                errorMessage = String(unknownError)
            }

            // 确保错误消息不是空的
            if (!errorMessage || errorMessage === '{}') {
                errorMessage = '未知网络错误，请检查网络连接和Supabase服务状态'
            }

            return {
                isConnected: false,
                message: `Supabase连接失败: ${errorMessage}`
            }
        }
    }
} 