import XlsxPopulate from 'xlsx-populate'
import { saveAs } from 'file-saver'
import { invoke } from '@tauri-apps/api/tauri'
import { open } from '@tauri-apps/api/dialog'
import { Task } from '@/types'

/**
 * Excel服务，处理模板和导出功能
 */
export const excelService = {
    /**
     * 使用模板导出任务数据到Excel
     * @param tasks 任务数据
     * @param position 岗位信息
     * @param additionalData 额外信息
     */
    async exportTasksWithTemplate(
        tasks: Task[],
        position: string,
        additionalData?: {
            reportDate?: string
            userName?: string
            department?: string
        }
    ) {
        try {
            // 1. 选择模板文件
            const templatePath = await open({
                multiple: false,
                filters: [{
                    name: 'Excel模板',
                    extensions: ['xlsx']
                }]
            }) as string

            if (!templatePath) {
                throw new Error('未选择模板文件')
            }

            // 2. 读取模板文件
            const templateArrayBuffer = await invoke<number[]>('read_binary_file', {
                path: templatePath
            })

            // 将number[]转换为ArrayBuffer
            const buffer = new Uint8Array(templateArrayBuffer).buffer

            // 3. 加载模板
            const workbook = await XlsxPopulate.fromDataAsync(buffer)

            // 4. 获取第一个工作表
            const sheet = workbook.sheet(0)

            // 5. 填充数据
            // 基本信息
            sheet.cell("B2").value(additionalData?.userName || "")
            sheet.cell("D2").value(additionalData?.department || "")
            sheet.cell("F2").value(position || "")
            sheet.cell("B3").value(additionalData?.reportDate || new Date().toLocaleDateString())

            // 任务数据 - 假设模板从B5开始是任务表格
            let rowIndex = 5
            tasks.forEach(task => {
                // 标题
                sheet.cell(`B${rowIndex}`).value(task.title)

                // 描述
                sheet.cell(`C${rowIndex}`).value(task.description || "")

                // 完成状态
                sheet.cell(`D${rowIndex}`).value(task.status === "completed" ? "已完成" : "进行中")

                // 备注
                sheet.cell(`E${rowIndex}`).value("")

                rowIndex++
            })

            // 6. 生成文件并下载
            const outputBlob = await workbook.outputAsync()
            saveAs(outputBlob, `工作周报-${additionalData?.reportDate || new Date().toLocaleDateString()}.xlsx`)

            return true
        } catch (error) {
            console.error('导出Excel失败:', error)
            throw error
        }
    },

    /**
     * 导出每日任务报告到Excel
     */
    async exportDailyReport(
        dailyTasks: Task[],
        position: string,
        additionalData?: {
            reportDate?: string
            userName?: string
            department?: string
        }
    ) {
        return this.exportTasksWithTemplate(dailyTasks, position, additionalData)
    },

    /**
     * 导出周报到Excel
     */
    async exportWeeklyReport(
        weeklyTasks: Task[],
        position: string,
        additionalData?: {
            weekRange?: string
            userName?: string
            department?: string
        }
    ) {
        return this.exportTasksWithTemplate(weeklyTasks, position, {
            reportDate: additionalData?.weekRange || "",
            userName: additionalData?.userName,
            department: additionalData?.department
        })
    }
} 