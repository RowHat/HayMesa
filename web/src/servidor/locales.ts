import { promosActivas, registrarMesasTomadas, terminarPromo, type PromoActiva } from './promos'
import { revisar, sb } from './supabase'

// Zona de la mesa sobre la imagen, en proporciones de 0 a 1
export type Zona = { x: number; y: number; ancho: number; alto: number }

export type Mesa = {
  id: number
  nombre: string
  capacidad: number
  zona: Zona
  ocupada: boolean
  personas: number
}

export type Local = {
  id: number
  nombre: string
  tipo: string
  direccion: string
  lat: number
  lng: number
  enVivo: boolean
  mesasLibres: number
  mesas: Mesa[]
  promo: Promo | null
}

// Lo que ve el público de una promo activa
export type Promo = { descripcion: string; venceEn: string; mesasConPromo: number }

// Si la cámara no mandó datos en este tiempo, consideramos el local desconectado
const SEGUNDOS_EN_VIVO = 60

type FilaRestaurante = {
  id: number
  nombre: string
  tipo: string
  direccion: string
  lat: number
  lng: number
  ultima_actualizacion: string | null
  mesas: Mesa[]
}

const COLUMNAS = 'id, nombre, tipo, direccion, lat, lng, ultima_actualizacion, mesas(id, nombre, capacidad, zona, ocupada, personas)'

function armarLocal(fila: FilaRestaurante, promo: PromoActiva | undefined): Local {
  const mesas = [...fila.mesas].sort((a, b) => a.id - b.id)

  const enVivo =
    fila.ultima_actualizacion !== null &&
    Date.now() - new Date(fila.ultima_actualizacion).getTime() < SEGUNDOS_EN_VIVO * 1000

  const mesasLibres = mesas.filter((m) => !m.ocupada).length

  // Solo mostramos la promo si la cámara confirma que hay mesas libres
  const mesasConPromo = enVivo && promo ? Math.min(promo.cupo - promo.mesasTomadas, mesasLibres) : 0

  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    direccion: fila.direccion,
    lat: fila.lat,
    lng: fila.lng,
    enVivo,
    mesasLibres,
    mesas,
    promo: promo && mesasConPromo > 0 ? { descripcion: promo.descripcion, venceEn: promo.venceEn, mesasConPromo } : null,
  }
}

export async function listarLocales(): Promise<Local[]> {
  const [filas, promos] = await Promise.all([
    sb().from('restaurantes').select(COLUMNAS).order('nombre').then(revisar),
    promosActivas(),
  ])
  return (filas as FilaRestaurante[]).map((f) => armarLocal(f, promos.get(f.id)))
}

export async function obtenerLocal(id: number): Promise<Local | null> {
  if (!Number.isInteger(id)) return null
  const [fila, promos] = await Promise.all([
    sb().from('restaurantes').select(COLUMNAS).eq('id', id).maybeSingle().then(revisar),
    promosActivas([id]),
  ])
  return fila ? armarLocal(fila as FilaRestaurante, promos.get(id)) : null
}

export type MesaNueva = { nombre: string; capacidad: number; zona: Zona }

// Reemplaza todas las mesas del local por las nuevas (el dueño las redibuja juntas)
export async function guardarMesas(restauranteId: number, mesas: MesaNueva[]) {
  revisar(await sb().from('mesas').delete().eq('restaurante_id', restauranteId))
  if (mesas.length === 0) return
  revisar(
    await sb()
      .from('mesas')
      .insert(mesas.map((m) => ({ restaurante_id: restauranteId, nombre: m.nombre, capacidad: m.capacidad, zona: m.zona }))),
  )
}

export type EstadoMesa = { mesaId: number; ocupada: boolean; personas: number }

// Guarda lo que detectó la cámara. Solo toca mesas que sean de ese local.
export async function guardarEstado(restauranteId: number, estados: EstadoMesa[]) {
  const anteriores = revisar(
    await sb().from('mesas').select('id, ocupada').eq('restaurante_id', restauranteId),
  ) as { id: number; ocupada: boolean }[]
  const ocupadaAntes = new Map(anteriores.map((m) => [m.id, m.ocupada]))

  const validos = estados.filter((e) => ocupadaAntes.has(e.mesaId))
  const mesasQueSeOcuparon = validos.filter((e) => ocupadaAntes.get(e.mesaId) === false && e.ocupada).length

  await Promise.all(
    validos.map((e) =>
      sb().from('mesas').update({ ocupada: e.ocupada, personas: e.personas }).eq('id', e.mesaId).eq('restaurante_id', restauranteId).then(revisar),
    ),
  )
  revisar(await sb().from('restaurantes').update({ ultima_actualizacion: new Date().toISOString() }).eq('id', restauranteId))

  // La promo descuenta cupo con cada mesa que se ocupa, y termina si el local se llena
  if (mesasQueSeOcuparon > 0) await registrarMesasTomadas(restauranteId, mesasQueSeOcuparon)
  const estadoFinal = new Map(ocupadaAntes)
  for (const e of validos) estadoFinal.set(e.mesaId, e.ocupada)
  const ocupadas = [...estadoFinal.values()].filter(Boolean).length
  if (estadoFinal.size > 0 && ocupadas === estadoFinal.size) await terminarPromo(restauranteId, 'lleno')

  // Una fila por minuto de ocupación (para la predicción)
  if (estadoFinal.size > 0) {
    const minuto = new Date().toISOString().slice(0, 16) // "2026-10-24T13:05"
    revisar(
      await sb()
        .from('historial')
        .upsert(
          { restaurante_id: restauranteId, minuto, ocupadas, total: estadoFinal.size },
          { onConflict: 'restaurante_id,minuto', ignoreDuplicates: true },
        ),
    )
  }
}

export type PuntoHistorial = { minuto: string; ocupadas: number; total: number }

// Todas las filas de historial desde una fecha (Supabase devuelve de a 1000)
export async function leerHistorial(restauranteId: number, desde?: string): Promise<PuntoHistorial[]> {
  const filas: PuntoHistorial[] = []
  for (let desdeFila = 0; ; desdeFila += 1000) {
    let consulta = sb().from('historial').select('minuto, ocupadas, total').eq('restaurante_id', restauranteId)
    if (desde) consulta = consulta.gte('minuto', desde)
    const pagina = revisar(await consulta.order('minuto').range(desdeFila, desdeFila + 999)) as PuntoHistorial[]
    filas.push(...pagina)
    if (pagina.length < 1000) return filas
  }
}

// Ocupación de las últimas horas de un local, de más viejo a más nuevo
export function obtenerHistorial(restauranteId: number, horas: number): Promise<PuntoHistorial[]> {
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString().slice(0, 16)
  return leerHistorial(restauranteId, desde)
}
