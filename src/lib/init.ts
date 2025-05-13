import { syncService } from "./services/syncService"
import { authService } from "./services/authService"

// 初始化所有服务
export const initializeServices = () => {
    // 初始化认证服务
    authService.init().catch(error => {
        console.error('认证服务初始化失败:', error)
    })

    // 初始化同步服务
    syncService.init()

    // 如果在线，立即尝试刷新本地缓存
    if (navigator.onLine) {
        syncService.refreshLocalCache().catch(console.error)
    }

    // 测试Supabase连接
    syncService.testConnection()
        .then(result => {
            console.log('Supabase连接测试结果:', result.message)
        })
        .catch(error => {
            console.error('Supabase连接测试失败:', error)
        })

    console.log('服务已初始化')
} 