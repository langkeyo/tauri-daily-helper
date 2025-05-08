"use client"
import { useEffect } from "react"
import { listen, UnlistenFn } from "@tauri-apps/api/event"

export default function IdleListener() {
    useEffect(() => {
        let unlisten: UnlistenFn
        listen("user_idle", () => {
            alert("你已空闲2分钟，请注意工作状态！")
        }).then(fn => { unlisten = fn })
        return () => { if (unlisten) unlisten() }
    }, [])
    return null
}
