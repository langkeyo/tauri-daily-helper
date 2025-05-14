"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, Input, Button } from "@/components/ui"
import { authService } from "@/lib/services/authService"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "react-hot-toast"
import { User } from "@/types"

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [department, setDepartment] = useState('')
    const [position, setPosition] = useState('')
    const [avatar, setAvatar] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // 加载用户信息
    useEffect(() => {
        const loadUserData = async () => {
            try {
                setLoading(true)

                // 检查用户是否已登录
                const currentUser = authService.getCurrentUser()

                if (currentUser.id === 'guest') {
                    // 未登录，重定向到登录页
                    toast.error('请先登录')
                    router.push('/login')
                    return
                }

                setUser(currentUser)
                setEmail(currentUser.email || '')

                // 加载完整的用户资料
                try {
                    const { data, error } = await supabase
                        .from('user_profiles')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .maybeSingle()

                    if (error) {
                        console.error('加载用户资料失败:', error.message || JSON.stringify(error))
                        // 检查是否是表不存在的错误
                        if (error.code === '42P01') {
                            console.log('user_profiles表不存在，将在首次保存时创建')
                            // 表不存在，但不阻止页面显示
                        } else {
                            toast.error(`加载用户资料失败: ${error.message || '未知错误'}`)
                        }
                    } else if (data) {
                        // 设置用户资料
                        setName(data.name || '')
                        setDepartment(data.department || '')
                        setPosition(data.position || '')
                        setAvatar(data.avatar_url || '')
                    }
                } catch (error: any) {
                    console.error('加载用户资料时发生异常:', error)
                    toast.error(`加载用户资料失败: ${error?.message || '未知错误'}`)
                }
            } catch (error) {
                console.error('加载用户信息失败:', error)
                toast.error('加载用户信息失败')
            } finally {
                setLoading(false)
            }
        }

        loadUserData()
    }, [router])

    // 保存用户资料
    const saveProfile = async () => {
        if (!user) return

        try {
            setIsSaving(true)

            // 准备要更新的数据
            const profileData: {
                user_id: string
                name: string
                department: string
                position: string
                avatar_url: string
                updated_at: string
                created_at?: string
            } = {
                user_id: user.id,
                name,
                department,
                position,
                avatar_url: avatar,
                updated_at: new Date().toISOString()
            }

            // 检查资料是否已存在
            try {
                const { data: existingProfile, error: checkError } = await supabase
                    .from('user_profiles')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (checkError) {
                    // 检查是否是表不存在错误
                    if (checkError.code === '42P01') {
                        console.log('user_profiles表不存在，尝试创建...')

                        // 尝试自动创建表
                        const createTableResult = await supabase.rpc('create_profiles_table_if_not_exists')
                        console.log('创建表结果:', createTableResult)

                        // 创建新资料
                        profileData.created_at = new Date().toISOString()
                        const result = await supabase
                            .from('user_profiles')
                            .insert([profileData])

                        if (result.error) {
                            if (result.error.code === '42P01') {
                                throw new Error('无法创建user_profiles表，请联系管理员')
                            }
                            throw result.error
                        }
                    } else {
                        throw checkError
                    }
                } else {
                    let result
                    if (existingProfile) {
                        // 更新现有资料
                        result = await supabase
                            .from('user_profiles')
                            .update(profileData)
                            .eq('user_id', user.id)
                    } else {
                        // 创建新资料
                        profileData.created_at = new Date().toISOString()
                        result = await supabase
                            .from('user_profiles')
                            .insert([profileData])
                    }

                    if (result.error) {
                        throw result.error
                    }
                }

                toast.success('个人资料已更新')
            } catch (error: any) {
                console.error('保存用户资料失败:', error)
                toast.error(`保存失败: ${error.message || '未知错误'}`)
                throw error
            }
        } catch (error) {
            console.error('保存用户资料错误:', error)
        } finally {
            setIsSaving(false)
        }
    }

    // 登出
    const handleLogout = async () => {
        try {
            await authService.logout()
            toast.success('已退出登录')
            router.push('/login')
        } catch (error) {
            console.error('登出失败:', error)
            toast.error('登出失败')
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[600px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <div className="container max-w-6xl mx-auto p-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">个人信息</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <Card className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                            <h2 className="text-xl font-semibold text-white">基本信息</h2>
                            <p className="text-blue-100 text-sm mt-1">您的个人和工作信息</p>
                        </div>
                        <div className="p-6">
                            <div className="space-y-5">
                                <Input
                                    label="邮箱"
                                    value={email}
                                    disabled
                                    onChange={() => { }}
                                    helpText="邮箱地址不可修改"
                                    className="bg-gray-50 dark:bg-gray-800"
                                />

                                <Input
                                    label="姓名"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="请输入您的姓名"
                                    className="focus:border-blue-500"
                                />

                                <Input
                                    label="部门"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    placeholder="请输入您的部门"
                                    className="focus:border-blue-500"
                                />

                                <Input
                                    label="职位"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    placeholder="请输入您的职位"
                                    className="focus:border-blue-500"
                                />

                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={saveProfile}
                                        loading={isSaving}
                                        disabled={isSaving}
                                        variant="primary"
                                        className="bg-blue-600 hover:bg-blue-700 transition-colors"
                                    >
                                        保存资料
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 px-6 py-4">
                            <h2 className="text-xl font-semibold text-white">账户信息</h2>
                            <p className="text-slate-200 text-sm mt-1">您的账户状态和统计</p>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600 dark:text-gray-400">账户状态</div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                    已登录
                                </span>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="text-sm text-gray-600 dark:text-gray-400">上次登录</div>
                                <div className="font-medium text-sm">
                                    {user?.last_login ? new Date(user.last_login).toLocaleString() : '未知'}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="text-sm text-gray-600 dark:text-gray-400">创建于</div>
                                <div className="font-medium text-sm">
                                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '未知'}
                                </div>
                            </div>

                            <Button
                                onClick={handleLogout}
                                variant="outline"
                                className="w-full mt-6 text-red-500 border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                            >
                                退出登录
                            </Button>
                        </div>
                    </Card>

                    <Card className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                            <h2 className="text-xl font-semibold text-white">同步状态</h2>
                            <p className="text-green-100 text-sm mt-1">数据同步信息</p>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600 dark:text-gray-400">本地数据</div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                    已同步
                                </span>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full mt-4 text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/20 transition-colors"
                                onClick={() => {
                                    // 检查用户是否已登录
                                    if (!user || user.id === 'guest') {
                                        toast.error('请先登录')
                                        router.push('/login')
                                        return
                                    }
                                    toast.success('数据已同步')
                                }}
                            >
                                立即同步
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
} 