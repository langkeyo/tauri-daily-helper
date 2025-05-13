"use client"
import { useState, useEffect } from "react"
import { Card, Input, TextArea, Button } from "@/components/ui"
import { taskService } from "@/lib/services"
import { supabase } from "@/lib/supabaseClient"
import { initializeDatabase } from "@/lib/initSupabase"
import type { Task, NewTask, TaskFilters } from "@/types"
import TaskList from '@/components/TaskList'
import DatabaseInitializer from '@/components/DatabaseInitializer'

export default function TasksPage() {
    // 组件加载时自动初始化数据库
    useEffect(() => {
        const autoInit = async () => {
            try {
                console.log("自动初始化数据库...")
                await initializeDatabase()
                console.log("数据库初始化完成")
            } catch (error) {
                console.error("数据库初始化失败:", error)
                // 失败时仍然显示页面，DatabaseInitializer组件会显示错误
            }
        }

        autoInit()
    }, [])

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">任务管理</h1>
            </div>

            {/* 数据库初始化组件 - 现在自动初始化，只在有错误时显示 */}
            <DatabaseInitializer />

            {/* 任务列表组件 - 包含所有任务管理功能 */}
            <TaskList />
        </div>
    )
} 