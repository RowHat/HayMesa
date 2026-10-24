import { useEffect, useState } from 'react'
import { pedir } from '../api'
import type { Prediccion } from '../tipos'

function colorBarra(ocupacion: number) {
  if (ocupacion >= 0.9) return 'bg-red-400'
  if (ocupacion >= 0.6) return 'bg-amber-400'
  return 'bg-emerald-400'
}

export default function PrediccionLocal({ id }: { id: number }) {
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null)

  useEffect(() => {
    const cargar = () => pedir<Prediccion>(`/locales/${id}/prediccion`).then(setPrediccion).catch(() => {})
    cargar()
    const intervalo = setInterval(cargar, 5 * 60_000)
    return () => clearInterval(intervalo)
  }, [id])

  if (!prediccion) return null

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Predicción</h2>

      {!prediccion.suficientesDatos ? (
        <p className="mt-2 text-sm text-slate-500">
          Juntando datos: la predicción mejora con el uso. ({prediccion.diasConDatos} de 3 días necesarios)
        </p>
      ) : (
        <>
          {prediccion.seLiberaA && (
            <p className="mt-1 text-slate-700">
              Suele liberarse a las <span className="font-semibold text-emerald-700">{prediccion.seLiberaA}</span>
            </p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {prediccion.proximasHoras.map((h, i) => (
              <div key={h.hora} className="text-center">
                <div className="mx-auto flex h-24 w-12 items-end overflow-hidden rounded-lg bg-slate-100">
                  {h.ocupacion !== null && (
                    <div className={`w-full ${colorBarra(h.ocupacion)}`} style={{ height: `${Math.max(4, h.ocupacion * 100)}%` }} />
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {h.ocupacion === null ? 'Sin datos' : `${Math.round(h.ocupacion * 100)}%`}
                </p>
                <p className="text-xs text-slate-500">{i === 0 ? `Ahora (${h.hora})` : h.hora}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Ocupación promedio según {prediccion.diasConDatos} días de datos de este local.</p>
        </>
      )}
    </section>
  )
}
