import { db } from './db.js'

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
}

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
}

type FilaMesa = {
  id: number
  nombre: string
  capacidad: number
  zona: string
  ocupada: number
  personas: number
}

function armarLocal(fila: FilaRestaurante): Local {
  const filasMesas = db
    .prepare('SELECT id, nombre, capacidad, zona, ocupada, personas FROM mesas WHERE restaurante_id = ? ORDER BY id')
    .all(fila.id) as FilaMesa[]

  const mesas = filasMesas.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    capacidad: m.capacidad,
    zona: JSON.parse(m.zona) as Zona,
    ocupada: m.ocupada === 1,
    personas: m.personas,
  }))

  const enVivo =
    fila.ultima_actualizacion !== null &&
    Date.now() - new Date(fila.ultima_actualizacion).getTime() < SEGUNDOS_EN_VIVO * 1000

  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    direccion: fila.direccion,
    lat: fila.lat,
    lng: fila.lng,
    enVivo,
    mesasLibres: mesas.filter((m) => !m.ocupada).length,
    mesas,
  }
}

const COLUMNAS_RESTAURANTE = 'id, nombre, tipo, direccion, lat, lng, ultima_actualizacion'

export function listarLocales(): Local[] {
  const filas = db
    .prepare(`SELECT ${COLUMNAS_RESTAURANTE} FROM restaurantes ORDER BY nombre`)
    .all() as FilaRestaurante[]
  return filas.map(armarLocal)
}

export function obtenerLocal(id: number): Local | null {
  const fila = db
    .prepare(`SELECT ${COLUMNAS_RESTAURANTE} FROM restaurantes WHERE id = ?`)
    .get(id) as FilaRestaurante | undefined
  return fila ? armarLocal(fila) : null
}

export type MesaNueva = { nombre: string; capacidad: number; zona: Zona }

// Reemplaza todas las mesas del local por las nuevas (el dueño las redibuja juntas)
export const guardarMesas = db.transaction((restauranteId: number, mesas: MesaNueva[]) => {
  db.prepare('DELETE FROM mesas WHERE restaurante_id = ?').run(restauranteId)
  const insertar = db.prepare('INSERT INTO mesas (restaurante_id, nombre, capacidad, zona) VALUES (?, ?, ?, ?)')
  for (const mesa of mesas) {
    insertar.run(restauranteId, mesa.nombre, mesa.capacidad, JSON.stringify(mesa.zona))
  }
})

export type EstadoMesa = { mesaId: number; ocupada: boolean; personas: number }

// Guarda lo que detectó la cámara. Solo toca mesas que sean de ese local.
export const guardarEstado = db.transaction((restauranteId: number, estados: EstadoMesa[]) => {
  const actualizar = db.prepare('UPDATE mesas SET ocupada = ?, personas = ? WHERE id = ? AND restaurante_id = ?')
  for (const estado of estados) {
    actualizar.run(estado.ocupada ? 1 : 0, estado.personas, estado.mesaId, restauranteId)
  }
  db.prepare('UPDATE restaurantes SET ultima_actualizacion = ? WHERE id = ?').run(new Date().toISOString(), restauranteId)
})

// Snapshot de ocupación de cada local en vivo, una fila por minuto (para la predicción)
export function guardarHistorial() {
  const minuto = new Date().toISOString().slice(0, 16) // "2026-10-24T13:05"
  const insertar = db.prepare(
    'INSERT OR IGNORE INTO historial (restaurante_id, minuto, ocupadas, total) VALUES (?, ?, ?, ?)'
  )
  for (const local of listarLocales()) {
    if (!local.enVivo || local.mesas.length === 0) continue
    insertar.run(local.id, minuto, local.mesas.length - local.mesasLibres, local.mesas.length)
  }
}

export type PuntoHistorial = { minuto: string; ocupadas: number; total: number }

// Ocupación de las últimas horas de un local, de más viejo a más nuevo
export function obtenerHistorial(restauranteId: number, horas: number): PuntoHistorial[] {
  const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString().slice(0, 16)
  return db
    .prepare('SELECT minuto, ocupadas, total FROM historial WHERE restaurante_id = ? AND minuto >= ? ORDER BY minuto')
    .all(restauranteId, desde) as PuntoHistorial[]
}
