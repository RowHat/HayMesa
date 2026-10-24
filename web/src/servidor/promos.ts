import { revisar, sb } from './supabase'

// Promo de último momento para las mesas libres de un local.
// El cupo se descuenta solo: cada mesa que pasa de libre a ocupada durante la promo cuenta como tomada.

export type PromoActiva = { id: number; descripcion: string; venceEn: string; cupo: number; mesasTomadas: number }

type FilaPromo = { id: number; restaurante_id: number; descripcion: string; vence_en: string; cupo: number; mesas_tomadas: number }

// Promos activas (sin terminar y sin vencer) por local
export async function promosActivas(restauranteIds?: number[]): Promise<Map<number, PromoActiva>> {
  let consulta = sb()
    .from('promos')
    .select('id, restaurante_id, descripcion, vence_en, cupo, mesas_tomadas')
    .is('terminada', null)
    .gt('vence_en', new Date().toISOString())
    .order('id')
  if (restauranteIds) consulta = consulta.in('restaurante_id', restauranteIds)
  const filas = revisar(await consulta) as FilaPromo[]
  const mapa = new Map<number, PromoActiva>()
  for (const f of filas) {
    mapa.set(f.restaurante_id, { id: f.id, descripcion: f.descripcion, venceEn: f.vence_en, cupo: f.cupo, mesasTomadas: f.mesas_tomadas })
  }
  return mapa
}

export async function terminarPromo(restauranteId: number, motivo: 'vencio' | 'cupo' | 'lleno' | 'manual') {
  revisar(await sb().from('promos').update({ terminada: motivo }).eq('restaurante_id', restauranteId).is('terminada', null))
}

export async function activarPromo(restauranteId: number, descripcion: string, minutos: number, cupo: number) {
  await terminarPromo(restauranteId, 'manual') // una sola promo activa por local
  const venceEn = new Date(Date.now() + minutos * 60_000).toISOString()
  revisar(await sb().from('promos').insert({ restaurante_id: restauranteId, descripcion, vence_en: venceEn, cupo }))
}

export async function registrarMesasTomadas(restauranteId: number, cantidad: number) {
  const promo = (await promosActivas([restauranteId])).get(restauranteId)
  if (!promo) return
  const tomadas = promo.mesasTomadas + cantidad
  revisar(
    await sb()
      .from('promos')
      .update({ mesas_tomadas: tomadas, ...(tomadas >= promo.cupo ? { terminada: 'cupo' } : {}) })
      .eq('id', promo.id),
  )
}
