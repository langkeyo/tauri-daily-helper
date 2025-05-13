'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Loader2 } from 'lucide-react'
import { initializeDatabase } from '@/lib/initSupabase'

export default function DatabaseInitializer() {
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [initialized, setInitialized] = useState<boolean>(false)
    const [retryCount, setRetryCount] = useState<number>(0)

    // 组件挂载时自动初始化数据库
    useEffect(() => {
        const autoInitializeDatabase = async () => {
            try {
                console.log('自动初始化数据库...')
                setLoading(true)
                setError(null)

                // 使用initSupabase中的函数初始化数据库
                const result = await initializeDatabase()

                console.log('数据库初始化成功:', result)
                setInitialized(true)

                // 即使处于离线模式，也算成功初始化
                if (result && result.offlineMode) {
                    console.log('数据库处于离线模式')
                }

                setError(null)
            } catch (err: any) {
                console.error('数据库初始化失败:', err)
                setError(err.message || '数据库初始化失败，请刷新页面重试')
                setInitialized(false)
            } finally {
                setLoading(false)
            }
        }

        autoInitializeDatabase()
    }, [retryCount]) // 依赖retryCount，当重试计数改变时重新尝试初始化

    // 手动重试初始化
    const handleRetry = () => {
        setRetryCount(prev => prev + 1)
    }

    // 初始化成功时不显示任何内容
    if (initialized) {
        return null
    }

    // 加载中显示简单的加载指示器
    if (loading) {
        return (
            <div className="flex items-center justify-center p-4 mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Loader2 className="h-5 w-5 mr-2 text-blue-500 animate-spin" />
                <span className="text-blue-700 dark:text-blue-300">初始化数据库...</span>
            </div>
        )
    }

    // 只有在发生错误时才显示错误信息
    if (error) {
        return (
            <Alert variant="destructive" className="mb-4">
                <AlertTitle>数据库初始化问题</AlertTitle>
                <AlertDescription>
                    <div className="mb-3">{error}</div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm">
                            应用将以离线模式运行。部分功能可能不可用。
                        </span>
                        <Button
                            onClick={handleRetry}
                            variant="outline"
                            size="small"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    重试中...
                                </>
                            ) : '重试初始化'}
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        )
    }

    return null
} 