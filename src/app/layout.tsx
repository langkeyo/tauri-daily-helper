import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Geist, Geist_Mono } from "next/font/google"
import "./nav-styles.css"
import IdleListener from "./IdleListener"
import ClientLayout from "@/components/ClientLayout"

const inter = Inter({ subsets: ['latin'] })

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: '每日助手',
  description: '一个简单的每日任务管理和日报生成工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <IdleListener />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
} 