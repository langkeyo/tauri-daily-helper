"use client"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import Link from "next/link"

interface DailyReport {
  date: string
  task_id?: string
  task_name?: string
  should_complete: string
  completed: string
  uncompleted: string
  plan_hours?: string
  actual_hours?: string
  remarks: string
}

function getTaskIdForToday(dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date()
  let day = date.getDay()
  if (day === 0) day = 7 // 周日
  return `FE-${String(day).padStart(3, '0')}`
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
      <div className="max-w-4xl w-full rounded-lg bg-white shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">日报助手</h1>

        <div className="mb-8">
          <p className="text-lg mb-4">
            欢迎使用日报助手，这是一个基于Tauri构建的跨平台日报管理工具，帮助您高效管理和生成日报、周报和月报。
          </p>

          <div className="flex flex-wrap -mx-2 mt-6">
            <div className="w-full md:w-1/3 px-2 mb-4">
              <div className="p-4 h-full border rounded-lg bg-blue-50">
                <h2 className="text-xl font-semibold mb-2">日报管理</h2>
                <p>简单高效地创建和管理每日工作记录，自动保存历史数据。</p>
              </div>
            </div>
            <div className="w-full md:w-1/3 px-2 mb-4">
              <div className="p-4 h-full border rounded-lg bg-green-50">
                <h2 className="text-xl font-semibold mb-2">周报自动生成</h2>
                <p>基于一周的日报内容，自动汇总生成格式规范的周报。</p>
              </div>
            </div>
            <div className="w-full md:w-1/3 px-2 mb-4">
              <div className="p-4 h-full border rounded-lg bg-purple-50">
                <h2 className="text-xl font-semibold mb-2">多平台支持</h2>
                <p>同时支持Windows、macOS和Linux系统，数据无缝同步。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-2xl font-bold mb-4">开始使用</h2>
          <p className="mb-6">
            请下载适合您操作系统的安装包：
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <a href="https://github.com/langkeyo/tauri-daily-helper/releases"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              下载Windows版本
            </a>
            <a href="https://github.com/langkeyo/tauri-daily-helper/releases"
              className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition">
              下载macOS版本
            </a>
            <a href="https://github.com/langkeyo/tauri-daily-helper/releases"
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition">
              下载Linux版本
            </a>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t text-center text-gray-500">
          <p>Copyright © 2024 · <a href="https://github.com/langkeyo/tauri-daily-helper" className="underline">GitHub</a></p>
        </footer>
      </div>
    </main>
  )
}
