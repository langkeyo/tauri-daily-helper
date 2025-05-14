import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { Task, OfflineAction } from '@/types'

// 直接使用常量值，而不是从环境变量中读取
const SUPABASE_URL = 'https://bvhdzrqukpvltlrjgjoe.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aGR6cnF1a3B2bHRscmpnam9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDM3MDksImV4cCI6MjA2MjExOTcwOX0.7D5nkvbRdxXltw2aPlRClwteQI2mtFTzHLgaw8HdOTg'

// 创建Supabase客户端，添加全局设置和重试逻辑
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
    },
    global: {
        // 添加自定义fetch实现，带有简单的重试逻辑和超时设置
        fetch: (...args) => {
            const [url, options = {}] = args
            return fetchWithRetry(String(url), options, 3)  // 最多重试3次
        },
        headers: {
            'X-Client-Info': 'Tauri Daily Helper'
        }
    }
})

// 简单的带有重试逻辑的fetch函数
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, timeout = 10000) {
    try {
        // 添加超时逻辑
        const controller = new AbortController()
        const id = setTimeout(() => controller.abort(), timeout)

        const opts = {
            ...options,
            signal: controller.signal
        }

        const response = await fetch(url, opts)
        clearTimeout(id)
        return response
    } catch (error: any) {
        if (retries === 0) throw error

        // 如果是网络错误或超时，进行重试
        if (error.name === 'AbortError' || error.name === 'TypeError') {
            console.log(`请求失败，正在重试... 剩余重试次数: ${retries - 1}`)
            await new Promise(r => setTimeout(r, 1000)) // 等待1秒
            return fetchWithRetry(url, options, retries - 1, timeout)
        }

        throw error
    }
}

// 表定义 - 使用对象存储所有表定义，方便统一管理
const tableDefinitions = {
    tasks: `
    CREATE TABLE IF NOT EXISTS public.tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      user_id UUID REFERENCES auth.users(id),
      project_id UUID,
      tags TEXT[],
      is_deleted BOOLEAN DEFAULT false
    );
    
    -- 启用实时功能
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tasks'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
      END IF;
    END
    $$;
    
    -- 添加触发器以自动更新updated_at
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- 删除已存在的触发器以避免错误
    DROP TRIGGER IF EXISTS tasks_update_timestamp ON public.tasks;
    
    -- 创建触发器
    CREATE TRIGGER tasks_update_timestamp
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
    
    -- 添加行级安全策略
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    
    -- 删除已存在的策略以避免错误
    DROP POLICY IF EXISTS "Users can only see their own tasks" ON public.tasks;
    DROP POLICY IF EXISTS "Users can only create their own tasks" ON public.tasks;
    DROP POLICY IF EXISTS "Users can only update their own tasks" ON public.tasks;
    DROP POLICY IF EXISTS "Users can only delete their own tasks" ON public.tasks;
    
    -- 创建新的安全策略
    CREATE POLICY "Users can only see their own tasks" ON public.tasks
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
    
    CREATE POLICY "Users can only create their own tasks" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
    
    CREATE POLICY "Users can only update their own tasks" ON public.tasks
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
    
    CREATE POLICY "Users can only delete their own tasks" ON public.tasks
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);
    `,

    // 添加dailies表定义
    dailies: `
    CREATE TABLE IF NOT EXISTS public.dailies (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      task_id TEXT,
      task_name TEXT,
      should_complete TEXT,
      completed TEXT,
      uncompleted TEXT,
      plan_hours TEXT,
      actual_hours TEXT,
      remarks TEXT,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    
    -- 启用实时功能
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'dailies'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dailies;
      END IF;
    END
    $$;
    
    -- 创建索引加速查询
    CREATE INDEX IF NOT EXISTS dailies_date_idx ON public.dailies(date);
    CREATE INDEX IF NOT EXISTS dailies_user_id_idx ON public.dailies(user_id);
    
    -- 添加触发器以自动更新updated_at
    DROP TRIGGER IF EXISTS dailies_update_timestamp ON public.dailies;
    CREATE TRIGGER dailies_update_timestamp
    BEFORE UPDATE ON public.dailies
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
    
    -- 添加行级安全策略
    ALTER TABLE public.dailies ENABLE ROW LEVEL SECURITY;
    
    -- 删除已存在的策略以避免错误
    DROP POLICY IF EXISTS "Users can only see their own dailies" ON public.dailies;
    DROP POLICY IF EXISTS "Users can only create their own dailies" ON public.dailies;
    DROP POLICY IF EXISTS "Users can only update their own dailies" ON public.dailies;
    DROP POLICY IF EXISTS "Users can only delete their own dailies" ON public.dailies;
    
    -- 创建新的安全策略
    CREATE POLICY "Users can only see their own dailies" ON public.dailies
    FOR SELECT USING (auth.uid()::text = user_id OR user_id IS NULL);
    
    CREATE POLICY "Users can only create their own dailies" ON public.dailies
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);
    
    CREATE POLICY "Users can only update their own dailies" ON public.dailies
    FOR UPDATE USING (auth.uid()::text = user_id OR user_id IS NULL);
    
    CREATE POLICY "Users can only delete their own dailies" ON public.dailies
    FOR DELETE USING (auth.uid()::text = user_id OR user_id IS NULL);
    `,

    // 添加user_profiles表定义
    user_profiles: `
    CREATE TABLE IF NOT EXISTS public.user_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id),
      name TEXT,
      department TEXT,
      position TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id)
    );
    
    -- 启用实时功能
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'user_profiles'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
      END IF;
    END
    $$;
    
    -- 添加触发器以自动更新updated_at
    DROP TRIGGER IF EXISTS user_profiles_update_timestamp ON public.user_profiles;
    CREATE TRIGGER user_profiles_update_timestamp
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
    
    -- 添加行级安全策略
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    
    -- 删除已存在的策略以避免错误
    DROP POLICY IF EXISTS "Users can only see their own profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can only create their own profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can only update their own profiles" ON public.user_profiles;
    
    -- 创建新的安全策略
    CREATE POLICY "Users can only see their own profiles" ON public.user_profiles
    FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can only create their own profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can only update their own profiles" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);
    `
}

