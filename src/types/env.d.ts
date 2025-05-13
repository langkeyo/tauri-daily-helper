interface ImportMetaEnv {
    VITE_SUPABASE_URL: string
    VITE_SUPABASE_ANON_KEY: string
    [key: string]: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
} 