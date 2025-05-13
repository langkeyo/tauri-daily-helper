// 核心数据类型定义

// 用户类型
export interface User {
    id: string
    email: string
    created_at: string
    last_login?: string
}

// 任务类型 - 与Supabase模型完全匹配
export interface Task {
    id: string
    user_id: string
    title: string
    description?: string | null
    status: 'todo' | 'in_progress' | 'done'
    priority: 'low' | 'medium' | 'high'
    due_date?: string | null
    created_at: string
    updated_at: string
    tags?: string[] | null
    project_id?: string | null
    is_deleted: boolean
}

export interface NewTask {
    title: string
    description?: string
    status: 'todo' | 'in_progress' | 'done'
    priority: 'low' | 'medium' | 'high'
    due_date?: string
    tags?: string[]
    project_id?: string
    user_id?: string
}

export interface TaskUpdate {
    title?: string
    description?: string
    status?: 'todo' | 'in_progress' | 'done'
    priority?: 'low' | 'medium' | 'high'
    due_date?: string
    tags?: string[]
    project_id?: string
    is_deleted?: boolean
    updated_at?: string
}

// 项目类型
export interface Project {
    id: string
    user_id: string
    name: string
    description?: string
    color?: string
    created_at: string
    updated_at: string
    is_archived?: boolean
}

// 日报类型 - 与Supabase模型完全匹配
export interface DailyReport {
    id?: number
    user_id: string
    date: string
    task_id?: string | null
    task_name?: string | null
    should_complete?: string | null
    completed?: string | null
    uncompleted?: string | null
    plan_hours?: string | null
    actual_hours?: string | null
    remarks?: string | null
    created_at?: string
    updated_at?: string
}

// 周报类型
export interface WeeklyReport {
    id?: string
    user_id?: string
    start_date: string
    end_date: string
    summary: string
    completed_tasks: string
    next_week_plan: string
    issues?: string
    remarks?: string
    created_at?: string
    updated_at?: string
}

// 离线操作记录
export interface OfflineAction {
    id?: number
    table: string
    action: 'create' | 'update' | 'delete'
    data: any
    timestamp: number
    synced: boolean // 改为布尔值，更直观
}

// 过滤器选项
export interface TaskFilters {
    status?: 'todo' | 'in_progress' | 'done'
    priority?: 'low' | 'medium' | 'high'
    projectId?: string
    dueDateFrom?: string
    dueDateTo?: string
    searchText?: string
    user_id?: string
    is_deleted?: boolean
}

// 错误类型
export class AppError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'AppError'
    }
}

export class AuthError extends AppError {
    constructor(message: string) {
        super(message)
        this.name = 'AuthError'
    }
}

export class NetworkError extends AppError {
    constructor(message: string) {
        super(message)
        this.name = 'NetworkError'
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

// Supabase数据库类型定义
export type Database = {
    public: {
        Tables: {
            tasks: {
                Row: Task
                Insert: NewTask
                Update: TaskUpdate
            }
            dailies: {
                Row: DailyReport
                Insert: Omit<DailyReport, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<DailyReport, 'id' | 'created_at'>>
            }
        }
    }
} 