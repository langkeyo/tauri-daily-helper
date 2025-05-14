import { invoke } from "@tauri-apps/api/core"
import { weeklyReportService } from '@/lib/services/weeklyReportService'

// 使用与weekly/page.tsx中相同的DailyReport接口定义
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

/**
 * 获取指定日期范围内的日报
 * 这个函数替代了原来直接调用不存在的get_dailies_by_range命令的方式
 */
export async function fetchWeeklyDailies(startDate: string, endDate: string): Promise<DailyReport[]> {
    try {
        // 首先尝试使用weeklyReportService获取日报
        const dailies = await weeklyReportService.getDailyReportsInRange(startDate, endDate)
        // 确保返回的类型与页面期望的类型兼容
        return dailies.map(daily => ({
            date: daily.date,
            task_id: daily.task_id as string | undefined,
            task_name: daily.task_name as string | undefined,
            should_complete: daily.should_complete || '',
            completed: daily.completed || '',
            uncompleted: daily.uncompleted || '',
            plan_hours: daily.plan_hours as string | undefined,
            actual_hours: daily.actual_hours as string | undefined,
            remarks: daily.remarks || ''
        }))
    } catch (e) {
        console.error("通过weeklyReportService获取日报失败:", e)

        // 回退方案：获取所有最近日报，然后手动筛选日期范围
        try {
            const allDailies = await invoke<any[]>("get_recent_daily_reports")
            return allDailies
                .filter(daily =>
                    daily.date >= startDate &&
                    daily.date <= endDate
                )
                .map(daily => ({
                    date: daily.date,
                    task_id: daily.task_id as string | undefined,
                    task_name: daily.task_name as string | undefined,
                    should_complete: daily.should_complete || '',
                    completed: daily.completed || '',
                    uncompleted: daily.uncompleted || '',
                    plan_hours: daily.plan_hours as string | undefined,
                    actual_hours: daily.actual_hours as string | undefined,
                    remarks: daily.remarks || ''
                }))
        } catch (e) {
            console.error("通过get_recent_daily_reports获取日报失败:", e)
            // 如果所有方法都失败，返回空数组
            return []
        }
    }
} 