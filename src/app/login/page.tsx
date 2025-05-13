"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, Input, Button } from "@/components/ui"
import { authService } from "@/lib/services"

export default function LoginPage() {
    const router = useRouter()
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    // 如果已经登录，重定向到首页
    useEffect(() => {
        if (authService.isUserAuthenticated()) {
            router.push('/')
        }
    }, [router])

    // 处理表单提交
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setMessage('')

        // 表单验证
        if (!email || !password) {
            setError('请填写邮箱和密码')
            return
        }

        if (!isLogin && password !== confirmPassword) {
            setError('两次输入的密码不一致')
            return
        }

        try {
            setIsLoading(true)

            if (isLogin) {
                // 登录
                await authService.login(email, password)
                setMessage('登录成功，即将跳转...')
                setTimeout(() => router.push('/'), 1500)
            } else {
                // 注册
                await authService.register(email, password)
                setMessage('注册成功，请验证邮箱后登录')
                // 切换到登录模式
                setIsLogin(true)
            }
        } catch (err: any) {
            console.error('操作失败:', err)
            if (err.message) {
                if (err.message.includes('Invalid login credentials')) {
                    setError('邮箱或密码错误')
                } else if (err.message.includes('Email not confirmed')) {
                    setError('邮箱未验证，请检查您的邮箱并点击验证链接')
                    // 添加可以重新发送验证邮件的提示
                    setMessage('如未收到验证邮件，请尝试重新注册以发送新的验证邮件')
                } else if (err.message.includes('already registered')) {
                    setError('该邮箱已注册，请直接登录')
                } else if (err.message.includes('IDBKeyRange') || err.message.includes('indexedDB')) {
                    // 处理IndexedDB相关错误
                    setError('浏览器存储出现问题。请尝试以下步骤:')
                    setMessage(`
                        1. 清除浏览器缓存和Cookie
                        2. 如使用隐私模式浏览，请切换到普通模式
                        3. 刷新页面后重试登录
                        4. 如问题仍然存在，请尝试使用其他浏览器
                    `)
                } else {
                    setError(err.message)
                }
            } else {
                setError(isLogin ? '登录失败' : '注册失败')
            }
        } finally {
            setIsLoading(false)
        }
    }

    // 处理忘记密码
    const handleForgotPassword = async () => {
        if (!email) {
            setError('请输入您的邮箱')
            return
        }

        try {
            setIsLoading(true)
            await authService.resetPassword(email)
            setMessage('密码重置链接已发送到您的邮箱')
        } catch (err: any) {
            console.error('重置密码失败:', err)
            setError('重置密码失败，请稍后重试')
        } finally {
            setIsLoading(false)
        }
    }

    // 切换登录/注册模式
    const toggleMode = () => {
        setIsLogin(!isLogin)
        setError('')
        setMessage('')
    }

    // 添加重新发送验证邮件的功能
    const resendVerificationEmail = async () => {
        if (!email) {
            setError('请输入您的邮箱')
            return
        }

        try {
            setIsLoading(true)
            // 假装注册来触发重新发送验证邮件
            await authService.register(email, password)
            setMessage('验证邮件已重新发送，请检查您的邮箱')
        } catch (err: any) {
            // 如果提示"already registered"，说明邮件已经发送
            if (err.message && err.message.includes('already registered')) {
                setMessage('验证邮件已重新发送，请检查您的邮箱')
            } else {
                console.error('发送验证邮件失败:', err)
                setError('发送验证邮件失败，请稍后重试')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
            <Card
                title={isLogin ? "用户登录" : "用户注册"}
                subtitle={isLogin ? "登录您的账户以使用云同步功能" : "创建新账户以使用云同步功能"}
                className="w-full max-w-md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="success-message">
                                {message}
                            </div>
                        )}
                    </div>

                    <Input
                        label="邮箱"
                        type="email"
                        placeholder="请输入邮箱"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <Input
                        label="密码"
                        type="password"
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {!isLogin && (
                        <Input
                            label="确认密码"
                            type="password"
                            placeholder="请再次输入密码"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    )}

                    <div className="flex flex-col gap-3 mt-6">
                        <Button
                            type="submit"
                            variant="primary"
                            loading={isLoading}
                            className="w-full"
                        >
                            {isLogin ? '登录' : '注册'}
                        </Button>

                        <div className="flex justify-between items-center mt-2 text-sm">
                            <button
                                type="button"
                                className="text-blue-500 hover:text-blue-700"
                                onClick={toggleMode}
                            >
                                {isLogin ? '没有账户？去注册' : '已有账户？去登录'}
                            </button>

                            {isLogin && (
                                <button
                                    type="button"
                                    className="text-gray-500 hover:text-gray-700"
                                    onClick={handleForgotPassword}
                                >
                                    忘记密码？
                                </button>
                            )}
                        </div>

                        {/* 添加重新发送验证邮件按钮，当显示了邮箱未验证的错误时 */}
                        {error && error.includes('邮箱未验证') && (
                            <button
                                type="button"
                                className="text-blue-500 hover:text-blue-700 mt-2 text-sm w-full"
                                onClick={resendVerificationEmail}
                            >
                                重新发送验证邮件
                            </button>
                        )}
                    </div>
                </form>

                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>未登录时，数据仅存储在本地设备</p>
                    <p>登录后可使用云同步，跨设备访问您的数据</p>
                </div>
            </Card>
        </div>
    )
} 