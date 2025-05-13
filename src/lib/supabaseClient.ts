// 从initSupabase导入所需内容，避免重复
import { supabase, ensureUserIdColumn } from './initSupabase'

// 重新导出以保持向后兼容
export { supabase, ensureUserIdColumn }

// 导出URL和KEY常量，保持向后兼容
export const SUPABASE_URL = 'https://bvhdzrqukpvltlrjgjoe.supabase.co'
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aGR6cnF1a3B2bHRscmpnam9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDM3MDksImV4cCI6MjA2MjExOTcwOX0.7D5nkvbRdxXltw2aPlRClwteQI2mtFTzHLgaw8HdOTg'