import { promosActivas, registrarMesasTomadas, terminarPromo, type PromoActiva } from './promos'
import { aIso, sql } from './db'

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
  mesasTotales: number
  mesasLibres: number
  mesasOcupadas: number
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
  ultima_actualizacion: Date | null
  mesas: Mesa[]
}

// Cada local con sus mesas en un JSON, en una sola consulta
async function leerRestaurantes(id?: number): Promise<FilaRestaurante[]> {
  return sql()<FilaRestaurante[]>`
    SELECT r.id, r.nombre, r.tipo, r.direccion, r.lat, r.lng, r.ultima_actualizacion,
      COALESCE(
        (SELECT json_agg(json_build_object('id', m.id, 'nombre', m.nombre, 'capacidad', m.capacidad, 'zona', m.zona,
                                           'ocupada', m.ocupada, 'personas', m.personas) ORDER BY m.id)
         FROM mesas m WHERE m.restaurante_id = r.id),
        '[]'::json
      ) AS mesas
    FROM restaurantes r
    ${id === undefined ? sql()`` : sql()`WHERE r.id = ${id}`}
    ORDER BY r.nombre`
}

function armarLocal(fila: FilaRestaurante, promo: PromoActiva | undefined): Local {
  const mesas = fila.mesas
  const ultima = aIso(fila.ultima_actualizacion)

  const enVivo = ultima !== null && Date.now() - new Date(ultima).getTime() < SEGUNDOS_EN_VIVO * 1000

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
    mesasTotales: mesas.length,
    mesasLibres,
    mesasOcupadas: mesas.length - mesasLibres,
    mesas,
    promo: promo && mesasConPromo > 0 ? { descripcion: promo.descripcion, venceEn: promo.venceEn, mesasConPromo } : null,
  }
}

export async function listarLocales(): Promise<Local[]> {
  const [filas, promos] = await Promise.all([leerRestaurantes(), promosActivas()])
  return filas.map((f) => armarLocal(f, promos.get(f.id)))
}

export async function obtenerLocal(id: number): Promise<Local | null> {
  if (!Number.isInteger(id)) return null
  const [filas, promos] = await Promise.all([leerRestaurantes(id), promosActivas([id])])
  return filas[0] ? armarLocal(filas[0], promos.get(id)) : null
}

// "id" viene en las mesas que ya estaban guardadas
export type MesaNueva = { id?: number; nombre: string; capacidad: number; zona: Zona }

// Deja el local con exactamente estas mesas. Las que ya existían se actualizan y conservan su
// estado de la cámara (si alguien está sentado sigue ocupada); las nuevas arrancan libres.
export async function guardarMesas(restauranteId: number, mesas: MesaNueva[]) {
  await sql().begin(async (tx) => {
    const filas = await tx<{ id: number }[]>`SELECT id FROM mesas WHERE restaurante_id = ${restauranteId} FOR UPDATE`
    const existentes = new Set(filas.map((m) => m.id))
    const quedan = new Set(mesas.map((m) => m.id).filter((id): id is number => id !== undefined && existentes.has(id)))

    for (const id of existentes) {
      if (!quedan.has(id)) await tx`DELETE FROM mesas WHERE id = ${id} AND restaurante_id = ${restauranteId}`
    }
    for (const m of mesas) {
      if (m.id !== undefined && quedan.has(m.id)) {
        await tx`UPDATE mesas SET nombre = ${m.nombre}, capacidad = ${m.capacidad}, zona = ${tx.json(m.zona)}
                 WHERE id = ${m.id} AND restaurante_id = ${restauranteId}`
      } else {
        await tx`INSERT INTO mesas (restaurante_id, nombre, capacidad, zona) VALUES (${restauranteId}, ${m.nombre}, ${m.capacidad}, ${tx.json(m.zona)})`
      }
    }
  })
}

export type EstadoMesa = { mesaId: number; ocupada: boolean; personas: number }

// Guarda lo que detectó la cámara. Solo toca mesas que sean de ese local.
export async function guardarEstado(restauranteId: number, estados: EstadoMesa[]) {
  const { ocupadas, total, seOcuparon } = await sql().begin(async (tx) => {
    const anteriores = await tx<{ id: number; ocupada: boolean }[]>`
      SELECT id, ocupada FROM mesas WHERE restaurante_id = ${restauranteId} FOR UPDATE`
    const ocupadaAntes = new Map(anteriores.map((m) => [m.id, m.ocupada]))
    const validos = estados.filter((e) => ocupadaAntes.has(e.mesaId))
    for (const e of validos) {
      await tx`UPDATE mesas SET ocupada = ${e.ocupada}, personas = ${e.personas} WHERE id = ${e.mesaId}`
    }
    await tx`UPDATE restaurantes SET ultima_actualizacion = now() WHERE id = ${restauranteId}`

    const final = new Map(ocupadaAntes)
    for (const e of validos) final.set(e.mesaId, e.ocupada)
    return {
      ocupadas: [...final.values()].filter(Boolean).length,
      total: final.size,
      seOcuparon: validos.filter((e) => ocupadaAntes.get(e.mesaId) === false && e.ocupada).length,
    }
  })

  // La promo descuenta cupo con cada mesa que se ocupa, y termina si el local se llena
  if (seOcuparon > 0) await registrarMesasTomadas(restauranteId, seOcuparon)
  if (total > 0 && ocupadas === total) await terminarPromo(restauranteId, 'lleno')

  // Una fila por minuto de ocupación (para la predicción)
  if (total > 0) {
    const minuto = new Date().toISOString().slice(0, 16) // "2026-10-24T13:05"
    await sql()`
      INSERT INTO historial (restaurante_id, minuto, ocupadas, total) VALUES (${restauranteId}, ${minuto}, ${ocupadas}, ${total})
      ON CONFLICT DO NOTHING`
  }
}

export type PuntoHistorial = { minuto: string; ocupadas: number; total: number }

export async function leerHistorial(restauranteId: number, desde = ''): Promise<PuntoHistorial[]> {
  return sql()<PuntoHistorial[]>`
    SELECT minuto, ocupadas, total FROM historial
    WHERE restaurante_id = ${restauranteId} AND minuto >= ${desde}
    ORDER BY minuto`
}

// Ocupación de las últimas horas de un local, de más viejo a más nuevo
export function obtenerHistorial(restauranteId: number, horas: number): Promise<PuntoHistorial[]> {
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString().slice(0, 16)
  return leerHistorial(restauranteId, desde)
}
