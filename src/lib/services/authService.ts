import { supabase } from "@/lib/supabaseClient"
import { db } from "@/lib/db"
import type { User } from "@/types"

// 本地用户状态管理
const LOCAL_USER_KEY = 'daily_helper_user'

// 本地存储的匿名用户
let anonymousUser: User = {
    id: 'anonymous',
    email: 'anonymous@local',
    created_at: new Date().toISOString()
}

let _currentUser: User | null = null

/**
 * 获取当前登录用户
 * 即使没有用户登录，也会返回一个带有guest ID的默认用户对象
 */
export const getCurrentUser = (): User => {
    try {
        // 如果已经有缓存的用户，直接返回
        if (_currentUser && _currentUser.id) {
            // 确保currentUser属性也被设置
            if (authService) authService.currentUser = _currentUser
            return _currentUser
        }

        // 尝试从localStorage获取会话
        const storedSession = localStorage.getItem('supabase.auth.token')

        // 如果有会话，解析并获取用户信息
        if (storedSession) {
            try {
                const session = JSON.parse(storedSession)
                if (session?.currentSession?.user) {
                    const user = session.currentSession.user
                    _currentUser = {
                        id: user.id,
                        email: user.email || 'anonymous@example.com',
                        created_at: user.created_at || new Date().toISOString(),
                        last_login: user.last_sign_in_at
                    }
                    // 设置currentUser属性
                    if (authService) authService.currentUser = _currentUser
                    return _currentUser
                }
            } catch (parseError) {
                console.warn('解析存储的会话失败:', parseError)
            }
        }

        // 如果没有找到有效的用户，返回guest用户
        const guestUser = {
            id: 'guest',
            email: 'guest@example.com',
            created_at: new Date().toISOString()
        }
        // 设置currentUser属性
        if (authService) authService.currentUser = guestUser
        return guestUser
    } catch (error) {
        console.error('获取当前用户失败:', error)
        // 出错时返回guest用户
        const guestUser = {
            id: 'guest',
            email: 'guest@example.com',
            created_at: new Date().toISOString()
        }
        // 设置currentUser属性
        if (authService) authService.currentUser = guestUser
        return guestUser
    }
}

/**
 * 异步获取当前用户，直接从Supabase服务获取最新信息
 */
export const fetchCurrentUser = async (): Promise<User> => {
    try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data.user) {
            console.warn('从Supabase获取用户失败:', error)
            return getCurrentUser() // 回退到同步方法
        }

        _currentUser = {
            id: data.user.id,
            email: data.user.email || 'anonymous@example.com',
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: data.user.last_sign_in_at
        }

        return _currentUser
    } catch (error) {
        console.error('异步获取用户信息失败:', error)
        return getCurrentUser() // 回退到同步方法
    }
}

// 导出authService对象
export const authService = {
    getCurrentUser,
    fetchCurrentUser,
    login: async (email: string, password: string) => {
        // 待实现
        return null
    },
    logout: async () => {
        try {
            await supabase.auth.signOut()
            _currentUser = null
            return true
        } catch (error) {
            console.error('登出失败:', error)
            return false
        }
    },
    isLoggedIn: (): boolean => {
        const user = getCurrentUser()
        return user.id !== 'guest'
    },
    // 添加初始化方法
    init: async () => {
        // 尝试从本地存储恢复会话
        try {
            const { data, error } = await supabase.auth.getSession()
            if (data.session) {
                _currentUser = {
                    id: data.session.user.id,
                    email: data.session.user.email || 'anonymous@example.com',
                    created_at: data.session.user.created_at || new Date().toISOString(),
                    last_login: data.session.user.last_sign_in_at
                }
                // 同时更新currentUser属性
                authService.currentUser = _currentUser
                console.log('已从会话恢复用户:', _currentUser.email)
            } else {
                // 如果没有会话，设置为当前用户
                _currentUser = getCurrentUser()
                authService.currentUser = _currentUser
            }
        } catch (error) {
            console.error('初始化认证服务失败:', error)
            // 出错时设置为当前用户
            _currentUser = getCurrentUser()
            authService.currentUser = _currentUser
        }
        return true
    },
    isUserAuthenticated: (): boolean => {
        // 检查用户是否已认证(非匿名/访客)
        const user = getCurrentUser()
        return user.id !== 'guest' && user.id !== 'anonymous'
    },
    currentUser: null as User | null
} 