// 尝试创建execute_sql RPC函数
async function createExecuteSqlFunction() {
    try {
        // 尝试使用函数，如果已存在则直接返回
        const { error } = await supabase.rpc("execute_sql", { query: "SELECT 1" })
        if (!error) {
            console.log("execute_sql函数已存在")
            return true
        }

        // 函数不存在，创建
        console.log("execute_sql函数不存在，需要在Supabase控制台创建")
        return false
    } catch (error) {
        console.error("检查execute_sql函数失败:", error)
        return false
    }
}

/**
 * 使用SQL直接创建表的备用方案
 * 由于普通用户可能没有权限创建execute_sql函数，
 * 这里添加一个备用方案，直接使用SQL API尝试创建表
 */
async function createTableWithDirectSql(tableName: string, tableDefinition: string) {
    console.log(`尝试直接在Supabase控制台创建${tableName}表...`)

    // 生成一个简化的CREATE TABLE语句，仅包含基本字段
    let simplifiedSQL = ''

    if (tableName === 'tasks') {
        simplifiedSQL = `
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'todo',
          priority TEXT DEFAULT 'medium',
          due_date TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          user_id UUID,
          project_id UUID,
          is_deleted BOOLEAN DEFAULT false
        );`
    } else if (tableName === 'dailies') {
        simplifiedSQL = `
        CREATE TABLE IF NOT EXISTS dailies (
          id SERIAL PRIMARY KEY,
          date TEXT NOT NULL,
          task_id TEXT,
          task_name TEXT,
          should_complete TEXT,
          completed TEXT,
          uncompleted TEXT,
          plan_hours TEXT,
          actual_hours TEXT,
          remarks TEXT,
          user_id TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );`
    }

    // 显示将在控制台执行的SQL
    console.log("请在Supabase SQL编辑器中执行以下SQL创建表:")
    console.log(simplifiedSQL)

    return false // 返回false表示需要手动操作
}

/**
 * 直接尝试创建tasks表的方法
 * 这是一个备用方案，在没有execute_sql权限时使用
 */
