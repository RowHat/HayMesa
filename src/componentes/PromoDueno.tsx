import { useState, type FormEvent } from 'react'
import { pedir } from '../api'
import { promoVigente, tiempoRestante } from '../disponibilidad'
import { useAhora } from '../enVivo'
import type { Local } from '../tipos'

const OPCIONES_MINUTOS = [15, 30, 45, 60]
const claseCampo = 'w-full rounded bg-slate-700 px-2 py-1.5 text-sm'

type Props = { local: Local; alCambiar: (local: Local) => void; alError: (mensaje: string) => void }

// Promo de último momento para llenar las mesas libres
export default function PromoDueno({ local, alCambiar, alError }: Props) {
  const ahora = useAhora()
  const [descripcion, setDescripcion] = useState('20% off si llegás en los próximos 30 min')
  const [minutos, setMinutos] = useState(30)
  const [cupo, setCupo] = useState(1)
  const [enviando, setEnviando] = useState(false)

  const promo = promoVigente(local, ahora)
  const puedeActivar = local.enVivo && local.mesasLibres > 0

  async function llamar(metodo: 'POST' | 'DELETE', cuerpo?: unknown) {
    setEnviando(true)
    try {
      alCambiar(await pedir<Local>('/mi-local/promo', metodo, cuerpo))
    } catch (err) {
      alError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  function activar(e: FormEvent) {
    e.preventDefault()
    llamar('POST', { descripcion, minutos, cupo: Math.min(cupo, local.mesasLibres) })
  }

  return (
    <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 p-3">
      <h2 className="font-semibold">🔥 Promo de último momento</h2>

      {promo ? (
        <div className="mt-2 space-y-1">
          <p className="font-semibold text-pink-200">{promo.descripcion}</p>
          <p className="text-sm text-slate-300">
            Quedan <span className="font-semibold tabular-nums">{tiempoRestante(promo.venceEn, ahora)}</span> ·{' '}
            {promo.mesasConPromo} {promo.mesasConPromo === 1 ? 'mesa' : 'mesas'} con promo
          </p>
          <p className="text-xs text-slate-400">Se termina sola al vencer, al ocuparse el cupo o si se llena el local.</p>
          <button
            onClick={() => llamar('DELETE')}
            disabled={enviando}
            className="mt-2 w-full rounded-lg border border-pink-400/60 py-1.5 text-sm hover:bg-pink-500/20 disabled:opacity-40"
          >
            Terminar promo
          </button>
        </div>
      ) : (
        <form onSubmit={activar} className="mt-2 space-y-2">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={80}
            required
            className={claseCampo}
            aria-label="Texto de la promo"
          />
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-slate-300">
              Vigencia
              <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} className={claseCampo}>
                {OPCIONES_MINUTOS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs text-slate-300">
              Cupo de mesas
              <input
                type="number"
                min={1}
                max={Math.max(1, local.mesasLibres)}
                value={cupo}
                onChange={(e) => setCupo(Math.max(1, Math.round(Number(e.target.value)) || 1))}
                className={claseCampo}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={enviando || !puedeActivar}
            className="w-full rounded-lg bg-pink-600 py-2 text-sm font-semibold hover:bg-pink-700 disabled:opacity-40"
          >
            Activar promo
          </button>
          {!puedeActivar && (
            <p className="text-xs text-slate-400">Necesitás la cámara en vivo y al menos una mesa libre para activarla.</p>
          )}
        </form>
      )}
    </div>
  )
}
