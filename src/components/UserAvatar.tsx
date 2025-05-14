"use client"
import { useState, useEffect, useRef } from "react"
import { authService } from "@/lib/services"
import type { User } from "@/types"
import Link from "next/link"

export default function UserAvatar() {
    const [user, setUser] = useState<User | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // 更新用户状态
    const updateUserStatus = () => {
        const currentUser = authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(authService.isUserAuthenticated())
        console.log('用户状态更新:', currentUser, '认证状态:', authService.isUserAuthenticated())
    }

    // 初始化
    useEffect(() => {
        // 初始获取用户状态
        updateUserStatus()

        // 监听认证状态变化
        const handleAuthChange = (e: CustomEvent) => {
            const { isAuthenticated, user } = e.detail
            setIsAuthenticated(isAuthenticated)
            setUser(user)
            console.log('认证状态变化:', isAuthenticated, user)
        }

        window.addEventListener('auth_change', handleAuthChange as EventListener)

        // 点击其他地方关闭下拉菜单
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            window.removeEventListener('auth_change', handleAuthChange as EventListener)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // 监听dropdownOpen变化，每次打开下拉菜单时更新用户状态
    useEffect(() => {
        if (dropdownOpen) {
            updateUserStatus()
        }
    }, [dropdownOpen])

    // 处理登出
    const handleLogout = async () => {
        try {
            await authService.logout()
            updateUserStatus() // 登出后立即更新用户状态
            setDropdownOpen(false)
        } catch (error) {
            console.error('登出失败:', error)
            alert('登出失败，请重试')
        }
    }

    // 获取用户头像
    const getInitials = (email: string) => {
        if (!email || email === 'anonymous@local' || email === 'guest@example.com') return '游'
        return email.charAt(0).toUpperCase()
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                className="user-avatar"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                title={user?.email || '未登录'}
                aria-label="用户菜单"
                aria-expanded={dropdownOpen}
            >
                {user ? getInitials(user.email) : '游'}
            </button>

            {dropdownOpen && (
                <div className="user-dropdown">
                    <div className="user-dropdown-header">
                        <p className="user-email">{user?.email || '未登录用户'}</p>
                        <p className="user-status">
                            {isAuthenticated ? '已登录' : '本地模式'}
                        </p>
                    </div>

                    <div className="user-dropdown-divider"></div>

                    <Link
                        href="/profile"
                        className="user-dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span>个人信息</span>
                    </Link>

                    <Link
                        href="/settings"
                        className="user-dropdown-item"
                        onClick={() => setDropdownOpen(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>系统设置</span>
                    </Link>

                    <div className="user-dropdown-divider"></div>

                    {isAuthenticated ? (
                        <button
                            className="user-dropdown-item"
                            onClick={handleLogout}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            <span>退出登录</span>
                        </button>
                    ) : (
                        <Link
                            href="/login"
                            className="user-dropdown-item"
                            onClick={() => setDropdownOpen(false)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                            <span>登录/注册</span>
                        </Link>
                    )}
                </div>
            )}
        </div>
    )
} 