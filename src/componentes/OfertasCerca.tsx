import Link from 'next/link'
import { distanciaMetros, formatearMetros, promoVigente, tieneMesaPara, tiempoRestante, type Ubicacion } from '../disponibilidad'
import type { Local } from '../tipos'

type Props = { locales: Local[]; personas: number; ubicacion: Ubicacion | null; ahora: number }

export default function OfertasCerca({ locales, personas, ubicacion, ahora }: Props) {
  // Solo promos vigentes en locales donde entra el grupo; primero las más cercanas y, a igual distancia, las que vencen antes
  const ofertas = locales
    .filter((l) => tieneMesaPara(l, personas))
    .flatMap((local) => {
      const promo = promoVigente(local, ahora)
      return promo ? [{ local, promo, distancia: ubicacion ? distanciaMetros(ubicacion, local) : null }] : []
    })
    .sort(
      (a, b) =>
        (a.distancia ?? 0) - (b.distancia ?? 0) || new Date(a.promo.venceEn).getTime() - new Date(b.promo.venceEn).getTime(),
    )

  if (ofertas.length === 0) return null

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">🔥 Ofertas ahora cerca tuyo</h2>
        {!ubicacion && <p className="text-xs text-slate-500">Activá tu ubicación para ver las más cercanas</p>}
      </div>

      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2">
        {ofertas.map(({ local, promo, distancia }) => (
          <li key={local.id} className="w-64 shrink-0 snap-start">
            <Link
              href={`/local/${local.slug}`}
              className="flex h-full flex-col rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-white p-4 shadow-sm transition hover:shadow-md"
            >
              <p className="text-base leading-snug font-bold text-pink-700">{promo.descripcion}</p>
              <p className="mt-1 truncate font-semibold text-slate-900">{local.nombre}</p>
              <p className="text-xs text-slate-500">
                {distancia !== null ? `📍 ${formatearMetros(distancia)} · ` : ''}
                {promo.mesasConPromo} {promo.mesasConPromo === 1 ? 'mesa' : 'mesas'} con promo
              </p>
              <p className="mt-auto pt-2 text-sm font-semibold text-slate-700 tabular-nums">⏱ Quedan {tiempoRestante(promo.venceEn, ahora)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