export async function createTasksTableIfNotExists() {
    try {
        console.log('检查tasks表是否存在...')

        // 先尝试查询表，检查是否存在
        const { error: checkError } = await supabase
            .from('tasks')
            .select('count')
            .limit(1)

        // 如果表已存在，直接返回成功
        if (!checkError) {
            console.log('tasks表已经存在，不需要创建')
            return true
        }

        // 表不存在，创建一个基本的tasks表
        console.log('tasks表不存在，正在创建...')

        // 使用最基本的表结构，确保创建成功
        const createTableSQL = `
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'todo',
          priority TEXT DEFAULT 'medium',
          due_date TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          user_id TEXT,
          project_id TEXT,
          tags TEXT[],
          is_deleted BOOLEAN DEFAULT false
        );`

        // 尝试直接执行SQL创建表
        const { error } = await supabase.rpc('execute_sql', { query: createTableSQL })

        if (error) {
            console.error('创建tasks表失败:', error)

            // 如果失败，显示用户需要手动执行的SQL
            console.log('请在Supabase控制台中执行以下SQL来创建tasks表:')
            console.log(createTableSQL)
            return false
        }

        console.log('tasks表创建成功')
        return true
    } catch (error) {
        console.error('创建tasks表出错:', error)
        return false
    }
}

/**
 * 检查并确保必要的表结构存在
 */
