"use client"

import { useState, useEffect } from "react"
import { Card, Button } from "@/components/ui"
// 移除直接导入
// import { invoke } from "@tauri-apps/api/tauri"
import { toast } from "react-hot-toast"
import { supabase } from "@/lib/supabaseClient"
import { db } from "@/lib/db"
import { isTauriApp, invokeTauri } from "@/lib/tauriHelper"

interface SettingOption {
    id: string
    label: string
    description: string
    type: "toggle" | "select" | "button"
    value?: boolean | string
    options?: Array<{ value: string, label: string }>
    action?: () => Promise<void>
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(false)
    const [isTauri, setIsTauri] = useState(false)
    const [darkMode, setDarkMode] = useState(false)
    const [autoSync, setAutoSync] = useState(true)
    const [offlineMode, setOfflineMode] = useState(false)

    // 检测当前环境
    useEffect(() => {
        const checkEnvironment = () => {
            // 使用辅助函数检测Tauri环境
            setIsTauri(isTauriApp())

            // 检测当前主题模式
            if (typeof window !== 'undefined') {
                const isDark = localStorage.getItem('theme') === 'dark' ||
                    (localStorage.getItem('theme') === null &&
                        window.matchMedia('(prefers-color-scheme: dark)').matches)
                setDarkMode(isDark)

                // 应用主题
                if (isDark) {
                    document.documentElement.classList.add('dark')
                } else {
                    document.documentElement.classList.remove('dark')
                }
            }

            // 从localStorage加载其他设置
            const storedAutoSync = localStorage.getItem('autoSync')
            setAutoSync(storedAutoSync === null ? true : storedAutoSync === 'true')

            const storedOfflineMode = localStorage.getItem('offlineMode')
            setOfflineMode(storedOfflineMode === 'true')
        }

        checkEnvironment()
    }, [])

    // 切换主题
    const toggleTheme = async () => {
        const newDarkMode = !darkMode
        setDarkMode(newDarkMode)

        if (newDarkMode) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }

