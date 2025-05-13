"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/Card"
import { Button } from "./ui/Button"
import { Alert } from "./ui/Alert"
import { gitServiceUtils } from "@/services/GitService"

interface GitSummaryProps {
    onAddToReport?: (changes: string) => void
}

export default function GitSummary({ onAddToReport }: GitSummaryProps) {
    const [changes, setChanges] = useState<{ [path: string]: string }>({})
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showDetails, setShowDetails] = useState(false)

    // 加载Git变更
    useEffect(() => {
        loadGitChanges()
    }, [])

    // 加载所有配置仓库的Git变更
    const loadGitChanges = async () => {
        try {
            setIsLoading(true)
            setError(null)

            // 使用导出的工具函数
            const allChanges = await gitServiceUtils.getAllChanges("- ")
            setChanges(allChanges)

            // 如果没有发现变更，提示用户
            const hasChanges = Object.keys(allChanges).length > 0
            if (!hasChanges) {
                setSuccess("没有找到未提交的变更，或未配置Git仓库")
            }

        } catch (err) {
            setError("获取Git变更失败")
            console.error("获取Git变更错误:", err)
        } finally {
            setIsLoading(false)
        }
    }

    // 将所有变更添加到日报
    const handleAddAllToReport = () => {
        if (!onAddToReport) return

        // 将所有变更合并为一个字符串
        const allChangesText = Object.entries(changes)
            .map(([path, changesText]) => {
                // 提取仓库名称（最后一个文件夹名）
                const repoName = path.split(/[\\/]/).pop() || path
                return `【${repoName}】\n${changesText}`
            })
            .join("\n\n")

        // 调用回调函数
        if (allChangesText) {
            onAddToReport(allChangesText)
            setSuccess("Git变更已添加到日报")
        } else {
            setError("没有变更可添加")
        }
    }

    // 格式化仓库路径
    const formatRepoPath = (path: string): string => {
        // 获取最后一个文件夹名作为仓库名
        const repoName = path.split(/[\\/]/).pop() || path
        return repoName
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Git变更摘要</CardTitle>
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
                        显示所有配置Git仓库的未提交更改，可一键添加到日报。
                    </p>
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="small"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? "隐藏详情" : "显示详情"}
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                        <p>加载Git变更中...</p>
                    </div>
                ) : Object.keys(changes).length === 0 ? (
                    <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                        <p>暂无未提交的Git变更，或未配置Git仓库</p>
                        <p className="text-sm mt-1">在设置中配置Git仓库后，再次刷新</p>
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        <p>发现 {Object.keys(changes).length} 个仓库的变更</p>
                        {showDetails && (
                            <div className="mt-2 space-y-4">
                                {Object.entries(changes).map(([path, changesText]) => (
                                    <div key={path} className="border-l-2 border-blue-500 pl-3">
                                        <p className="font-medium">{formatRepoPath(path)}</p>
                                        <pre className="text-xs overflow-auto whitespace-pre-wrap mt-2 max-h-40">
                                            {changesText}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <div className="flex gap-2 w-full">
                    <Button
                        variant="outline"
                        size="medium"
                        onClick={loadGitChanges}
                        loading={isLoading}
                        className="flex-1"
                    >
                        刷新变更
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleAddAllToReport}
                        loading={isLoading}
                        disabled={Object.keys(changes).length === 0 || !onAddToReport}
                        className="flex-1"
                    >
                        添加到日报
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
} 