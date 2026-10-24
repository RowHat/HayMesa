import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { Local } from './tipos'

// Un solo canal de Supabase Realtime ("locales") compartido por toda la página
type Oyente = (local: Local) => void
type OyenteConexion = (conectado: boolean) => void

const oyentes = new Set<Oyente>()
const oyentesConexion = new Set<OyenteConexion>()
let canal: RealtimeChannel | null = null
let conectado = false

function iniciar() {
  if (canal) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !clave) return
  canal = createClient(url, clave)
    .channel('locales')
    .on('broadcast', { event: 'local_actualizado' }, ({ payload }) => {
      for (const oyente of oyentes) oyente(payload as Local)
    })
    .subscribe((estado) => {
      conectado = estado === 'SUBSCRIBED'
      for (const oyente of oyentesConexion) oyente(conectado)
    })
}

export function alActualizarLocal(oyente: Oyente) {
  iniciar()
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function alCambiarConexion(oyente: OyenteConexion) {
  iniciar()
  oyentesConexion.add(oyente)
  oyente(conectado)
  return () => {
    oyentesConexion.delete(oyente)
  }
}
