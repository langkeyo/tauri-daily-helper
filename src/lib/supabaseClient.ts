import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bvhdzrqukpvltlrjgjoe.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aGR6cnF1a3B2bHRscmpnam9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDM3MDksImV4cCI6MjA2MjExOTcwOX0.7D5nkvbRdxXltw2aPlRClwteQI2mtFTzHLgaw8HdOTg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 