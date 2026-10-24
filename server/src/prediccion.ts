import { db } from './db.js'

// Argentina está en UTC-3 todo el año (sin horario de verano)
const DESFASE_ARGENTINA_MS = -3 * 3600 * 1000
const DIAS_MINIMOS = 3
const OCUPACION_LIBERA = 0.6
const HORAS_A_PREDECIR = 3
const HORAS_A_BUSCAR_LIBERACION = 12

export type Prediccion =
  | { suficientesDatos: false; diasConDatos: number }
  | {
      suficientesDatos: true
      diasConDatos: number
      // ocupación de 0 a 1, o null si nunca hubo datos para ese día y hora
      proximasHoras: { hora: string; ocupacion: number | null }[]
      seLiberaA: string | null
    }

// Fecha "corrida" a la hora argentina: se lee con getUTCDay / getUTCHours
function enArgentina(fecha: Date): Date {
  return new Date(fecha.getTime() + DESFASE_ARGENTINA_MS)
}

function clave(dia: number, hora: number) {
  return `${dia}-${hora}`
}

function formatearHora(hora: number) {
  return `${String(hora).padStart(2, '0')}:00`
}

export function predecir(restauranteId: number, ahora = new Date()): Prediccion {
  const filas = db.prepare('SELECT minuto, ocupadas, total FROM historial WHERE restaurante_id = ?').all(restauranteId) as {
    minuto: string
    ocupadas: number
    total: number
  }[]

  // Promedio de ocupación por día de la semana y hora, y también solo por hora
  const sumas = new Map<string, { suma: number; cantidad: number }>()
  const dias = new Set<string>()
  function acumular(k: string, ocupacion: number) {
    const acumulado = sumas.get(k) ?? { suma: 0, cantidad: 0 }
    acumulado.suma += ocupacion
    acumulado.cantidad += 1
    sumas.set(k, acumulado)
  }
  for (const fila of filas) {
    const fecha = enArgentina(new Date(fila.minuto + ':00Z'))
    dias.add(fecha.toISOString().slice(0, 10))
    acumular(clave(fecha.getUTCDay(), fecha.getUTCHours()), fila.ocupadas / fila.total)
    acumular(`hora-${fecha.getUTCHours()}`, fila.ocupadas / fila.total)
  }

  if (dias.size < DIAS_MINIMOS) return { suficientesDatos: false, diasConDatos: dias.size }

  function promedioDentroDe(horas: number): { hora: number; ocupacion: number | null } {
    const fecha = enArgentina(new Date(ahora.getTime() + horas * 3600 * 1000))
    // Si nunca hubo datos de ese día de la semana a esa hora, usamos esa hora en todos los días
    const acumulado = sumas.get(clave(fecha.getUTCDay(), fecha.getUTCHours())) ?? sumas.get(`hora-${fecha.getUTCHours()}`)
    return { hora: fecha.getUTCHours(), ocupacion: acumulado ? acumulado.suma / acumulado.cantidad : null }
  }

  const proximasHoras = []
  for (let h = 0; h < HORAS_A_PREDECIR; h++) {
    const { hora, ocupacion } = promedioDentroDe(h)
    proximasHoras.push({ hora: formatearHora(hora), ocupacion: ocupacion === null ? null : Math.round(ocupacion * 100) / 100 })
  }

  // La próxima hora (a partir de la siguiente) en la que suele haber menos de 60% ocupado
  let seLiberaA: string | null = null
  for (let h = 1; h <= HORAS_A_BUSCAR_LIBERACION; h++) {
    const { hora, ocupacion } = promedioDentroDe(h)
    if (ocupacion !== null && ocupacion < OCUPACION_LIBERA) {
      seLiberaA = formatearHora(hora)
      break
    }
  }

  return { suficientesDatos: true, diasConDatos: dias.size, proximasHoras, seLiberaA }
}