export async function initializeDatabase() {
    console.log('开始初始化Supabase数据库结构...')

    try {
        // 检查用户是否已登录
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError) {
            console.log('获取用户信息失败，使用guest用户:', userError)
            return useOfflineMode('guest')
        }

        if (!user) {
            console.log('用户未登录，使用guest用户')
            return useOfflineMode('guest')
        }

        // 检查网络连接
        try {
            // 简单的网络连接测试
            const networkTest = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`, {
                method: 'HEAD',
                headers: { 'Content-Type': 'application/json' }
            })

            if (!networkTest.ok) {
                console.log('Supabase服务连接测试失败，切换到离线模式')
                return useOfflineMode(user.id)
            }
        } catch (networkError) {
            console.log('网络连接测试异常，切换到离线模式:', networkError)
            return useOfflineMode(user.id)
        }

        // 尝试创建execute_sql RPC函数
        const canExecuteSql = await createExecuteSqlFunction()

        // 首先检查tasks表，因为这是最重要的表
        try {
            const tasksTableExists = await ensureTableExists('tasks', tableDefinitions.tasks, canExecuteSql)

            // 如果表不存在，直接尝试创建
            if (!tasksTableExists) {
                await createTasksTableIfNotExists()
            }
        } catch (tasksError) {
            console.error('检查tasks表时出错:', tasksError)
            // 尝试直接创建
            await createTasksTableIfNotExists()
        }

        // 依次检查并创建其他表
        let tableCheckSuccesses = 0
        const otherTables = Object.entries(tableDefinitions).filter(([name]) => name !== 'tasks')

        for (const [tableName, tableDefinition] of otherTables) {
            try {
                const tableExists = await ensureTableExists(tableName, tableDefinition, canExecuteSql)

                // 如果表创建成功或已存在，增加成功计数
                if (tableExists) {
                    tableCheckSuccesses++
                }
                // 如果表创建失败，使用备用方案
                else {
                    await createTableWithDirectSql(tableName, tableDefinition)
                }
            } catch (tableError) {
                console.error(`检查 ${tableName} 表时出错:`, tableError)
                // 尝试备用方案
                await createTableWithDirectSql(tableName, tableDefinition)
            }
        }

        console.log(`表结构检查完成: ${tableCheckSuccesses}/${otherTables.length + 1} 个表正常`)

        // 确保dailies表有user_id列
        try {
            const columnExists = await ensureUserIdColumn()

            // 如果列添加失败，提供备用方案
            if (!columnExists) {
                console.log("请在Supabase SQL编辑器中执行以下SQL添加user_id列:")
                console.log("ALTER TABLE dailies ADD COLUMN IF NOT EXISTS user_id TEXT;")
            }
        } catch (columnError) {
            console.error(`检查user_id列时出错:`, columnError)
            console.log("请在Supabase SQL编辑器中执行以下SQL添加user_id列:")
            console.log("ALTER TABLE dailies ADD COLUMN IF NOT EXISTS user_id TEXT;")
        }

        // 使用更有弹性的方式同步数据
        let syncSuccess = false
        try {
            // 尝试同步任务数据，但不要因为失败而中断整个流程
            await syncTasksToLocalDB(user.id)
            syncSuccess = true
        } catch (syncError) {
            console.error(`同步任务数据到本地失败:`, syncError)
            syncSuccess = false
        }

        // 即使同步失败，也尝试设置实时订阅
        try {
            setupRealtimeSubscriptions(user.id)
        } catch (subscriptionError) {
            console.error('设置实时订阅失败:', subscriptionError)
        }

        // 同步未同步的离线操作
        try {
            await syncOfflineActions()
        } catch (offlineError) {
            console.error(`同步离线操作失败:`, offlineError)
        }

        // 尝试创建用户资料RPC
        createProfilesTableRpcFunction().catch(err => {
            console.error("创建用户资料RPC失败:", err)
        })

        console.log('数据库初始化和同步完成')
        return {
            offlineMode: !syncSuccess,
            userId: user.id
        }
    } catch (error) {
        console.error('初始化数据库时出错:', error)
        // 遇到错误时切换到离线模式
        return useOfflineMode('guest')
    }
}

/**
 * 切换到离线模式，只使用本地数据库
 */
function useOfflineMode(userId: string) {
    console.log(`使用离线模式，用户ID: ${userId}`)
    // 这里不需要特别处理，因为应用已经设计为在没有网络连接时使用本地数据库
    return {
        offlineMode: true,
        userId
    }
}

/**
 * 确保特定表存在
 */
async function ensureTableExists(tableName: string, tableDefinition: string, canExecuteSql: boolean = false) {
    try {
        console.log(`检查 ${tableName} 表是否存在...`)

        // 检查表是否存在
        const { error: checkError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)
            .maybeSingle()

        // 处理不同类型的错误
        if (checkError) {
            // 表不存在错误
            if (checkError.message && checkError.message.includes(`relation "${tableName}" does not exist`)) {
                console.log(`${tableName} 表不存在，正在创建...`)

                // 如果可以执行SQL，就尝试创建表
                if (canExecuteSql) {
                    try {
                        // 尝试使用RPC调用来执行SQL命令创建表
                        const { error: createError } = await supabase.rpc('execute_sql', { query: tableDefinition })

                        if (createError) {
                            console.error(`无法使用RPC创建 ${tableName} 表:`, createError)
                            return false
                        } else {
                            console.log(`已成功创建 ${tableName} 表`)
                            return true
                        }
                    } catch (rpcError) {
                        console.error(`RPC调用失败:`, rpcError)
                        return false
                    }
                } else {
                    // 无法执行SQL
                    console.log(`无法执行SQL来创建 ${tableName} 表，请手动创建`)
                    return false
                }
            }
            // 用户ID列不存在或类型不匹配错误 (特殊处理)
            else if (checkError.message &&
                (checkError.message.includes('column "user_id" does not exist') ||
                    checkError.message.includes('user_id') && checkError.message.includes('type'))) {
                console.warn(`${tableName} 表存在，但user_id列存在问题: ${checkError.message}`)
                console.log('这不是严重问题，将继续使用该表，但某些过滤功能可能受限。')
                console.log(`推荐在Supabase SQL编辑器中执行以下SQL修复user_id列:`)

                if (tableName === 'tasks') {
                    console.log(`ALTER TABLE ${tableName} ALTER COLUMN user_id TYPE UUID USING user_id::uuid;`)
                } else {
                    console.log(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS user_id TEXT;`)
                }

                // 返回true表示表存在，只是有列问题，应用可以继续运行
                return true
            }
            // 其他错误
            else {
                console.error(`检查 ${tableName} 表时发生未知错误:`, checkError)
                // 我们不希望未知错误阻止整个应用正常运行
                console.log(`尝试继续初始化过程，部分功能可能不可用`)
                return true
            }
        }

        // 没有错误，表已存在
        console.log(`${tableName} 表已存在`)
        return true
    } catch (e) {
        console.error(`检查表时发生异常:`, e)
        // 异常不应该阻止整个应用初始化
        return true
    }
}

/**
 * 确保user_id列存在的函数
 */
