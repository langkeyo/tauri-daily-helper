"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DailiesPage() {
    const [dailies, setDailies] = useState<any[]>([])
    const [form, setForm] = useState({
        date: '',
        task_id: '',
        task_name: '',
        should_complete: '',
        completed: '',
        uncompleted: '',
        plan_hours: '',
        actual_hours: '',
        remarks: ''
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchDailies()
    }, [])

    async function fetchDailies() {
        setLoading(true)
        const { data, error } = await supabase
            .from('dailies')
            .select('*')
            .order('date', { ascending: false })
            .limit(10)
        if (!error) setDailies(data || [])
        setLoading(false)
    }

    async function handleSubmit(e: any) {
        e.preventDefault()
        setLoading(true)
        const { date, task_id, task_name, should_complete, completed, uncompleted, plan_hours, actual_hours, remarks } = form
        const insertData = { date, task_id, task_name, should_complete, completed, uncompleted, plan_hours, actual_hours, remarks }
        const { error } = await supabase
            .from('dailies')
            .insert([insertData])
        if (!error) {
            setForm({ date: '', task_id: '', task_name: '', should_complete: '', completed: '', uncompleted: '', plan_hours: '', actual_hours: '', remarks: '' })
            fetchDailies()
        }
        setLoading(false)
    }

    return (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
            <h2>日报列表</h2>
            {loading && <p>加载中...</p>}
            <ul>
                {dailies.map(d => (
                    <li key={d.id} style={{ marginBottom: 12, borderBottom: '1px solid #eee' }}>
                        <b>{d.date}</b> | 应完成: {d.should_complete} | 已完成: {d.completed} | 未完成: {d.uncompleted}<br />
                        备注: {d.remarks}
                    </li>
                ))}
            </ul>
            <h3>新增日报</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input required placeholder="日期(如2024-05-13)" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                <input placeholder="任务ID" value={form.task_id} onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))} />
                <input placeholder="任务名称" value={form.task_name} onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} />
                <input placeholder="应完成" value={form.should_complete} onChange={e => setForm(f => ({ ...f, should_complete: e.target.value }))} />
                <input placeholder="已完成" value={form.completed} onChange={e => setForm(f => ({ ...f, completed: e.target.value }))} />
                <input placeholder="未完成" value={form.uncompleted} onChange={e => setForm(f => ({ ...f, uncompleted: e.target.value }))} />
                <input placeholder="计划工时" value={form.plan_hours} onChange={e => setForm(f => ({ ...f, plan_hours: e.target.value }))} />
                <input placeholder="实际工时" value={form.actual_hours} onChange={e => setForm(f => ({ ...f, actual_hours: e.target.value }))} />
                <input placeholder="备注" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                <button type="submit" disabled={loading}>提交</button>
            </form>
        </div>
    )
} 