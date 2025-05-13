"use client"

import { useState } from 'react'
import { Card, Button } from './ui'

/**
 * 数据库错误处理组件
 * 提供用户解决IndexedDB错误的方法
 */
export default function DatabaseErrorHandler() {
    const [isFixed, setIsFixed] = useState(false)
    const [isFixing, setIsFixing] = useState(false)
    const [message, setMessage] = useState('')

    // 尝试修复数据库
    const fixDatabase = async () => {
        try {
            setIsFixing(true)
            setMessage('正在尝试修复数据库...')

            // 导入数据库模块
            const { db } = await import('@/lib/db')

            // 清除离线操作记录，这常常是引起问题的原因
            await db.offlineActions.clear()

            setMessage('数据库已重置，请刷新页面重试')
            setIsFixed(true)
        } catch (error) {
            console.error('修复数据库失败:', error)
            setMessage(`修复失败: ${error}。请尝试手动清除浏览器缓存。`)
        } finally {
            setIsFixing(false)
        }
    }

    // 删除整个数据库
    const deleteDatabase = async () => {
        try {
            setIsFixing(true)
            setMessage('正在删除数据库...')

            // 使用IndexedDB API删除整个数据库
            const deleteRequest = window.indexedDB.deleteDatabase('dailyHelperDB')

            deleteRequest.onsuccess = () => {
                setMessage('数据库已删除，请刷新页面重试')
                setIsFixed(true)
            }

            deleteRequest.onerror = () => {
                setMessage('删除数据库失败，请尝试手动清除浏览器缓存')
            }
        } catch (error) {
            console.error('删除数据库失败:', error)
            setMessage(`删除失败: ${error}。请尝试手动清除浏览器缓存。`)
        } finally {
            setIsFixing(false)
        }
    }

    // 检查Supabase服务器连接和表结构问题
    const checkSupabaseTableStructure = async () => {
        try {
            setIsFixing(true)
            setMessage('正在检查Supabase表结构...')

            // 导入supabase客户端
            const { supabase } = await import('@/lib/supabaseClient')

            // 尝试获取dailies表的结构信息
            const { data, error } = await supabase
                .from('dailies')
                .select('*')
                .limit(1)

            if (error) {
                if (error.message.includes('user_id')) {
                    setMessage(`
                        检测到Supabase表结构问题: ${error.message}
                        
                        需要在Supabase中的dailies表添加user_id列:
                        1. 登录Supabase管理界面
                        2. 进入SQL编辑器
                        3. 执行: ALTER TABLE dailies ADD COLUMN user_id TEXT;
                    `)
                } else {
                    setMessage(`Supabase连接问题: ${error.message}`)
                }
            } else {
                // 检查返回的数据结构
                const columns = data && data[0] ? Object.keys(data[0]) : []
                setMessage(`Supabase连接正常，可用列: ${columns.join(', ')}`)
            }
        } catch (error) {
            console.error('检查Supabase表结构失败:', error)
            setMessage(`检查失败: ${error}。可能是网络问题或认证问题。`)
        } finally {
            setIsFixing(false)
        }
    }

    return (
        <Card
            title="修复数据库错误"
            subtitle="遇到数据库相关错误时，您可以尝试以下步骤"
            className="max-w-md mx-auto my-8"
        >
            <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded border border-amber-200">
                    <p className="font-medium text-amber-800">检测到数据库错误</p>
                    <p className="text-sm text-amber-700 mt-1">
                        这通常是由于浏览器的IndexedDB存储出现问题导致的。您可以尝试使用下面的工具修复，或者按照手动步骤操作。
                    </p>
                </div>

                <div className="space-y-2">
                    <Button
                        variant="primary"
                        onClick={fixDatabase}
                        loading={isFixing}
                        disabled={isFixed}
                        className="w-full"
                    >
                        修复数据库
                    </Button>

                    <Button
                        variant="danger"
                        onClick={deleteDatabase}
                        loading={isFixing}
                        disabled={isFixed}
                        className="w-full"
                    >
                        删除并重建数据库
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={checkSupabaseTableStructure}
                        loading={isFixing}
                        className="w-full"
                    >
                        检查Supabase表结构
                    </Button>
                </div>

                {message && (
                    <div className={`p-3 rounded ${isFixed ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
                        {message}
                    </div>
                )}

                <div>
                    <h3 className="font-medium text-gray-800 mb-2">手动修复步骤：</h3>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
                        <li>清除浏览器缓存和Cookie</li>
                        <li>如使用隐私模式浏览，请切换到普通模式</li>
                        <li>刷新页面后重试登录</li>
                        <li>尝试使用其他浏览器</li>
                        <li>确保您的浏览器支持并启用了IndexedDB功能</li>
                    </ol>
                </div>
            </div>
        </Card>
    )
} 