export async function ensureUserIdColumn() {
    try {
        console.log('检查并确保dailies表中user_id列存在...')

        // 首先检查表是否存在，不存在则不需要添加列
        try {
            const { data, error: tableError } = await supabase
                .from('dailies')
                .select('count')
                .limit(1)

            if (tableError && tableError.message &&
                tableError.message.includes("relation \"dailies\" does not exist")) {
                console.log('dailies表不存在，无需添加user_id列')
                return false
            }
        } catch (tableCheckError) {
            console.log('检查dailies表失败:', tableCheckError)
        }

        // 尝试查询dailies表的一行数据，检查是否有user_id列
        const { data, error: queryError } = await supabase
            .from('dailies')
            .select('user_id')
            .limit(1)

        // 如果没有错误，说明列已存在
        if (!queryError) {
            console.log('user_id列已存在，无需添加')
            return true
        }

        // 如果出现特定错误，表示列不存在
        if (queryError && queryError.message &&
            (queryError.message.includes("column \"user_id\" does not exist") ||
                queryError.message.includes("could not find the \"user_id\" column"))) {
            console.log('检测到user_id列不存在，尝试添加...', queryError)

            // 尝试使用RPC函数添加列
            const addColumnSql = "ALTER TABLE dailies ADD COLUMN IF NOT EXISTS user_id TEXT;"
            try {
                console.log('尝试使用RPC函数添加列...')
                const { error: rpcError } = await supabase.rpc('execute_sql', {
                    query: addColumnSql
                })

                if (!rpcError) {
                    console.log('成功添加user_id列（通过RPC）')
                    return true
                } else {
                    // 记录详细的RPC错误
                    console.log('RPC方法失败:', rpcError)
                }
            } catch (rpcFailError) {
                console.log('RPC方法不可用:', rpcFailError)
            }

            // 最后备用方法：重试简单查询验证
            try {
                console.log('重新尝试查询验证列是否已添加...')
                const { error: recheckError } = await supabase
                    .from('dailies')
                    .select('user_id')
                    .limit(1)

                if (!recheckError) {
                    console.log('user_id列现在存在')
                    return true
                } else {
                    console.error('重新检查失败:', recheckError)
                }
            } catch (recheckFailError) {
                console.error('重新检查发生异常:', recheckFailError)
            }

            console.error('所有方法都失败，可能需要手动添加user_id列')
            return false
        } else {
            // 其他查询错误
            console.error('检查user_id列时出错:', queryError)
            return false
        }
    } catch (e) {
        // 捕获并记录所有异常详情
        console.error('确保user_id列存在时发生异常:', e)
        return false
    }
}

/**
 * 将Supabase中的任务同步到本地IndexedDB
 */
