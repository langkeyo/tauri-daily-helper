'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert, AlertTitle } from '@/components/ui/Alert'
import { toast } from 'react-hot-toast'
import { PlusIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { Task } from '@/types'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export default function TaskList() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(false)
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [filter, setFilter] = useState('all')
    const [isOfflineMode, setIsOfflineMode] = useState(false)

    // 加载任务
    const loadTasks = async () => {
        try {
            setLoading(true)

            // 尝试从本地数据库加载任务
            let localTasks: Task[] = []
            try {
                // 在IndexedDB中对布尔值的处理可能不一致，确保使用0/1处理
                // 这里查询is_deleted等于0或者false的记录(非删除状态)
                const query = filter === 'all'
                    ? db.tasks.filter(task => !task.is_deleted)
                    : db.tasks.filter(task => task.status === filter && !task.is_deleted)

                localTasks = await query.toArray()

                // 如果本地有数据，先渲染
                if (localTasks.length > 0) {
                    console.log('从本地数据库加载到任务:', localTasks.length)
                    setTasks(localTasks)

                    // 如果是离线模式，就不再尝试从Supabase加载
                    if (isOfflineMode) {
                        setLoading(false)
                        return
                    }
                }
            } catch (localError) {
                console.error('从本地数据库加载任务失败:', localError)
            }

            // 检查tasks表是否存在
            try {
                // 先进行一次查询测试
                const { error } = await supabase
                    .from('tasks')
                    .select('count')
                    .limit(1)

                // 表不存在，尝试创建
                if (error && error.message && error.message.includes("relation \"public.tasks\" does not exist")) {
                    console.log('tasks表不存在，尝试创建...')

                    // 导入创建表函数
                    const { createTasksTableIfNotExists } = await import('@/lib/initSupabase')

                    // 尝试创建表
                    const created = await createTasksTableIfNotExists()
                    if (!created) {
                        throw new Error('无法创建tasks表')
                    }

                    console.log('tasks表创建成功，继续加载数据')
                }
            } catch (tableError) {
                console.error('检查或创建tasks表失败:', tableError)

                // 如果表创建失败但有本地数据，使用本地数据
                if (localTasks.length > 0) {
                    setIsOfflineMode(true)
                    toast.success('使用本地缓存数据 (离线模式)')
                    setLoading(false)
                    return
                }

                // 否则抛出错误
                throw tableError
            }

            // 构建Supabase查询
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('is_deleted', false)

            // 应用过滤器
            if (filter !== 'all') {
                query = query.eq('status', filter)
            }

            // 执行查询
            const { data, error } = await query.order('created_at', { ascending: false })

            if (error) {
                console.error('从Supabase加载任务失败:', error.message)
                setIsOfflineMode(true)
                // 如果从Supabase加载失败但本地有数据，使用本地数据
                if (localTasks.length > 0) {
                    setTasks(localTasks)
                    toast.success('使用本地缓存数据 (离线模式)')
                    setLoading(false)
                    return
                }
                throw error
            }

            // 更新任务列表
            if (data && data.length > 0) {
                console.log('从Supabase加载任务成功:', data.length)
                setTasks(data)

                // 更新本地数据库
                try {
                    await db.tasks.bulkPut(data)
                    console.log('更新本地任务缓存:', data.length)
                } catch (cacheError) {
                    console.error('缓存任务到本地失败:', cacheError)
                }
            } else {
                console.log('Supabase无任务数据')
                // 如果无数据但本地有缓存，保持使用本地数据
                if (localTasks.length === 0) {
                    setTasks([]) // 确保设置空数组表示无任务
                }
            }
        } catch (error) {
            console.error('加载任务失败:', error)
            toast.error('加载任务失败，请稍后重试')
            setIsOfflineMode(true)
        } finally {
            setLoading(false)
        }
    }

    // 添加新任务
    const addTask = async () => {
        if (!newTaskTitle.trim()) {
            toast.error('请输入任务标题')
            return
        }

        try {
            setLoading(true)

            // 获取当前用户ID
            let userId = 'guest'
            try {
                // 尝试获取当前登录的用户
                const { data: { user } } = await supabase.auth.getUser()
                if (user?.id) {
                    userId = user.id
                    console.log('使用已登录用户ID:', userId)
                } else {
                    console.log('用户未登录，使用guest用户ID')
                }
            } catch (authError) {
                console.warn('获取用户信息失败，使用guest用户ID:', authError)
            }

            // 生成唯一ID
            const taskId = uuidv4()

            // 创建新任务对象
            const newTask: Task = {
                id: taskId,
                title: newTaskTitle,
                description: null,
                status: 'todo',
                priority: 'medium',
                due_date: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: userId,
                project_id: null,
                tags: null,
                is_deleted: false
            }

            // 先保存到本地数据库
            try {
                await db.tasks.add(newTask)
                console.log('任务已添加到本地数据库')
            } catch (localError) {
                console.error('添加任务到本地数据库失败:', localError)
            }

            // 更新本地状态
            setTasks([newTask, ...tasks])
            setNewTaskTitle('')

            // 如果不是离线模式，同步到Supabase
            if (!isOfflineMode) {
                try {
                    const { data, error } = await supabase
                        .from('tasks')
                        .insert([newTask])
                        .select()
                        .single()

                    if (error) {
                        throw error
                    }

                    console.log('任务已同步到Supabase')
                } catch (syncError) {
                    console.error('同步任务到Supabase失败:', syncError)
                    setIsOfflineMode(true)
                    // 记录为离线操作，之后再同步
                    try {
                        await db.recordOfflineAction('tasks', 'create', newTask)
                        console.log('已记录创建任务的离线操作')
                    } catch (recordError) {
                        console.error('记录离线操作失败:', recordError)
                    }
                }
            } else {
                // 离线模式，记录操作以便稍后同步
                try {
                    await db.recordOfflineAction('tasks', 'create', newTask)
                    console.log('已记录创建任务的离线操作')
                } catch (recordError) {
                    console.error('记录离线操作失败:', recordError)
                }
            }

            toast.success('任务添加成功')

        } catch (error: any) {
            console.error('添加任务失败:', error.message)
            toast.error('添加任务失败，请稍后重试')
        } finally {
            setLoading(false)
        }
    }

    // 更新任务状态
    const updateTaskStatus = async (id: string, status: 'todo' | 'in_progress' | 'done') => {
        try {
            // 更新本地状态，即使在错误的情况下也能提供良好的用户体验
            setTasks(tasks.map(task =>
                task.id === id ? { ...task, status, updated_at: new Date().toISOString() } : task
            ))

            // 创建更新对象
            const updates = {
                status,
                updated_at: new Date().toISOString()
            }

            // 更新本地数据库
            try {
                await db.tasks.update(id, updates)
                console.log('任务状态已更新到本地数据库')
            } catch (localError) {
                console.error('更新任务状态到本地数据库失败:', localError)
                // 尝试使用put而不是update，以防用户ID不匹配
                try {
                    // 获取完整的任务对象
                    const task = tasks.find(t => t.id === id)
                    if (task) {
                        const updatedTask = { ...task, ...updates }
                        await db.tasks.put(updatedTask)
                        console.log('使用put方法更新任务状态成功')
                    }
                } catch (putError) {
                    console.error('使用put方法更新任务也失败:', putError)
                }
            }

            // 如果不是离线模式，同步到Supabase
            if (!isOfflineMode) {
                try {
                    const { error } = await supabase
                        .from('tasks')
                        .update(updates)
                        .eq('id', id)

                    if (error) {
                        console.warn('更新Supabase任务状态失败，记录为离线操作:', error)
                        await db.recordOfflineAction('tasks', 'update', { id, ...updates })
                    } else {
                        console.log('任务状态已同步到Supabase')
                    }
                } catch (syncError) {
                    console.error('同步任务状态到Supabase失败:', syncError)
                    setIsOfflineMode(true)
                    // 记录为离线操作，之后再同步
                    await db.recordOfflineAction('tasks', 'update', { id, ...updates })
                        .catch(e => console.error('记录离线操作失败:', e))
                }
            } else {
                // 离线模式，记录操作以便稍后同步
                await db.recordOfflineAction('tasks', 'update', { id, ...updates })
                    .catch(e => console.error('记录离线操作失败:', e))
            }

            toast.success('任务状态已更新')

        } catch (error: any) {
            console.error('更新任务状态失败:', error.message || error)
            toast.error('更新任务状态失败，但已在本地保存更改')
        }
    }

    // 删除任务（软删除）
    const deleteTask = async (id: string) => {
        try {
            // 更新本地状态
            setTasks(tasks.filter(task => task.id !== id))

            // 创建更新对象
            const updates = {
                is_deleted: true,
                updated_at: new Date().toISOString()
            }

            // 更新本地数据库
            try {
                await db.tasks.update(id, updates)
                console.log('任务已在本地数据库标记为删除')
            } catch (localError) {
                console.error('在本地数据库标记任务删除失败:', localError)
                // 尝试使用put而不是update
                try {
                    // 获取完整的任务对象
                    const task = await db.tasks.get(id)
                    if (task) {
                        const updatedTask = { ...task, ...updates }
                        await db.tasks.put(updatedTask)
                        console.log('使用put方法标记任务删除成功')
                    }
                } catch (putError) {
                    console.error('使用put方法标记任务删除也失败:', putError)
                }
            }

            // 如果不是离线模式，同步到Supabase
            if (!isOfflineMode) {
                try {
                    const { error } = await supabase
                        .from('tasks')
                        .update(updates)
                        .eq('id', id)

                    if (error) {
                        console.warn('删除Supabase任务失败，记录为离线操作:', error)
                        await db.recordOfflineAction('tasks', 'update', { id, ...updates })
                    } else {
                        console.log('任务删除已同步到Supabase')
                    }
                } catch (syncError) {
                    console.error('同步任务删除到Supabase失败:', syncError)
                    setIsOfflineMode(true)
                    // 记录为离线操作，之后再同步
                    await db.recordOfflineAction('tasks', 'update', { id, ...updates })
                        .catch(e => console.error('记录离线操作失败:', e))
                }
            } else {
                // 离线模式，记录操作以便稍后同步
                await db.recordOfflineAction('tasks', 'update', { id, ...updates })
                    .catch(e => console.error('记录离线操作失败:', e))
            }

            toast.success('任务已删除')

        } catch (error: any) {
            console.error('删除任务失败:', error.message)
            toast.error('删除任务失败')
        }
    }

    // 组件挂载时加载任务
    useEffect(() => {
        loadTasks()
    }, [filter])

    // 设置实时订阅
    useEffect(() => {
        // 只有在非离线模式下才设置实时订阅
        if (isOfflineMode) return

        // 监听任务变更
        const subscription = supabase
            .channel('tasks-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                (payload) => {
                    console.log('任务变更:', payload)
                    loadTasks() // 刷新任务列表
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [isOfflineMode])

    // 获取任务状态的样式
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'todo':
                return 'bg-yellow-100 text-yellow-800'
            case 'in_progress':
                return 'bg-blue-100 text-blue-800'
            case 'done':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100'
        }
    }

    // 获取任务优先级的样式
    const getPriorityClass = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-800'
            case 'medium':
                return 'bg-orange-100 text-orange-800'
            case 'low':
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100'
        }
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-md border-0 dark:bg-gray-800">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center flex-wrap gap-3">
                        <CardTitle className="text-xl font-bold">
                            我的任务 {isOfflineMode && <span className="text-sm font-normal text-amber-600">(离线模式)</span>}
                        </CardTitle>
                        <div className="flex gap-2">
                            <select
                                className="px-3 py-2 rounded-md border dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">全部任务</option>
                                <option value="todo">待办任务</option>
                                <option value="in_progress">进行中</option>
                                <option value="done">已完成</option>
                            </select>
                            <Button
                                variant="outline"
                                size="small"
                                onClick={loadTasks}
                                disabled={loading}
                                className="min-w-[80px] h-10"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '刷新'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    {/* 添加新任务 */}
                    <div className="flex gap-2 mb-6">
                        <Input
                            placeholder="输入新任务标题..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            disabled={loading}
                            className="h-11 dark:bg-gray-700"
                        />
                        <button
                            onClick={addTask}
                            disabled={loading || !newTaskTitle.trim()}
                            className="h-11 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            <span>添加任务</span>
                        </button>
                    </div>

                    {/* 任务列表 */}
                    <div className="space-y-4">
                        {loading && tasks.length === 0 ? (
                            <div className="text-center py-6">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                                <p className="mt-2 text-gray-500 dark:text-gray-400">正在加载任务...</p>
                            </div>
                        ) : tasks.length > 0 ? (
                            tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{task.title}</h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{task.description || '无描述'}</p>
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(task.status)}`}>
                                                    {task.status === 'todo' ? '待办' : task.status === 'in_progress' ? '进行中' : '已完成'}
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityClass(task.priority)}`}>
                                                    {task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
                                                </span>
                                                {task.due_date && (
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        截止: {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                variant="ghost"
                                                size="small"
                                                onClick={() => updateTaskStatus(task.id, 'todo')}
                                                disabled={task.status === 'todo' || loading}
                                                className="text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-900/20 dark:hover:text-yellow-300"
                                            >
                                                待办
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="small"
                                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                                disabled={task.status === 'in_progress' || loading}
                                                className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                                            >
                                                进行中
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="small"
                                                onClick={() => updateTaskStatus(task.id, 'done')}
                                                disabled={task.status === 'done' || loading}
                                                className="text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/20 dark:hover:text-green-300"
                                            >
                                                完成
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="small"
                                                onClick={() => deleteTask(task.id)}
                                                disabled={loading}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                                            >
                                                删除
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <Alert>
                                <AlertTitle>暂无任务</AlertTitle>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    您当前没有任何{filter !== 'all' ? (
                                        filter === 'todo' ? '待办' : filter === 'in_progress' ? '进行中' : '已完成'
                                    ) : ''}任务，请添加一个新任务开始使用。
                                </p>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
} 