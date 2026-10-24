import { createClient } from '@supabase/supabase-js'
import { obtenerLocal } from './locales'

// Manda a todos los navegadores el estado actual de un local (Supabase Realtime, canal público "locales")
const canal = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).channel('locales')

export async function avisarLocalActualizado(restauranteId: number) {
  const local = await obtenerLocal(restauranteId)
  if (!local) return
  await canal()
    .httpSend('local_actualizado', local)
    .catch((err: Error) => console.warn('Realtime:', err.message))
}
