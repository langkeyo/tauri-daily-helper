import { useEffect } from 'react'
import { AppProps } from 'next/app'
import { invoke } from '@tauri-apps/api/core'

function MyApp({ Component, pageProps }: AppProps) {

    // 在应用初始化时自动检查并修复数据库结构
    useEffect(() => {
        // 异步立即执行函数
        (async () => {
            try {
                console.log('应用初始化：检查数据库结构...')

                // 尝试使用后端命令修复结构
                const result = await invoke("add_user_id_column").catch(e => {
                    console.warn('通过Tauri命令添加user_id列失败:', e)
                    return null
                })

                if (result) {
                    console.log('数据库结构检查完成：', result)
                } else {
                    console.warn('数据库结构检查可能未完成，但应用将继续运行')
                }
            } catch (error) {
                console.error('数据库结构检查失败:', error)
                // 错误不会阻止应用继续运行
            }
        })()
    }, [])

    return <Component {...pageProps} />
}

export default MyApp 