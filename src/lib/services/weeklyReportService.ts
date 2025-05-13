import { invoke } from "@tauri-apps/api/core"
import { supabase } from "@/lib/supabaseClient"
import { db } from "@/lib/db"
import type { WeeklyReport, DailyReport } from "@/types"
import { dailyReportService } from "./dailyReportService"

export const weeklyReportService = {
    // 获取指定日期范围的周报
    async getWeeklyReport(startDate: string, endDate: string): Promise<WeeklyReport | null> {
        try {
            // 先查本地缓存
            const cachedReport = await db.weeklyReports
                .where('start_date')
                .equals(startDate)
                .and(item => item.end_date === endDate)
                .first()

            if (cachedReport) {
                // 返回缓存结果并在后台刷新
                this.refreshWeeklyReport(startDate, endDate)
                return cachedReport
            }

            // 本地无缓存，从 Supabase 获取
            const { data, error } = await supabase
                .from('weekly_reports')
                .select('*')
                .eq('start_date', startDate)
                .eq('end_date', endDate)
                .single()

            if (error) {
                // 如果 Supabase 请求失败，回退到 Tauri 命令
                try {
                    const report = await invoke<WeeklyReport>("get_weekly_report", {
                        startDate,
                        endDate
                    })

                    // 缓存到本地数据库
                    if (report) {
                        await db.weeklyReports.put(report)
                    }

                    return report
                } catch (e) {
                    console.error('Tauri get_weekly_report failed:', e)
                    return null
                }
            }

            // 更新本地缓存
            if (data) {
                await db.weeklyReports.put(data)
            }

            return data
        } catch (error) {
            console.error('Error fetching weekly report:', error)
            return null
        }
    },

    // 从 Supabase 刷新周报
    async refreshWeeklyReport(startDate: string, endDate: string): Promise<WeeklyReport | null> {
        try {
            const { data, error } = await supabase
                .from('weekly_reports')
                .select('*')
                .eq('start_date', startDate)
                .eq('end_date', endDate)
                .single()

            if (error) throw error

            // 更新本地缓存
            if (data) {
                await db.weeklyReports.put(data)
            }

            return data
        } catch (error) {
            console.error('Error refreshing weekly report:', error)
            return null
        }
    },

    // 保存周报
    async saveWeeklyReport(report: WeeklyReport): Promise<WeeklyReport> {
        // 确保有ID，新记录生成ID
        if (!report.id) {
            report.id = crypto.randomUUID()
        }

        // 添加时间戳
        report.updated_at = new Date().toISOString()
        if (!report.created_at) {
            report.created_at = report.updated_at
        }

        try {
            // 添加到本地缓存
            await db.weeklyReports.put(report)

            // 尝试同步到 Supabase
            const { data, error } = await supabase
                .from('weekly_reports')
                .upsert(report)
                .select()
                .single()

            if (error) {
                // 记录为离线操作
                await db.recordOfflineAction('weekly_reports', 'update', report)
                throw error
            }

            // 同步到 Tauri 后端
            await invoke("save_weekly_report", { report })

            // 返回服务器返回的数据
            return data || report
        } catch (error) {
            console.error('Error saving weekly report:', error)

            // 记录为离线操作
            await db.recordOfflineAction('weekly_reports', 'update', report)

            // 尝试使用 Tauri 命令保存
            try {
                await invoke("save_weekly_report", { report })
            } catch (e) {
                console.error('Fallback to Tauri command failed:', e)
            }

            // 返回本地对象
            return report
        }
    },

    // 从日报自动生成周报
    async generateFromDailyReports(startDate: string, endDate: string): Promise<WeeklyReport> {
        // 获取该日期范围内的所有日报
        const dailyReports: DailyReport[] = await this.getDailyReportsInRange(startDate, endDate)

        if (dailyReports.length === 0) {
            throw new Error('未找到该日期范围内的日报')
        }

        // 处理日报数据，生成周报内容
        const completedItems: string[] = []
        const uncompletedItems: string[] = []
        const shouldCompleteItems: string[] = []

        for (const report of dailyReports) {
            // 处理已完成的任务
            if (report.completed) {
                const items = report.completed
                    .split('\n')
                    .filter(item => item.trim() !== '')

                completedItems.push(...items)
            }

            // 处理未完成的任务
            if (report.uncompleted) {
                const items = report.uncompleted
                    .split('\n')
                    .filter(item => item.trim() !== '')

                uncompletedItems.push(...items)
            }

            // 处理应完成的任务
            if (report.should_complete) {
                const items = report.should_complete
                    .split('\n')
                    .filter(item => item.trim() !== '')

                shouldCompleteItems.push(...items)
            }
        }

        // 创建周报对象
        const weeklyReport: WeeklyReport = {
            start_date: startDate,
            end_date: endDate,
            summary: '本周工作总结',
            completed_tasks: completedItems.map(item => `- ${item}`).join('\n'),
            next_week_plan: '下周工作计划：\n\n',
            issues: uncompletedItems.length > 0
                ? `本周未完成项：\n${uncompletedItems.map(item => `- ${item}`).join('\n')}`
                : '',
            remarks: ''
        }

        // 尝试调用后端生成周报
        try {
            const backendReport = await invoke<WeeklyReport>("generate_weekly_from_daily", {
                startDate,
                endDate
            })

            // 合并后端生成的内容
            if (backendReport) {
                return {
                    ...weeklyReport,
                    ...backendReport
                }
            }
        } catch (error) {
            console.error('Backend weekly report generation failed:', error)
            // 继续使用前端生成的周报
        }

        return weeklyReport
    },

    // 获取日期范围内的日报
    async getDailyReportsInRange(startDate: string, endDate: string): Promise<DailyReport[]> {
        try {
            // 先查本地缓存
            const cachedReports = await db.dailyReports
                .where('date')
                .between(startDate, endDate, true, true)
                .toArray()

            if (cachedReports.length > 0) {
                return cachedReports
            }

            // 本地无缓存，从 Supabase 获取
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true })

            if (error) throw error

            // 更新本地缓存
            if (data && data.length > 0) {
                await db.dailyReports.bulkPut(data)
                return data
            }

            // 如果 Supabase 中没有数据，尝试从 Tauri 后端获取
            try {
                // 生成日期范围内的所有日期
                const dates: string[] = this.getDatesBetween(startDate, endDate)

                // 对每个日期获取日报
                const reports: DailyReport[] = []
                for (const date of dates) {
                    try {
                        const report = await dailyReportService.getDailyReportByDate(date)
                        if (report) {
                            reports.push(report)
                        }
                    } catch (e) {
                        // 忽略单个日报的错误
                        console.error(`Error fetching daily report for ${date}:`, e)
                    }
                }

                return reports
            } catch (e) {
                console.error('Error fetching daily reports from Tauri:', e)
                return []
            }
        } catch (error) {
            console.error('Error fetching daily reports in range:', error)
            return []
        }
    },

    // 获取两个日期之间的所有日期
    getDatesBetween(startDate: string, endDate: string): string[] {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const dates: string[] = []

        let current = new Date(start)
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0])
            current.setDate(current.getDate() + 1)
        }

        return dates
    }
} 