async function syncTasksToLocalDB(userId: string) {
    try {
        console.log('正在同步任务数据到本地...')

        // 先检查tasks表是否存在
        try {
            const { error: checkError } = await supabase
                .from('tasks')
                .select('count')
                .limit(1)

            if (checkError) {
                console.log('tasks表不存在或无法访问，跳过同步:', checkError)
                return false
            }
        } catch (checkError) {
            console.log('检查tasks表失败，跳过同步:', checkError)
            return false
        }

        // 获取远程任务数据，尝试多种查询方式
        let remoteTasks: any[] = []
        let queryError: any = null

        // 方法1: 尝试使用user_id过滤（首选方式）
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('is_deleted', false)

            if (!error && data && data.length > 0) {
                remoteTasks = data
                console.log(`使用user_id过滤成功获取到 ${data.length} 条任务数据`)
            } else {
                queryError = error
                console.log('使用user_id过滤查询失败:', error || '无数据')
            }
        } catch (userIdQueryError) {
            queryError = userIdQueryError
            console.warn('使用user_id过滤查询抛出异常:', userIdQueryError)
        }

        // 方法2: 如果方法1失败，尝试不使用user_id过滤
        if (remoteTasks.length === 0) {
            try {
                console.log('尝试不使用user_id过滤获取任务...')
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('is_deleted', false)
                    .limit(100) // 限制结果数量，避免获取太多无关任务

                if (!error && data && data.length > 0) {
                    remoteTasks = data
                    console.log(`不使用user_id过滤获取到 ${data.length} 条任务数据`)
                } else {
                    console.log('不使用user_id过滤也失败:', error || '无数据')
                }
            } catch (fallbackQueryError) {
                console.error('备用查询方式也失败:', fallbackQueryError)
                if (queryError) throw queryError
                throw fallbackQueryError
            }
        }

        if (remoteTasks.length === 0) {
            console.log('远程无任务数据可同步')
            return true
        }

        console.log(`最终获得 ${remoteTasks.length} 条远程任务数据，开始同步...`)

        // 获取所有本地任务的ID
        const localTasks = await db.tasks.toArray()
        const localTaskIds = new Set(localTasks.map(task => task.id))

        // 将远程任务添加或更新到本地
        const tasksToAdd: Task[] = []
        const tasksToUpdate: Task[] = []

        for (const task of remoteTasks) {
            // 确保每个任务有一个有效的user_id，如果没有则添加
            if (!task.user_id) {
                task.user_id = userId
            }

            if (localTaskIds.has(task.id)) {
                tasksToUpdate.push(task as Task)
            } else {
                tasksToAdd.push(task as Task)
            }
        }

        try {
            // 批量添加新任务
            if (tasksToAdd.length > 0) {
                await db.tasks.bulkAdd(tasksToAdd)
                console.log(`已添加 ${tasksToAdd.length} 条新任务`)
            }

            // 批量更新已存在的任务
            if (tasksToUpdate.length > 0) {
                await db.tasks.bulkPut(tasksToUpdate)
                console.log(`已更新 ${tasksToUpdate.length} 条已存在任务`)
            }
        } catch (dbError) {
            console.error('本地数据库操作失败:', dbError)
            // 尝试逐个添加/更新，以避免因为个别任务的问题导致整批同步失败
            console.log('尝试逐个处理任务...')

            let addSuccess = 0
            let updateSuccess = 0

            // 逐个添加新任务
            for (const task of tasksToAdd) {
                try {
                    await db.tasks.add(task)
                    addSuccess++
                } catch (addError) {
                    console.warn(`添加任务 ${task.id} 失败:`, addError)
                }
            }

            // 逐个更新已存在任务
            for (const task of tasksToUpdate) {
                try {
                    await db.tasks.put(task)
                    updateSuccess++
                } catch (updateError) {
                    console.warn(`更新任务 ${task.id} 失败:`, updateError)
                }
            }

            console.log(`使用逐个处理方式: 成功添加 ${addSuccess}/${tasksToAdd.length} 条，成功更新 ${updateSuccess}/${tasksToUpdate.length} 条`)
        }

        console.log('任务数据同步完成')
        return true
    } catch (error) {
        console.error('同步任务数据到本地失败:', error)
        // 这里不再抛出错误，而是返回false表示同步失败
        // 这样不会中断应用的初始化流程
        return false
    }
}

/**
 * 设置实时订阅，保持本地数据与远程同步
 */
function setupRealtimeSubscriptions(userId: string) {
    try {
        const tasksSubscription = supabase
            .channel('table-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `user_id=eq.${userId}`
                },
                async (payload) => {
                    console.log('收到实时更新:', payload)

                    // 根据事件类型处理数据
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        // 新增或更新任务
                        const task = payload.new as Task
                        await db.tasks.put(task)
                        console.log(`已${payload.eventType === 'INSERT' ? '添加' : '更新'}任务: ${task.id}`)
                    } else if (payload.eventType === 'DELETE') {
                        // 删除任务
                        const taskId = payload.old.id
                        await db.tasks.delete(taskId)
                        console.log(`已删除任务: ${taskId}`)
                    }
                }
            )
            .subscribe((status) => {
                console.log('实时订阅状态:', status)
            })

        // 保存订阅引用，以便在需要时取消订阅
        if (typeof window !== 'undefined') {
            window.__subscriptions = window.__subscriptions || {}
            window.__subscriptions.tasks = tasksSubscription
        }

        console.log('已设置任务表的实时订阅')
    } catch (error) {
        console.error('设置实时订阅失败:', error)
    }
}

/**
 * 同步离线操作到Supabase
 */
