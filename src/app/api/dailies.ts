import { supabase } from '@/lib/supabaseClient'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        // 获取最近10条日报
        const { data, error } = await supabase
            .from('dailies')
            .select('*')
            .order('date', { ascending: false })
            .limit(10)
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json(data)
    }
    if (req.method === 'POST') {
        // 新增日报
        const daily = req.body
        const { error } = await supabase
            .from('dailies')
            .insert([daily])
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ success: true })
    }
    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
} 