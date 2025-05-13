import { supabase } from "@/lib/supabaseClient"
import { db } from "@/lib/db"
import type { Task, NewTask, TaskUpdate, TaskFilters } from "@/types"

export const taskService = {
    // 获取任务列表
    async getTasks(filters?: TaskFilters): Promise<Task[]> {
        try {
            // 构建本地查询
            let cachedTasks: Task[] = []

            if (filters) {
                // 复杂过滤条件组合，使用filter函数代替链式API
                cachedTasks = await db.tasks
                    .filter(task => {
                        // 检查状态
                        if (filters.status && task.status !== filters.status) {
                            return false
                        }

                        // 检查优先级
                        if (filters.priority && task.priority !== filters.priority) {
                            return false
                        }

                        // 检查项目ID
                        if (filters.projectId && task.project_id !== filters.projectId) {
                            return false
                        }

                        // 检查日期范围
                        if (filters.dueDateFrom && task.due_date && task.due_date < filters.dueDateFrom) {
                            return false
                        }

                        if (filters.dueDateTo && task.due_date && task.due_date > filters.dueDateTo) {
                            return false
                        }

                        // 搜索文本
                        if (filters.searchText) {
                            const searchLower = filters.searchText.toLowerCase()
                            const titleMatch = task.title.toLowerCase().includes(searchLower)
                            const descMatch = task.description?.toLowerCase().includes(searchLower) || false

                            if (!titleMatch && !descMatch) {
                                return false
                            }
                        }

                        return true
                    })
                    .toArray()
            } else {
                // 无过滤条件，获取所有未删除的任务
                cachedTasks = await db.tasks
                    .filter(task => !task.is_deleted)
                    .toArray()
            }

            if (cachedTasks.length > 0) {
                // 返回缓存结果并在后台刷新
                this.refreshTasks(filters)
                return cachedTasks
            }

            // 本地无缓存，从 Supabase 获取
            return await this.refreshTasks(filters)
        } catch (error) {
            console.error("Error fetching tasks:", error)
            return []
        }
    },

    // 从 Supabase 刷新任务
    async refreshTasks(filters?: TaskFilters): Promise<Task[]> {
        try {
            // 构建查询
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('is_deleted', false)

            // 应用过滤条件
            if (filters?.status) {
                query = query.eq('status', filters.status)
            }

            if (filters?.priority) {
                query = query.eq('priority', filters.priority)
            }

            if (filters?.projectId) {
                query = query.eq('project_id', filters.projectId)
            }

            if (filters?.dueDateFrom) {
                query = query.gte('due_date', filters.dueDateFrom)
            }

            if (filters?.dueDateTo) {
                query = query.lte('due_date', filters.dueDateTo)
            }

            if (filters?.searchText) {
                query = query.or(`title.ilike.%${filters.searchText}%,description.ilike.%${filters.searchText}%`)
            }

            // 执行查询
            const { data, error } = await query.order('due_date', { ascending: true })

            if (error) throw error

            // 更新本地缓存
            if (data && data.length > 0) {
                await db.tasks.bulkPut(data)
            }

            return data || []
        } catch (error) {
            console.error("Error refreshing tasks:", error)
            return []
        }
    },

    // 创建新任务
    async createTask(task: NewTask): Promise<Task> {
        // 客户端生成 UUID
        const newTask = {
            ...task,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false
        }

        try {
            // 添加到本地缓存
            await db.tasks.add(newTask as Task)

            // 发送到服务器
            const { data, error } = await supabase
                .from('tasks')
                .insert(newTask)
                .select()
                .single()

            if (error) {
                // 记录为离线操作
                await db.recordOfflineAction('tasks', 'create', newTask)
                throw error
            }

            // 更新本地缓存中的记录
            await db.tasks.put(data)

            return data
        } catch (error) {
            console.error("Error creating task:", error)

            // 记录为离线操作
            await db.recordOfflineAction('tasks', 'create', newTask)

            // 仍然返回本地创建的任务
            return newTask as Task
        }
    },

    // 更新任务
    async updateTask(taskId: string, updates: TaskUpdate): Promise<Task> {
        const updateData = {
            ...updates,
            updated_at: new Date().toISOString(),
        }

        try {
            // 更新本地缓存
            await db.tasks.update(taskId, updateData)

            // 发送到服务器
            const { data, error } = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId)
                .select()
                .single()

            if (error) {
                // 记录为离线操作
                await db.recordOfflineAction('tasks', 'update', { id: taskId, ...updateData })
                throw error
            }

            // 确保本地缓存与服务器同步
            await db.tasks.put(data)

            return data
        } catch (error) {
            console.error("Error updating task:", error)

            // 记录为离线操作
            await db.recordOfflineAction('tasks', 'update', { id: taskId, ...updateData })

            // 返回本地更新后的任务
            return await db.tasks.get(taskId) as Task
        }
    },

    // 删除任务（软删除）
    async deleteTask(taskId: string): Promise<void> {
        try {
            // 本地更新
            await db.tasks.update(taskId, {
                is_deleted: true,
                updated_at: new Date().toISOString()
            })

            // 发送到服务器
            const { error } = await supabase
                .from('tasks')
                .update({ is_deleted: true })
                .eq('id', taskId)

            if (error) {
                // 记录为离线操作
                await db.recordOfflineAction('tasks', 'update', { id: taskId, is_deleted: true })
                throw error
            }
        } catch (error) {
            console.error("Error deleting task:", error)

            // 记录为离线操作
            await db.recordOfflineAction('tasks', 'update', { id: taskId, is_deleted: true })
        }
    },

    // 获取单个任务详情
    async getTaskById(taskId: string): Promise<Task | null> {
        try {
            // 先查本地缓存
            const cachedTask = await db.tasks.get(taskId)

            if (cachedTask) {
                // 返回缓存结果并在后台刷新
                this.refreshTaskById(taskId)
                return cachedTask
            }

            // 本地无缓存，从服务器获取
            return await this.refreshTaskById(taskId)
        } catch (error) {
            console.error("Error fetching task:", error)
            return null
        }
    },

    // 从服务器刷新单个任务
    async refreshTaskById(taskId: string): Promise<Task | null> {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single()

            if (error) throw error

            // 更新本地缓存
            if (data) {
                await db.tasks.put(data)
            }

            return data
        } catch (error) {
            console.error("Error refreshing task:", error)
            return null
        }
    }
} 