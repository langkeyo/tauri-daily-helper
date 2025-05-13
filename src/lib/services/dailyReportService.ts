import { invoke } from "@tauri-apps/api/core"
import { supabase } from "@/lib/supabaseClient"
import { db } from "@/lib/db"
import type { DailyReport } from "@/types"

export const dailyReportService = {
    // 获取指定日期的日报
    async getDailyReportByDate(date: string): Promise<DailyReport | null> {
        try {
            // 先查本地缓存
            const cachedReport = await db.dailyReports
                .where('date')
                .equals(date)
                .first()

            if (cachedReport) {
                // 返回缓存结果并在后台刷新
                this.refreshDailyReport(date)
                return cachedReport
            }

            // 本地无缓存，从 Supabase 获取
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('date', date)
                .single()

            if (error) {
                // 如果 Supabase 请求失败，回退到 Tauri 命令
                const report = await invoke<DailyReport>("get_daily_report_by_date", { date })

                // 缓存到本地数据库
                if (report) {
                    await db.dailyReports.put(report)
                }

                return report
            }

            // 更新本地缓存
            if (data) {
                await db.dailyReports.put(data)
            }

            return data
        } catch (error) {
            console.error('Error fetching daily report:', error)

            // 最后尝试使用 Tauri 命令
            try {
                return await invoke<DailyReport>("get_daily_report_by_date", { date })
            } catch (e) {
                console.error('Fallback to Tauri command failed:', e)
                return null
            }
        }
    },

    // 从 Supabase 刷新日报
    async refreshDailyReport(date: string): Promise<DailyReport | null> {
        try {
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('date', date)
                .single()

            if (error) throw error

            // 更新本地缓存
            if (data) {
                await db.dailyReports.put(data)
            }

            return data
        } catch (error) {
            console.error('Error refreshing daily report:', error)
            return null
        }
    },

    // 保存日报
    async saveDailyReport(report: DailyReport): Promise<DailyReport> {
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
            await db.dailyReports.put(report)

            // 尝试同步到 Supabase
            const { data, error } = await supabase
                .from('daily_reports')
                .upsert(report)
                .select()
                .single()

            if (error) {
                // 记录为离线操作
                await db.recordOfflineAction('daily_reports', 'update', report)
                throw error
            }

            // 同步到 Tauri 后端
            await invoke("save_daily_report", { report })

            // 返回服务器返回的数据
            return data || report
        } catch (error) {
            console.error('Error saving daily report:', error)

            // 记录为离线操作
            await db.recordOfflineAction('daily_reports', 'update', report)

            // 尝试使用 Tauri 命令保存
            try {
                await invoke("save_daily_report", { report })
            } catch (e) {
                console.error('Fallback to Tauri command failed:', e)
            }

            // 返回本地对象
            return report
        }
    },

    // 获取最近的日报
    async getRecentDailyReports(limit: number = 10): Promise<DailyReport[]> {
        try {
            // 先查本地缓存
            const cachedReports = await db.dailyReports
                .orderBy('date')
                .reverse()
                .limit(limit)
                .toArray()

            if (cachedReports.length > 0) {
                // 返回缓存结果并在后台刷新
                this.refreshRecentDailyReports(limit)
                return cachedReports
            }

            // 本地无缓存，从 Supabase 获取
            return await this.refreshRecentDailyReports(limit)
        } catch (error) {
            console.error('Error fetching recent daily reports:', error)

            // 回退到 Tauri 命令
            try {
                return await invoke<DailyReport[]>("get_recent_daily_reports")
            } catch (e) {
                console.error('Fallback to Tauri command failed:', e)
                return []
            }
        }
    },

    // 从 Supabase 刷新最近的日报
    async refreshRecentDailyReports(limit: number = 10): Promise<DailyReport[]> {
        try {
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .order('date', { ascending: false })
                .limit(limit)

            if (error) throw error

            // 更新本地缓存
            if (data && data.length > 0) {
                await db.dailyReports.bulkPut(data)
            }

            return data || []
        } catch (error) {
            console.error('Error refreshing recent daily reports:', error)

            // 尝试使用 Tauri 命令获取
            try {
                const reports = await invoke<DailyReport[]>("get_recent_daily_reports")
                return reports
            } catch (e) {
                console.error('Fallback to Tauri command failed:', e)
                return []
            }
        }
    },

    // 删除日报
    async deleteDailyReport(id: string): Promise<void> {
        try {
            // 本地删除
            await db.dailyReports.delete(id)

            // 从 Supabase 删除
            const { error } = await supabase
                .from('daily_reports')
                .delete()
                .eq('id', id)

            if (error) {
                // 记录为离线操作
                await db.recordOfflineAction('daily_reports', 'delete', { id })
                throw error
            }
        } catch (error) {
            console.error('Error deleting daily report:', error)

            // 记录为离线操作
            await db.recordOfflineAction('daily_reports', 'delete', { id })
        }
    }
} 