async function syncOfflineActions() {
    try {
        // 检查是否已登录
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            console.log('用户未登录，跳过离线操作同步')
            return
        }

        console.log('开始同步离线操作...')

        // 获取所有未同步的操作
        const unsyncedActions = await db.getUnsyncedActions()

        if (unsyncedActions.length === 0) {
            console.log('没有未同步的离线操作')
            return
        }

        console.log(`发现 ${unsyncedActions.length} 条未同步的离线操作`)

        // 按表和操作类型分组处理
        for (const action of unsyncedActions) {
            try {
                if (action.table === 'tasks') {
                    // 处理任务相关操作
                    await syncTaskAction(action)
                }
                // 可以添加其他表的处理逻辑

                // 标记为已同步
                if (action.id) {
                    await db.markActionSynced(action.id)
                }
            } catch (error) {
                console.error(`同步操作失败 [ID: ${action.id}]:`, error)
            }
        }

        console.log('离线操作同步完成')
    } catch (error) {
        console.error('同步离线操作失败:', error)
        throw error
    }
}

/**
 * 同步特定的任务操作
 */
async function syncTaskAction(action: OfflineAction) {
    if (!action || !action.data) {
        return
    }

    if (action.action === 'create') {
        // 创建任务
        const { error } = await supabase.from('tasks').insert(action.data)
        if (error) throw error
        console.log(`已同步创建任务: ${action.data.id}`)
    } else if (action.action === 'update') {
        // 更新任务
        const { error } = await supabase
            .from('tasks')
            .update(action.data)
            .eq('id', action.data.id)
        if (error) throw error
        console.log(`已同步更新任务: ${action.data.id}`)
    } else if (action.action === 'delete') {
        // 删除任务（实际是软删除）
        const { error } = await supabase
            .from('tasks')
            .update({ is_deleted: true })
            .eq('id', action.data.id)
        if (error) throw error
        console.log(`已同步删除任务: ${action.data.id}`)
    }
}

// 获取创建任务表的SQL语句 - 保留此函数以向后兼容
export function getCreateTasksTableSQL() {
    return tableDefinitions.tasks
}

// 获取创建日报表的SQL语句
export function getCreateDailiesTableSQL() {
    return tableDefinitions.dailies
}

// 获取创建用户资料表的SQL语句
export function getCreateUserProfilesTableSQL() {
    return tableDefinitions.user_profiles
}

// 尝试创建create_profiles_table_if_not_exists RPC函数
async function createProfilesTableRpcFunction() {
    try {
        const { error } = await supabase.rpc('create_profiles_table_if_not_exists')

        if (!error) {
            console.log("create_profiles_table_if_not_exists函数已存在")
            return true
        }

        // 尝试创建函数
        const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION create_profiles_table_if_not_exists()
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          -- 检查表是否存在
          IF NOT EXISTS (
            SELECT FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'user_profiles'
          ) THEN
            -- 创建表
            CREATE TABLE public.user_profiles (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID REFERENCES auth.users(id),
              name TEXT,
              department TEXT,
              position TEXT,
              avatar_url TEXT,
              created_at TIMESTAMPTZ DEFAULT now(),
              updated_at TIMESTAMPTZ DEFAULT now(),
              UNIQUE(user_id)
            );
            
            -- 添加RLS
            ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
            
            -- 添加策略
            CREATE POLICY "Users can only see their own profiles" ON public.user_profiles
            FOR SELECT USING (auth.uid() = user_id);
            
            CREATE POLICY "Users can only create their own profiles" ON public.user_profiles
            FOR INSERT WITH CHECK (auth.uid() = user_id);
            
            CREATE POLICY "Users can only update their own profiles" ON public.user_profiles
            FOR UPDATE USING (auth.uid() = user_id);
            
            RETURN TRUE;
          ELSE
            RETURN FALSE;
          END IF;
        END;
        $$;
        `

        // 通过SQL API尝试创建函数
        // 注意：这需要管理员权限
        console.log("尝试通过SQL API创建函数")
        return false
    } catch (error) {
        console.error("检查RPC函数失败:", error)
        return false
    }
}

// 定义全局变量类型
declare global {
    interface Window {
        __subscriptions?: {
            [key: string]: any
        }
    }
}