"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"
import { gitServiceUtils } from "@/services/GitService"

export default function GitProjectsConfig() {
    const [gitPaths, setGitPaths] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // 加载Git配置
    useEffect(() => {
        loadGitConfig()
    }, [])

    // 加载Git配置
    const loadGitConfig = async () => {
        try {
            setIsLoading(true)
            setError(null)

            const config = await gitServiceUtils.getConfig()
            setGitPaths(config.paths)

        } catch (err) {
            setError("加载Git配置失败")
            console.error("加载Git配置错误:", err)
        } finally {
            setIsLoading(false)
        }
    }

    // 添加新的Git仓库路径
    const handleAddPath = async () => {
        try {
            setIsLoading(true)
            setError(null)
            setSuccess(null)

            const newPath = await gitServiceUtils.addGitPath()
            if (newPath) {
                // 重新加载配置
                await loadGitConfig()
                setSuccess(`成功添加Git仓库: ${newPath}`)
            }
        } catch (err) {
            setError("添加Git仓库失败")
            console.error("添加Git仓库错误:", err)
        } finally {
            setIsLoading(false)
        }
    }

    // 移除Git仓库路径
    const handleRemovePath = async (path: string) => {
        try {
            setIsLoading(true)
            setError(null)
            setSuccess(null)

            await gitServiceUtils.removeGitPath(path)

            // 更新状态
            setGitPaths(prev => prev.filter(p => p !== path))
            setSuccess(`成功移除Git仓库: ${path}`)
        } catch (err) {
            setError("移除Git仓库失败")
            console.error("移除Git仓库错误:", err)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Git仓库配置</CardTitle>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert variant="default" className="mb-4">
                        {success}
                    </Alert>
                )}

                <div className="mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        配置Git仓库路径，系统将自动获取这些仓库的未提交更改作为日报内容。
                    </p>
                </div>

                {gitPaths.length === 0 ? (
                    <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                        <p>暂无配置的Git仓库</p>
                        <p className="text-sm mt-1">点击下方按钮添加仓库</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {gitPaths.map((path, index) => (
                            <li
                                key={index}
                                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-md"
                            >
                                <span className="text-sm truncate" style={{ maxWidth: "calc(100% - 100px)" }}>
                                    {path}
                                </span>
                                <Button
                                    variant="outline"
                                    size="small"
                                    onClick={() => handleRemovePath(path)}
                                    loading={isLoading}
                                >
                                    移除
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
            <CardFooter>
                <Button
                    onClick={handleAddPath}
                    loading={isLoading}
                    className="w-full"
                >
                    添加Git仓库
                </Button>
            </CardFooter>
        </Card>
    )
} 