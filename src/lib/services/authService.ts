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
        if (_currentUser && _currentUser.id && _currentUser.id !== 'guest') {
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
            _currentUser = getCurrentUser() // 回退到同步方法
            return _currentUser
        }

        _currentUser = {
            id: data.user.id,
            email: data.user.email || 'anonymous@example.com',
            created_at: data.user.created_at || new Date().toISOString(),
            last_login: data.user.last_sign_in_at
        }

        // 同时更新currentUser属性
        if (authService) authService.currentUser = _currentUser

        return _currentUser
    } catch (error) {
        console.error('异步获取用户信息失败:', error)
        _currentUser = getCurrentUser() // 回退到同步方法
        return _currentUser
    }
}

// 导出authService对象
export const authService = {
    getCurrentUser,
    fetchCurrentUser,
    login: async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            // 更新用户信息
            if (data.user) {
                _currentUser = {
                    id: data.user.id,
                    email: data.user.email || 'anonymous@example.com',
                    created_at: data.user.created_at || new Date().toISOString(),
                    last_login: data.user.last_sign_in_at
                }

                // 设置currentUser属性
                authService.currentUser = _currentUser
            }

            return data.user
        } catch (error) {
            console.error('登录失败:', error)
            return null
        }
    },
    // 添加注册方法
    register: async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            })

            if (error) throw error
            return data.user
        } catch (error) {
            console.error('注册失败:', error)
            throw error
        }
    },
    // 添加重置密码方法
    resetPassword: async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email)
            if (error) throw error
            return true
        } catch (error) {
            console.error('重置密码失败:', error)
            throw error
        }
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
            // 使用getSession检查现有会话
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

            if (sessionError) {
                console.error('获取会话失败:', sessionError)
                _currentUser = getCurrentUser()
                authService.currentUser = _currentUser
                return false
            }

            if (sessionData.session) {
                // 如果有会话，使用getUser验证会话
                const { data: userData, error: userError } = await supabase.auth.getUser()

                if (userError) {
                    console.error('验证用户失败:', userError)
                    _currentUser = getCurrentUser()
                    authService.currentUser = _currentUser
                    return false
                }

                if (userData.user) {
                    _currentUser = {
                        id: userData.user.id,
                        email: userData.user.email || 'anonymous@example.com',
                        created_at: userData.user.created_at || new Date().toISOString(),
                        last_login: userData.user.last_sign_in_at
                    }
                    // 同时更新currentUser属性
                    authService.currentUser = _currentUser
                    console.log('已从会话恢复用户:', _currentUser.email)
                    return true
                }
            }

            // 如果没有会话，设置为当前用户
            _currentUser = getCurrentUser()
            authService.currentUser = _currentUser
            return true
        } catch (error) {
            console.error('初始化认证服务失败:', error)
            // 出错时设置为当前用户
            _currentUser = getCurrentUser()
            authService.currentUser = _currentUser
            return false
        }
    },
    isUserAuthenticated: (): boolean => {
        // 检查用户是否已认证(非匿名/访客)
        const user = getCurrentUser()
        return user.id !== 'guest' && user.id !== 'anonymous'
    },
    currentUser: null as User | null
} 