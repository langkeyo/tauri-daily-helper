import Dexie, { Table } from 'dexie'
import type {
    DailyReport,
    WeeklyReport,
    Task,
    Project,
    OfflineAction
} from '@/types'

// 定义一个内部类型，用于数据库存储
interface DbOfflineAction extends Omit<OfflineAction, 'synced'> {
    synced: number // 在数据库中使用0/1
}

// 定义数据库类，扩展Dexie
class DailyHelperDB extends Dexie {
    // 定义表
    tasks!: Table<Task>
    projects!: Table<Project>
    dailyReports!: Table<DailyReport>
    weeklyReports!: Table<WeeklyReport>
    offlineActions!: Table<DbOfflineAction>

    constructor() {
        super('dailyHelperDB')
        this.version(1).stores({
            tasks: 'id, user_id, status, project_id, due_date, updated_at',
            projects: 'id, user_id, name, updated_at',
            dailyReports: 'id, user_id, date, updated_at',
            weeklyReports: 'id, user_id, start_date, end_date, updated_at',
            offlineActions: '++id, table, action, timestamp, synced'
        })

        // 数据库打开后尝试修复可能的问题
        this.on('ready', () => {
            this.fixDatabase().catch(err => {
                console.error('数据库修复失败:', err)
            })
        })
    }

    // 修复数据库中可能存在的问题
    async fixDatabase() {
        try {
            console.log('开始检查和修复数据库...')

            // 修复离线操作表中的同步状态字段
            // 这将处理任何可能导致"The parameter is not a valid key"错误的布尔值
            await this.fixOfflineActionsSyncedField()

            console.log('数据库检查和修复完成')
        } catch (error) {
            console.error('数据库修复过程中发生错误:', error)
            throw error
        }
    }

    // 修复离线操作表中可能错误的synced字段
    async fixOfflineActionsSyncedField() {
        try {
            // 获取所有离线操作记录
            const allActions = await this.offlineActions.toArray()

            // 找出需要修复的记录
            const actionsToFix = allActions.filter(action =>
                typeof action.synced === 'boolean' ||
                action.synced === undefined ||
                action.synced === null
            )

            if (actionsToFix.length === 0) {
                console.log('没有发现需要修复的离线操作记录')
                return
            }

            console.log(`发现 ${actionsToFix.length} 条需要修复的离线操作记录`)

            // 修复这些记录
            for (const action of actionsToFix) {
                const fixedAction = { ...action }

                // 将布尔值转换为数字
                if (typeof action.synced === 'boolean') {
                    fixedAction.synced = action.synced ? 1 : 0
                } else {
                    // 如果是undefined或null，则默认为未同步(0)
                    fixedAction.synced = 0
                }

                // 更新记录
                if (action.id !== undefined) {
                    await this.offlineActions.update(action.id, fixedAction)
                }
            }

            console.log('离线操作记录已修复')
        } catch (error) {
            console.error('修复离线操作记录失败:', error)
            // 如果修复失败，尝试清空离线操作表
            // 这是最后的手段，避免阻塞应用正常功能
            try {
                await this.offlineActions.clear()
                console.log('已清空离线操作表以防止持续错误')
            } catch (clearError) {
                console.error('清空离线操作表失败:', clearError)
            }
        }
    }

    // 清除所有数据
    async clearAllData() {
        await this.transaction('rw',
            [this.tasks,
            this.projects,
            this.dailyReports,
            this.weeklyReports,
            this.offlineActions],
            async () => {
                await Promise.all([
                    this.tasks.clear(),
                    this.projects.clear(),
                    this.dailyReports.clear(),
                    this.weeklyReports.clear(),
                    this.offlineActions.clear()
                ])
            }
        )
    }

    // 记录离线操作
    async recordOfflineAction(
        table: string,
        action: 'create' | 'update' | 'delete',
        data: any
    ) {
        await this.offlineActions.add({
            table,
            action,
            data,
            timestamp: Date.now(),
            synced: 0  // 使用0表示未同步
        })
    }

    // 获取未同步的操作
    async getUnsyncedActions(): Promise<OfflineAction[]> {
        try {
            // 使用等于0而不是布尔值，因为Dexie在某些浏览器中对布尔值索引支持不佳
            const dbActions = await this.offlineActions
                .where('synced')
                .equals(0)  // 使用0代替false
                .toArray()

            // 将数据库中的数字类型转换为API需要的布尔类型
            return dbActions.map(action => ({
                ...action,
                synced: action.synced === 1
            }))
        } catch (error) {
            console.error('获取未同步操作失败:', error)
            // 返回空数组，避免中断同步流程
            return []
        }
    }

    // 标记操作为已同步
    async markActionSynced(id: number) {
        try {
            if (id === undefined || id === null || isNaN(id)) {
                console.error('无效的操作ID:', id)
                return
            }
            // 使用1代替true
            await this.offlineActions.update(id, { synced: 1 })
        } catch (error) {
            console.error('标记操作已同步失败:', error)
        }
    }
}

// 创建并导出数据库实例
export const db = new DailyHelperDB()