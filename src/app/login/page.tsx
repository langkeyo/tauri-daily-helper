"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from "@/components/ui"
import { authService } from "@/lib/services"
import { LockIcon, MailIcon, Loader2 } from "lucide-react"

// 添加tailwind css动画类声明
const tailwindAnims = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}
`

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
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Tauri Daily Helper
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {isLogin ? '登录您的账户，开始每日规划' : '创建账户，开始您的高效之旅'}
                    </p>
                </div>

                <Card className="overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300">
                    <CardHeader className="space-y-1 pb-2 pt-6">
                        <CardTitle className="text-xl text-center font-semibold">
                            {isLogin ? '欢迎回来' : '注册新账户'}
                        </CardTitle>
                        <CardDescription className="text-center text-gray-500 dark:text-gray-400">
                            {isLogin ? '登录后即可使用云同步功能' : '创建账户来同步您的数据'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-4 px-6 sm:px-8">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-100 dark:border-red-800/50 animate-fadeIn">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-md border border-green-100 dark:border-green-800/50 animate-fadeIn">
                                {message}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    邮箱
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                        <MailIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="您的邮箱地址"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                        style={{ textIndent: "25px" }}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    密码
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                        <LockIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="您的密码"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                        style={{ textIndent: "25px" }}
                                        required
                                    />
                                </div>
                            </div>

                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        确认密码
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                            <LockIcon className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="再次输入密码"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2 border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                            style={{ textIndent: "25px" }}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full h-10 mt-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center">
                                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                        <span>{isLogin ? '登录中...' : '注册中...'}</span>
                                    </span>
                                ) : (
                                    <span>{isLogin ? '登录' : '注册'}</span>
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 pb-6 pt-1 px-6 sm:px-8">
                        <div className="flex justify-between items-center w-full text-sm">
                            <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200"
                                onClick={toggleMode}
                            >
                                {isLogin ? '没有账户？去注册' : '已有账户？去登录'}
                            </button>

                            {isLogin && (
                                <button
                                    type="button"
                                    className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
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
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm w-full transition-colors duration-200"
                                onClick={resendVerificationEmail}
                            >
                                重新发送验证邮件
                            </button>
                        )}

                        <div className="relative w-full my-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                                    本地与云端同步
                                </span>
                            </div>
                        </div>

                        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                            未登录时数据仅存储在本地设备<br />登录后可使用云同步功能
                        </p>
                    </CardFooter>
                </Card>
            </div>

            <style jsx global>{tailwindAnims}</style>
        </div>
    )
} 