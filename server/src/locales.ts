import { db } from './db.js'

// Zona de la mesa sobre la imagen, en proporciones de 0 a 1
export type Zona = { x: number; y: number; ancho: number; alto: number }

export type Mesa = {
  id: number
  nombre: string
  capacidad: number
  zona: Zona
  ocupada: boolean
}

export type Local = {
  id: number
  nombre: string
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
}

function armarLocal(fila: FilaRestaurante): Local {
  const filasMesas = db
    .prepare('SELECT id, nombre, capacidad, zona, ocupada FROM mesas WHERE restaurante_id = ? ORDER BY id')
    .all(fila.id) as FilaMesa[]

  const mesas = filasMesas.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    capacidad: m.capacidad,
    zona: JSON.parse(m.zona) as Zona,
    ocupada: m.ocupada === 1,
  }))

  const enVivo =
    fila.ultima_actualizacion !== null &&
    Date.now() - new Date(fila.ultima_actualizacion).getTime() < SEGUNDOS_EN_VIVO * 1000

  return {
    id: fila.id,
    nombre: fila.nombre,
    direccion: fila.direccion,
    lat: fila.lat,
    lng: fila.lng,
    enVivo,
    mesasLibres: mesas.filter((m) => !m.ocupada).length,
    mesas,
  }
}

export function listarLocales(): Local[] {
  const filas = db
    .prepare('SELECT id, nombre, direccion, lat, lng, ultima_actualizacion FROM restaurantes ORDER BY nombre')
    .all() as FilaRestaurante[]
  return filas.map(armarLocal)
}

export function obtenerLocal(id: number): Local | null {
  const fila = db
    .prepare('SELECT id, nombre, direccion, lat, lng, ultima_actualizacion FROM restaurantes WHERE id = ?')
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
