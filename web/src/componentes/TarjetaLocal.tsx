import { Link } from 'react-router-dom'
import { CLASE_NIVEL, ETIQUETA_NIVEL, formatearMetros, nivelDe } from '../disponibilidad'
import type { Local } from '../tipos'
import NumeroAnimado from './NumeroAnimado'

type Props = { local: Local; disponible: boolean; personas: number; distancia: number | null; sugerido: boolean }

export default function TarjetaLocal({ local, disponible, personas, distancia, sugerido }: Props) {
  const nivel = nivelDe(local)
  const sinDatos = nivel === 'sin-datos'

  return (
    <Link
      to={`/local/${local.id}`}
      className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        disponible ? 'border-emerald-200' : 'border-slate-200 opacity-60'
      } ${sugerido ? 'ring-4 ring-sky-400/70' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-slate-900">{local.nombre}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-500 ${CLASE_NIVEL[nivel]}`}>
            {ETIQUETA_NIVEL[nivel]}
          </span>
          {sugerido && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">✨ Sugerido</span>}
        </div>
        <p className="truncate text-sm text-slate-500">
          {local.tipo} · {local.direccion}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {distancia !== null && <span className="mr-2 font-medium text-sky-700">📍 {formatearMetros(distancia)}</span>}
          {!sinDatos && !disponible && <span>No hay mesa libre para {personas}</span>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {sinDatos ? (
          <p className="text-sm text-slate-400">—</p>
        ) : (
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            <NumeroAnimado valor={local.mesasLibres} className={disponible ? 'text-emerald-600' : ''} />
            <span className="text-base font-medium text-slate-400">/{local.mesas.length}</span>
          </p>
        )}
        <p className="text-xs text-slate-500">mesas libres</p>
      </div>
    </Link>
  )
}