        toast.success(`已切换到${newDarkMode ? '暗色' : '亮色'}主题`)
    }

    // 切换自动同步
    const toggleAutoSync = async () => {
        const newAutoSync = !autoSync
        setAutoSync(newAutoSync)
        localStorage.setItem('autoSync', String(newAutoSync))
        toast.success(`已${newAutoSync ? '开启' : '关闭'}自动同步`)
    }

    // 切换离线模式
    const toggleOfflineMode = async () => {
        const newOfflineMode = !offlineMode
        setOfflineMode(newOfflineMode)
        localStorage.setItem('offlineMode', String(newOfflineMode))
        toast.success(`已${newOfflineMode ? '开启' : '关闭'}离线模式`)
    }

    // 清除本地数据
    const clearLocalData = async () => {
        if (!confirm('确定要清除所有本地数据吗？此操作无法撤销。')) return

        try {
            setLoading(true)
            await db.delete()

            // 重新初始化数据库
            await db.open()

            toast.success('本地数据已清除')
        } catch (error) {
            console.error('清除数据失败:', error)
            toast.error('清除数据失败')
        } finally {
            setLoading(false)
        }
    }

    // 同步所有本地数据到云端
    const syncAllData = async () => {
        try {
            setLoading(true)

            // 检查是否登录
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('请先登录')
                return
            }

            // 获取所有离线操作
            const offlineActions = await db.offlineActions
                .where('synced')
                .equals(false)
                .toArray()

            if (offlineActions.length === 0) {
                toast.success('没有需要同步的数据')
                return
            }

            // 执行所有离线操作
            for (const action of offlineActions) {
                try {
                    // 根据操作类型执行同步
                    switch (action.action) {
                        case 'create':
                            await supabase.from(action.table).insert([action.data])
                            break
                        case 'update':
                            await supabase.from(action.table).update(action.data).eq('id', action.data.id)
                            break
                        case 'delete':
                            await supabase.from(action.table).delete().eq('id', action.data.id)
                            break
                    }

                    // 标记为已同步
                    await db.offlineActions.update(action.id, { synced: true })
                } catch (error) {
                    console.error(`同步操作失败:`, action, error)
                    // 继续处理其他操作
                }
            }

            toast.success('数据同步完成')
        } catch (error) {
            console.error('同步数据失败:', error)
            toast.error('同步数据失败')
        } finally {
            setLoading(false)
        }
    }

    // 重置应用
    const resetApp = async () => {
        if (!confirm('确定要重置应用吗？这将清除所有本地数据和设置，应用将恢复到初始状态。此操作无法撤销。')) return

        try {
            setLoading(true)

            // 清除本地存储
            localStorage.clear()

            // 清除IndexedDB
            await db.delete()

            // 清除主题
            document.documentElement.classList.remove('dark')

            // 重置状态
            setDarkMode(false)
            setAutoSync(true)
            setOfflineMode(false)

            toast.success('应用已重置，请刷新页面')

            // 如果是Tauri应用，重启应用
            if (isTauri) {
                try {
                    // 使用辅助函数调用Tauri API
                    await invokeTauri('restart_app')
                } catch (e) {
                    // 如果无法重启，提示用户手动重启
                    toast.error('请手动重启应用以完成重置')
                }
            } else {
                // 浏览器环境下，刷新页面
                window.location.reload()
            }
        } catch (error) {
            console.error('重置应用失败:', error)
            toast.error('重置应用失败')
        } finally {
            setLoading(false)
        }
    }

    // 应用设置项
    const appSettings: SettingOption[] = [
        {
            id: 'theme',
            label: '暗色主题',
            description: '启用暗色主题模式',
            type: 'toggle',
            value: darkMode,
            action: toggleTheme
        },
        {
            id: 'startup',
            label: '开机自启动',
            description: '系统启动时自动运行应用（仅桌面版）',
            type: 'toggle',
            value: false,
            action: async () => {
                if (!isTauri) {
                    toast.error('此功能仅在桌面版应用中可用')
                    return
                }
                toast.info('功能开发中')
            }
        }
    ]

    // 数据设置项
    const dataSettings: SettingOption[] = [
        {
            id: 'autoSync',
            label: '自动同步',
            description: '在有网络连接时自动同步数据',
            type: 'toggle',
            value: autoSync,
            action: toggleAutoSync
        },
        {
            id: 'offlineMode',
            label: '离线模式',
            description: '禁用网络功能，仅使用本地数据',
            type: 'toggle',
            value: offlineMode,
            action: toggleOfflineMode
        },
        {
            id: 'syncNow',
            label: '立即同步',
            description: '手动同步所有本地数据到云端',
            type: 'button',
            action: syncAllData
        },
        {
            id: 'clearData',
            label: '清除本地数据',
            description: '删除所有本地缓存数据（不影响云端数据）',
            type: 'button',
            action: clearLocalData
        }
    ]

    // 高级设置项
    const advancedSettings: SettingOption[] = [
        {
            id: 'resetApp',
            label: '重置应用',
            description: '将应用恢复到初始状态，清除所有本地数据和设置',
            type: 'button',
            action: resetApp
        }
    ]

    // 渲染设置项
    const renderSetting = (setting: SettingOption) => {
        return (
            <div key={setting.id} className="py-4 flex items-start justify-between border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{setting.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{setting.description}</p>
                </div>
                <div className="ml-4 flex-shrink-0">
                    {setting.type === 'toggle' && (
                        <button
                            className={`relative inline-flex h-6 w-11 items-center rounded-full 
                                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                ${setting.value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                            onClick={setting.action}
                            disabled={loading}
                            aria-checked={setting.value}
                            role="switch"
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm 
                                    transition-transform duration-200 ease-in-out
                                    ${setting.value ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    )}
                    {setting.type === 'button' && (
                        <Button
                            variant={setting.id === 'resetApp' ? 'danger' : 'outline'}
                            size="small"
                            onClick={setting.action}
                            loading={loading}
                            disabled={loading}
                            className={
                                setting.id === 'resetApp'
                                    ? 'bg-red-600 hover:bg-red-700 transition-colors'
                                    : 'border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors'
                            }
                        >
                            {setting.id === 'resetApp' ? '重置' : '执行'}
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="container max-w-6xl mx-auto p-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">系统设置</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <h2 className="text-xl font-semibold text-white">应用设置</h2>
                        <p className="text-purple-100 text-sm mt-1">基本应用配置选项</p>
                    </div>
                    <div className="p-6">
                        <div className="divide-y dark:divide-gray-700">
                            {appSettings.map(renderSetting)}
                        </div>
                    </div>
                </Card>

                <Card className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <h2 className="text-xl font-semibold text-white">数据设置</h2>
                        <p className="text-blue-100 text-sm mt-1">数据同步和管理选项</p>
                    </div>
                    <div className="p-6">
                        <div className="divide-y dark:divide-gray-700">
                            {dataSettings.map(renderSetting)}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mt-8">
                <Card className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                        <h2 className="text-xl font-semibold text-white">高级设置</h2>
                        <p className="text-red-100 text-sm mt-1">谨慎使用这些功能</p>
                    </div>
                    <div className="p-6">
                        <div className="divide-y dark:divide-gray-700">
                            {advancedSettings.map(renderSetting)}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>Tauri Daily Helper v0.1.1</p>
                <p className="mt-1">Made with ❤️ by Claude 3.7 Sonnet</p>
            </div>
        </div>
    )
} 