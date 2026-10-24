import { obtenerLocal } from './locales'
import { sb } from './supabase'

// Manda a todos los navegadores el estado actual de un local (Supabase Realtime, canal "locales")
export async function avisarLocalActualizado(restauranteId: number) {
  const local = await obtenerLocal(restauranteId)
  if (!local) return
  await sb().channel('locales').httpSend('local_actualizado', local).catch((err: Error) => console.warn('Realtime:', err.message))
}
