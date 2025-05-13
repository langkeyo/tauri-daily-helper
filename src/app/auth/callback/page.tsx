"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Card } from "@/components/ui"

// 创建一个内部组件，使用useSearchParams
function CallbackHandler() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('正在处理认证...')

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // 获取URL中的认证信息
                const code = searchParams.get('code')

                if (!code) {
                    setStatus('error')
                    setMessage('认证失败: 缺少必要参数')
                    return
                }

                // 处理认证回调
                const { error } = await supabase.auth.exchangeCodeForSession(code)

                if (error) {
                    console.error('认证回调处理失败:', error)
                    setStatus('error')
                    setMessage(`认证失败: ${error.message}`)
                    return
                }

                // 尝试修复数据库可能的问题
                try {
                    const { db } = await import('@/lib/db')
                    console.log('数据库初始化成功')
                } catch (dbError) {
                    console.error('数据库初始化错误:', dbError)
                    // 记录错误但不阻止登录流程
                }

                // 认证成功
                setStatus('success')
                setMessage('认证成功！即将跳转到应用...')

                // 延迟跳转
                setTimeout(() => {
                    router.push('/')
                }, 2000)
            } catch (err) {
                console.error('认证回调处理出错:', err)
                setStatus('error')
                setMessage('认证过程出现错误，请稍后重试')
            }
        }

        handleCallback()
    }, [router, searchParams])

    return (
        <div className="text-center py-8">
            {status === 'loading' && (
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-color mb-4"></div>
                    <p>{message}</p>
                </div>
            )}

            {status === 'success' && (
                <div className="text-success-color">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-lg font-medium">{message}</p>
                </div>
            )}

            {status === 'error' && (
                <div className="text-danger-color">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <p className="text-lg font-medium">{message}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="mt-4 text-sm text-blue-500 hover:underline"
                    >
                        返回登录页面
                    </button>
                </div>
            )}
        </div>
    )
}

// 加载状态显示
function LoadingFallback() {
    return (
        <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-color mb-4"></div>
            <p>正在加载...</p>
        </div>
    )
}

// 主页面组件
export default function AuthCallback() {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <Card
                title="邮箱验证"
                className="w-full max-w-md"
            >
                <Suspense fallback={<LoadingFallback />}>
                    <CallbackHandler />
                </Suspense>
            </Card>
        </div>
    )
} 