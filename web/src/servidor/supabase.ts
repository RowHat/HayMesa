import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente con la service_role key: solo se usa en el servidor (rutas de /api)
let cliente: SupabaseClient | null = null

export function sb(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !clave) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    cliente = createClient(url, clave, { auth: { persistSession: false } })
  }
  return cliente
}

// Devuelve los datos o tira el error de Supabase
export function revisar<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data
}
