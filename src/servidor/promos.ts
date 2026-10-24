import { aIso, sql } from './db'

// Promo de último momento para las mesas libres de un local.
// El cupo se descuenta solo: cada mesa que pasa de libre a ocupada durante la promo cuenta como tomada.

export type PromoActiva = { id: number; descripcion: string; venceEn: string; cupo: number; mesasTomadas: number }

type FilaPromo = { id: number; restaurante_id: number; descripcion: string; vence_en: Date; cupo: number; mesas_tomadas: number }

// Promos activas (sin terminar y sin vencer) por local
export async function promosActivas(restauranteIds?: number[]): Promise<Map<number, PromoActiva>> {
  const filas = await sql()<FilaPromo[]>`
    SELECT id, restaurante_id, descripcion, vence_en, cupo, mesas_tomadas FROM promos
    WHERE terminada IS NULL AND vence_en > now()
    ${restauranteIds ? sql()`AND restaurante_id IN ${sql()(restauranteIds)}` : sql()``}
    ORDER BY id`
  const mapa = new Map<number, PromoActiva>()
  for (const f of filas) {
    mapa.set(f.restaurante_id, { id: f.id, descripcion: f.descripcion, venceEn: aIso(f.vence_en)!, cupo: f.cupo, mesasTomadas: f.mesas_tomadas })
  }
  return mapa
}

export async function terminarPromo(restauranteId: number, motivo: 'vencio' | 'cupo' | 'lleno' | 'manual') {
  await sql()`UPDATE promos SET terminada = ${motivo} WHERE restaurante_id = ${restauranteId} AND terminada IS NULL`
}

export async function activarPromo(restauranteId: number, descripcion: string, minutos: number, cupo: number) {
  await terminarPromo(restauranteId, 'manual') // una sola promo activa por local
  const venceEn = new Date(Date.now() + minutos * 60_000)
  await sql()`INSERT INTO promos (restaurante_id, descripcion, vence_en, cupo) VALUES (${restauranteId}, ${descripcion}, ${venceEn}, ${cupo})`
}

export async function registrarMesasTomadas(restauranteId: number, cantidad: number) {
  await sql()`
    UPDATE promos
    SET mesas_tomadas = mesas_tomadas + ${cantidad},
        terminada = CASE WHEN mesas_tomadas + ${cantidad} >= cupo THEN 'cupo' ELSE terminada END
    WHERE restaurante_id = ${restauranteId} AND terminada IS NULL AND vence_en > now()`
}
