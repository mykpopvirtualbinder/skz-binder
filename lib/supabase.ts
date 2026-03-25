import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Esta es la línea que soluciona los 18 errores
export const supabase = createClient(supabaseUrl, supabaseAnonKey)