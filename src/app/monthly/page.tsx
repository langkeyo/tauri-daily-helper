"use client"
import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function MonthlyReportExport() {
    const [templatePath, setTemplatePath] = useState('')
    const [outputPath, setOutputPath] = useState('')
    const [yearMonth, setYearMonth] = useState('')
    const [position, setPosition] = useState('')
    const [department, setDepartment] = useState('')
    const [name, setName] = useState('')

    // 选择模板
    const handleSelectTemplate = async () => {
        try {
            // 使用invoke调用Rust命令，需要匹配后端函数签名
            const selected = await invoke('select_file', {
                title: '选择月报模板',
                filters: [{
                    name: 'Excel',
                    extensions: ['xlsx']
                }]
            })
            if (selected) setTemplatePath(selected as string)
        } catch (e) {
            console.error(e)
            alert(`选择文件失败: ${e}`)
        }
    }

    // 选择导出路径
    const handleSelectOutput = async () => {
        try {
            // 使用invoke调用Rust命令，需要匹配后端函数签名
            const selected = await invoke('select_save_path', {
                title: '选择导出位置',
                defaultPath: `月报_${yearMonth || '2024-04'}.xlsx`,
                filters: [{
                    name: 'Excel',
                    extensions: ['xlsx']
                }]
            })
            if (selected) setOutputPath(selected as string)
        } catch (e) {
            console.error(e)
            alert(`选择保存路径失败: ${e}`)
        }
    }

    // 导出月报
    const handleExport = async () => {
        if (!templatePath || !outputPath || !yearMonth || !position || !department || !name) {
            alert('请填写所有信息并选择文件')
            return
        }
        try {
            await invoke('generate_monthly_report', {
                templatePath,
                outputPath,
                yearMonth,
                userInfo: {
                    position,
                    department,
                    name,
                    date: yearMonth
                }
            })
            alert('月报已导出！')
        } catch (e) {
            alert(`导出失败: ${e}`)
        }
    }

    return (
        <div style={{ padding: 24 }}>
            <h2>月报导出</h2>
            <div style={{ marginBottom: 16 }}>
                <button onClick={handleSelectTemplate}>选择月报模板</button>
                <span style={{ marginLeft: 8 }}>{templatePath || '未选择'}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
                <button onClick={handleSelectOutput}>选择导出位置</button>
                <span style={{ marginLeft: 8 }}>{outputPath || '未选择'}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
                <input
                    placeholder="月份（如2024-04）"
                    value={yearMonth}
                    onChange={e => setYearMonth(e.target.value)}
                    style={{ padding: '4px 8px' }}
                />
            </div>
            <div style={{ marginBottom: 16 }}>
                <input
                    placeholder="岗位"
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    style={{ padding: '4px 8px' }}
                />
            </div>
            <div style={{ marginBottom: 16 }}>
                <input
                    placeholder="部门"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    style={{ padding: '4px 8px' }}
                />
            </div>
            <div style={{ marginBottom: 16 }}>
                <input
                    placeholder="姓名"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ padding: '4px 8px' }}
                />
            </div>
            <div>
                <button
                    onClick={handleExport}
                    style={{
                        padding: '8px 16px',
                        background: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                    }}
                >
                    导出月报
                </button>
            </div>
        </div>
    )
}
