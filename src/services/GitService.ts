import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"

export interface GitProject {
    id: string
    path: string
    name: string
    enabled: boolean
}

export interface GitChange {
    project: string
    changes: string[]
    lastCommit?: string
}

export interface GitConfig {
    paths: string[]
}

/**
 * Git服务，用于管理Git项目和获取变更信息
 */
class GitService {
    /**
     * 从本地存储加载Git项目配置
     */
    async loadProjects(): Promise<GitProject[]> {
        try {
            const savedProjects = localStorage.getItem('gitProjects')
            const isEnabled = localStorage.getItem('gitEnabled') === 'true'

            if (!isEnabled || !savedProjects) {
                return []
            }

            return JSON.parse(savedProjects)
        } catch (error) {
            console.error('加载Git项目失败:', error)
            return []
        }
    }

    /**
     * 检查Git功能是否启用
     */
    isGitEnabled(): boolean {
        return localStorage.getItem('gitEnabled') === 'true'
    }

    /**
     * 获取指定Git项目的未提交更改
     * @param project Git项目信息
     * @param prefix 每行变更的前缀，如"- "
     */
    async getProjectChanges(project: GitProject, prefix: string = "- "): Promise<string> {
        if (!project.enabled) {
            return ''
        }

        try {
            return await invoke('get_git_changes', {
                repo_path: project.path,
                prefix
            }) as string
        } catch (error) {
            console.error(`获取项目 ${project.name} 的变更失败:`, error)
            return ''
        }
    }

    /**
     * 获取指定Git项目的最后一次提交信息
     * @param project Git项目信息
     */
    async getLastCommit(project: GitProject): Promise<string> {
        if (!project.enabled) {
            return ''
        }

        try {
            return await invoke('get_git_last_commit', {
                repo_path: project.path
            }) as string
        } catch (error) {
            console.error(`获取项目 ${project.name} 的最后提交失败:`, error)
            return ''
        }
    }

    /**
     * 获取所有已配置Git项目的变更信息
     * @param prefix 每行变更的前缀
     */
    async getAllProjectsChanges(prefix: string = "- "): Promise<GitChange[]> {
        if (!this.isGitEnabled()) {
            return []
        }

        const projects = await this.loadProjects()
        if (projects.length === 0) {
            return []
        }

        const results: GitChange[] = []

        for (const project of projects) {
            if (!project.enabled) continue

            const changesText = await this.getProjectChanges(project, "")
            const lastCommit = await this.getLastCommit(project)

            // 解析变更文本为数组
            let changes: string[] = []
            if (changesText && changesText !== '无未提交的更改') {
                changes = changesText.split('\n').filter(line => line.trim() !== '')
            }

            if (changes.length > 0 || lastCommit) {
                results.push({
                    project: project.name,
                    changes,
                    lastCommit: lastCommit !== '无提交记录' ? lastCommit : undefined
                })
            }
        }

        return results
    }

    /**
     * 生成工作内容摘要，可用于日报
     */
    async generateWorkSummary(): Promise<string> {
        if (!this.isGitEnabled()) {
            return ''
        }

        const allChanges = await this.getAllProjectsChanges()
        if (allChanges.length === 0) {
            return ''
        }

        let summary = ''

        for (const projectChange of allChanges) {
            if (projectChange.changes.length > 0 || projectChange.lastCommit) {
                summary += `【${projectChange.project}】\n`

                if (projectChange.lastCommit) {
                    summary += `最近提交: ${projectChange.lastCommit}\n`
                }

                if (projectChange.changes.length > 0) {
                    summary += '未提交变更:\n'
                    projectChange.changes.forEach(change => {
                        summary += `- ${change}\n`
                    })
                }

                summary += '\n'
            }
        }

        return summary.trim()
    }

    /**
     * 从本地存储获取已保存的Git配置
     */
    static async getConfig(): Promise<GitConfig> {
        try {
            const configJson = localStorage.getItem('git_config')
            if (configJson) {
                return JSON.parse(configJson)
            }
        } catch (error) {
            console.error('读取Git配置失败:', error)
        }

        // 返回默认配置
        return { paths: [] }
    }

    /**
     * 保存Git配置到本地存储
     */
    static async saveConfig(config: GitConfig): Promise<void> {
        try {
            localStorage.setItem('git_config', JSON.stringify(config))
        } catch (error) {
            console.error('保存Git配置失败:', error)
            throw new Error('保存Git配置失败')
        }
    }

    /**
     * 添加Git仓库路径到配置
     */
    static async addGitPath(): Promise<string | null> {
        try {
            // 打开文件夹对话框选择Git仓库
            const repoPath = await open({
                directory: true,
                multiple: false,
                title: "选择Git仓库根目录"
            })

            if (!repoPath || Array.isArray(repoPath)) {
                return null
            }

            // 添加到配置
            const config = await this.getConfig()
            if (!config.paths.includes(repoPath)) {
                config.paths.push(repoPath)
                await this.saveConfig(config)
            }

            return repoPath
        } catch (error) {
            console.error('添加Git路径失败:', error)
            throw new Error('添加Git路径失败')
        }
    }

    /**
     * 移除Git仓库路径
     */
    static async removeGitPath(path: string): Promise<void> {
        try {
            const config = await this.getConfig()
            config.paths = config.paths.filter(p => p !== path)
            await this.saveConfig(config)
        } catch (error) {
            console.error('移除Git路径失败:', error)
            throw new Error('移除Git路径失败')
        }
    }

    /**
     * 获取指定仓库的未提交更改
     */
    static async getChanges(repoPath: string, prefix: string = "- "): Promise<string> {
        try {
            return await invoke<string>("get_git_changes", {
                repoPath,
                prefix
            })
        } catch (error) {
            console.error('获取Git更改失败:', error)
            throw new Error(`获取仓库 ${repoPath} 的更改失败`)
        }
    }

    /**
     * 获取所有已配置仓库的未提交更改
     */
    static async getAllChanges(prefix: string = "- "): Promise<{ [path: string]: string }> {
        const config = await this.getConfig()
        const results: { [path: string]: string } = {}

        for (const path of config.paths) {
            try {
                const changes = await this.getChanges(path, prefix)
                if (changes && changes.trim().length > 0) {
                    results[path] = changes
                }
            } catch (error) {
                console.error(`获取仓库 ${path} 的更改失败:`, error)
                // 继续处理其他仓库
            }
        }

        return results
    }
}

export const gitServiceUtils = {
    /**
     * 获取所有已配置仓库的未提交更改
     */
    getAllChanges: async (prefix: string = "- "): Promise<{ [path: string]: string }> => {
        return GitService.getAllChanges(prefix)
    },

    /**
     * 添加Git仓库路径到配置
     */
    addGitPath: async (): Promise<string | null> => {
        return GitService.addGitPath()
    },

    /**
     * 移除Git仓库路径
     */
    removeGitPath: async (path: string): Promise<void> => {
        return GitService.removeGitPath(path)
    },

    /**
     * 获取Git配置
     */
    getConfig: async (): Promise<GitConfig> => {
        return GitService.getConfig()
    }
}

export default new GitService() 