/**
 * Tauri API 助手
 * 安全地检测和调用Tauri API，避免在浏览器环境中报错
 */

/**
 * 检查当前是否在Tauri环境中运行
 */
export function isTauriApp(): boolean {
    return typeof window !== 'undefined' &&
        // @ts-ignore - __TAURI__ 在类型定义中不存在，但在运行时存在
        window.__TAURI__ !== undefined
}

/**
 * 安全地调用Tauri命令
 * @param command 命令名称
 * @param args 命令参数
 * @returns 命令返回值的Promise，如果不在Tauri环境则返回null
 */
export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
    if (!isTauriApp()) {
        console.warn(`尝试在非Tauri环境调用命令: ${command}`)
        return null
    }

    try {
        // 动态导入Tauri API
        const { invoke } = await import('@tauri-apps/api/core')
        return await invoke<T>(command, args)
    } catch (error) {
        console.error(`调用Tauri命令失败: ${command}`, error)
        throw error
    }
}

/**
 * 安全地打开文件选择对话框
 * @param options 对话框选项
 */
export async function openFileDialog(options?: {
    multiple?: boolean
    filters?: { name: string; extensions: string[] }[]
    defaultPath?: string
}): Promise<string | string[] | null> {
    if (!isTauriApp()) {
        console.warn('尝试在非Tauri环境打开文件对话框')
        return null
    }

    try {
        // 动态导入对话框API
        const { open } = await import('@tauri-apps/api/dialog')
        return await open(options)
    } catch (error) {
        console.error('打开文件对话框失败', error)
        throw error
    }
}

/**
 * 安全地打开保存文件对话框
 * @param options 对话框选项
 */
export async function saveFileDialog(options?: {
    filters?: { name: string; extensions: string[] }[]
    defaultPath?: string
}): Promise<string | null> {
    if (!isTauriApp()) {
        console.warn('尝试在非Tauri环境打开保存对话框')
        return null
    }

    try {
        // 动态导入对话框API
        const { save } = await import('@tauri-apps/api/dialog')
        return await save(options)
    } catch (error) {
        console.error('打开保存对话框失败', error)
        throw error
    }
} 