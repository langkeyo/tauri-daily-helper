"use client"

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from "next/link"
import UserAvatar from "@/components/UserAvatar"
import ThemeToggle from "@/components/ThemeToggle"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)

    // 关闭菜单，当用户点击链接或在大屏幕尺寸下
    useEffect(() => {
        setMenuOpen(false)

        const handleResize = () => {
            if (window.innerWidth > 768) {
                setMenuOpen(false)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [pathname])

    // 导航链接数据
    const navLinks = [
        { href: '/daily', label: '日报' },
        { href: '/weekly', label: '周报' },
        { href: '/monthly', label: '月报' },
        { href: '/tasks', label: '任务管理' },
        { href: '/template', label: '模板' },
        { href: '/notify', label: '通知' },
        { href: '/dingtalk', label: '钉钉集成' },
    ]

    return (
        <>
            <header className="sticky top-0 z-10 backdrop-blur-sm">
                <nav className="nav-container">
                    <div className="nav-start">
                        <Link href="/" className="brand">
                            日报助手
                        </Link>
                        <button
                            className="mobile-menu-button"
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {menuOpen ? (
                                    <>
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </>
                                ) : (
                                    <>
                                        <line x1="4" y1="8" x2="20" y2="8"></line>
                                        <line x1="4" y1="16" x2="20" y2="16"></line>
                                    </>
                                )}
                            </svg>
                        </button>
                        <div className={`nav-links ${menuOpen ? 'show' : ''}`}>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`nav-link ${pathname === link.href ? 'active' : ''}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="nav-end">
                        <ThemeToggle />
                        <div className="user-container">
                            <UserAvatar />
                        </div>
                    </div>
                </nav>
            </header>
            <div className="content-container">
                {children}
            </div>
        </>
    )
} 