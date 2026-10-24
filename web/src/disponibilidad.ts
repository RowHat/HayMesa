import type { Local } from './tipos'

export type Nivel = 'tranquilo' | 'medio' | 'lleno' | 'sin-datos'

export function nivelDe(local: Local): Nivel {
  if (!local.enVivo || local.mesas.length === 0) return 'sin-datos'
  if (local.mesasLibres === 0) return 'lleno'
  return local.mesasLibres / local.mesas.length > 0.5 ? 'tranquilo' : 'medio'
}

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  tranquilo: 'Tranquilo',
  medio: 'Medio',
  lleno: 'Lleno',
  'sin-datos': 'Sin datos ahora',
}

export const CLASE_NIVEL: Record<Nivel, string> = {
  tranquilo: 'bg-emerald-100 text-emerald-800',
  medio: 'bg-amber-100 text-amber-800',
  lleno: 'bg-red-100 text-red-800',
  'sin-datos': 'bg-slate-100 text-slate-500',
}

// ¿Hay una mesa libre donde entre el grupo?
export function tieneMesaPara(local: Local, personas: number): boolean {
  return local.enVivo && local.mesas.some((m) => !m.ocupada && m.capacidad >= personas)
}

// Color del marcador en el mapa: ¿puedo ir ahora con mi grupo?
export function colorMarcador(local: Local, personas: number): string {
  const nivel = nivelDe(local)
  if (nivel === 'sin-datos') return '#94a3b8'
  if (!tieneMesaPara(local, personas)) return '#ef4444'
  return nivel === 'tranquilo' ? '#10b981' : '#f59e0b'
}

export type Ubicacion = { lat: number; lng: number }

// Distancia en línea recta (fórmula de haversine)
export function distanciaMetros(a: Ubicacion, b: Ubicacion): number {
  const radianes = (g: number) => (g * Math.PI) / 180
  const dLat = radianes(b.lat - a.lat)
  const dLng = radianes(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radianes(a.lat)) * Math.cos(radianes(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export function formatearMetros(metros: number): string {
  return `${Math.round(metros).toLocaleString('es-AR')} m`
}
