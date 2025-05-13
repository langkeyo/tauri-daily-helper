"use client"
import { useEffect } from "react"
import { listen, UnlistenFn } from "@tauri-apps/api/event"
import { initializeServices } from "@/lib/init"

export default function IdleListener() {
    useEffect(() => {
        // 初始化所有服务
        initializeServices()

        // 监听用户空闲事件
        let unlisten: UnlistenFn
        listen("user_idle", () => {
            alert("你已空闲2分钟，请注意工作状态！")
        }).then(fn => { unlisten = fn })

        return () => { if (unlisten) unlisten() }
    }, [])

    return null
}
