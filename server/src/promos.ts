import { db } from './db.js'

// Promo de último momento para las mesas libres de un local.
// El cupo se descuenta solo: cada mesa que pasa de libre a ocupada durante la promo cuenta como tomada.

type FilaPromo = { id: number; descripcion: string; vence_en: string; cupo: number; mesas_tomadas: number }

export type PromoActiva = { descripcion: string; venceEn: string; cupo: number; mesasTomadas: number }

export function promoActiva(restauranteId: number): PromoActiva | null {
  const fila = db
    .prepare('SELECT id, descripcion, vence_en, cupo, mesas_tomadas FROM promos WHERE restaurante_id = ? AND terminada IS NULL ORDER BY id DESC LIMIT 1')
    .get(restauranteId) as FilaPromo | undefined
  // Si ya venció pero todavía no pasó la revisión periódica, igual la consideramos terminada
  if (!fila || new Date(fila.vence_en).getTime() <= Date.now()) return null
  return { descripcion: fila.descripcion, venceEn: fila.vence_en, cupo: fila.cupo, mesasTomadas: fila.mesas_tomadas }
}

export function terminarPromo(restauranteId: number, motivo: 'vencio' | 'cupo' | 'lleno' | 'manual'): boolean {
  const resultado = db.prepare('UPDATE promos SET terminada = ? WHERE restaurante_id = ? AND terminada IS NULL').run(motivo, restauranteId)
  return resultado.changes > 0
}

export function activarPromo(restauranteId: number, descripcion: string, minutos: number, cupo: number) {
  terminarPromo(restauranteId, 'manual') // una sola promo activa por local
  const venceEn = new Date(Date.now() + minutos * 60_000).toISOString()
  db.prepare('INSERT INTO promos (restaurante_id, descripcion, vence_en, cupo) VALUES (?, ?, ?, ?)').run(restauranteId, descripcion, venceEn, cupo)
}

export function registrarMesasTomadas(restauranteId: number, cantidad: number) {
  db.prepare('UPDATE promos SET mesas_tomadas = mesas_tomadas + ? WHERE restaurante_id = ? AND terminada IS NULL').run(cantidad, restauranteId)
  db.prepare("UPDATE promos SET terminada = 'cupo' WHERE restaurante_id = ? AND terminada IS NULL AND mesas_tomadas >= cupo").run(restauranteId)
}

// Marca como vencidas las promos cuyo tiempo terminó. Devuelve los locales afectados.
export function vencerPromos(): number[] {
  const ahora = new Date().toISOString()
  const filas = db.prepare('SELECT restaurante_id FROM promos WHERE terminada IS NULL AND vence_en <= ?').all(ahora) as { restaurante_id: number }[]
  db.prepare("UPDATE promos SET terminada = 'vencio' WHERE terminada IS NULL AND vence_en <= ?").run(ahora)
  return filas.map((f) => f.restaurante_id)
}
