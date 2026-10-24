import type { Local, Promo } from './tipos'

export type Nivel = 'mucho' | 'poco' | 'lleno' | 'sin-datos'

export function nivelDe(local: Local): Nivel {
  if (!local.enVivo || local.mesas.length === 0) return 'sin-datos'
  if (local.mesasLibres === 0) return 'lleno'
  return local.mesasLibres / local.mesas.length > 0.5 ? 'mucho' : 'poco'
}

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  mucho: 'Mucho lugar',
  poco: 'Poco lugar',
  lleno: 'Lleno',
  'sin-datos': 'Sin datos ahora',
}

export const CLASE_NIVEL: Record<Nivel, string> = {
  mucho: 'bg-emerald-100 text-emerald-800',
  poco: 'bg-amber-100 text-amber-800',
  lleno: 'bg-red-100 text-red-800',
  'sin-datos': 'bg-slate-100 text-slate-500',
}

// Mesas libres donde entra el grupo
export function mesasQueAlcanzan(local: Local, personas: number): number {
  if (!local.enVivo) return 0
  return local.mesas.filter((m) => !m.ocupada && m.capacidad >= personas).length
}

export function tieneMesaPara(local: Local, personas: number): boolean {
  return mesasQueAlcanzan(local, personas) > 0
}

// Color del marcador en el mapa: ¿puedo ir ahora con mi grupo?
export function colorMarcador(local: Local, personas: number): string {
  const nivel = nivelDe(local)
  if (nivel === 'sin-datos') return '#94a3b8'
  if (!tieneMesaPara(local, personas)) return '#ef4444'
  return nivel === 'mucho' ? '#10b981' : '#f59e0b'
}

// La promo del local si todavía no venció (el server avisa al vencer, esto evita esperar ese aviso)
export function promoVigente(local: Local, ahora: number): Promo | null {
  return local.promo && new Date(local.promo.venceEn).getTime() > ahora ? local.promo : null
}

// "12:34" (minutos:segundos que le quedan a la promo)
export function tiempoRestante(venceEn: string, ahora: number): string {
  const segundos = Math.max(0, Math.floor((new Date(venceEn).getTime() - ahora) / 1000))
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
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
