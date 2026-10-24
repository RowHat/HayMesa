import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { pedir } from '../api'
import IndicadorEnVivo from '../componentes/IndicadorEnVivo'
import NumeroAnimado from '../componentes/NumeroAnimado'
import PrediccionLocal from '../componentes/PrediccionLocal'
import { CLASE_NIVEL, ETIQUETA_NIVEL, nivelDe, promoVigente, tiempoRestante } from '../disponibilidad'
import { useAhora, useLocal } from '../enVivo'
import type { PuntoHistorial } from '../tipos'

const HORAS_HISTORIAL = 3

function useHistorial(id: number) {
  const [puntos, setPuntos] = useState<PuntoHistorial[]>([])
  useEffect(() => {
    const cargar = () => pedir<PuntoHistorial[]>(`/locales/${id}/historial?horas=${HORAS_HISTORIAL}`).then(setPuntos).catch(() => {})
    cargar()
    const intervalo = setInterval(cargar, 60_000) // el server guarda un punto por minuto
    return () => clearInterval(intervalo)
  }, [id])
  return puntos
}

function horaLocal(minutoUtc: string) {
  return new Date(minutoUtc + ':00Z').toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function DetalleLocal() {
  const id = Number(useParams<{ id: string }>().id)
  const { local, error } = useLocal(id)
  const historial = useHistorial(id)
  const ahora = useAhora()

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/" className="text-sm font-medium text-emerald-700">
          ← Todos los locales
        </Link>
        <p className="mt-4 text-slate-600">{error}</p>
      </main>
    )
  }
  if (!local) return <p className="p-6 text-slate-500">Cargando…</p>

  const nivel = nivelDe(local)
  const sinDatos = nivel === 'sin-datos'
  const promo = promoVigente(local, ahora)
  const datosGrafico = historial.map((p) => ({
    hora: horaLocal(p.minuto),
    ocupacion: Math.round((p.ocupadas / p.total) * 100),
  }))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm font-medium text-emerald-700">
              ← Todos los locales
            </Link>
            <IndicadorEnVivo />
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{local.nombre}</h1>
              <p className="text-slate-500">
                {local.tipo} · {local.direccion}
              </p>
            </div>
            <div className="sm:text-right">
              <span className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-500 ${CLASE_NIVEL[nivel]}`}>
                {ETIQUETA_NIVEL[nivel]}
              </span>
              {!sinDatos && (
                <p className="mt-2 text-slate-600">
                  <NumeroAnimado valor={local.mesasLibres} className="text-2xl font-bold text-emerald-600" /> de{' '}
                  {local.mesas.length} mesas libres
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {promo && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-white p-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-pink-600 uppercase">🔥 Promo de último momento</p>
              <p className="text-xl font-bold text-pink-700">{promo.descripcion}</p>
              <p className="text-sm text-slate-600">
                {promo.mesasConPromo} {promo.mesasConPromo === 1 ? 'mesa' : 'mesas'} con promo
              </p>
            </div>
            <p className="text-right">
              <span className="block text-xs text-slate-500">Quedan</span>
              <span className="text-3xl font-bold text-slate-900 tabular-nums">{tiempoRestante(promo.venceEn, ahora)}</span>
            </p>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Mesas</h2>
          {local.mesas.length === 0 && <p className="text-slate-500">Este local todavía no cargó sus mesas.</p>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {local.mesas.map((mesa) => {
              const clase = sinDatos
                ? 'border-slate-200 bg-white text-slate-400'
                : mesa.ocupada
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700'
              return (
                <li key={mesa.id} className={`rounded-2xl border-2 p-4 transition-colors duration-500 ${clase}`}>
                  <p className="font-semibold text-slate-900">{mesa.nombre}</p>
                  <p className="text-sm text-slate-500">👥 Hasta {mesa.capacidad}</p>
                  <p className="mt-2 font-semibold">{sinDatos ? 'Sin datos' : mesa.ocupada ? 'Ocupada' : 'Libre'}</p>
                </li>
              )
            })}
          </ul>
        </section>

        <PrediccionLocal id={local.id} />

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Ocupación de las últimas {HORAS_HISTORIAL} horas</h2>
          {datosGrafico.length < 2 ? (
            <p className="mt-2 text-sm text-slate-500">
              Todavía no hay suficiente historial. Se guarda un punto por minuto mientras la cámara del local está en vivo.
            </p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosGrafico} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="hora" tick={{ fontSize: 12, fill: '#64748b' }} minTickGap={30} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(valor) => [`${valor}%`, 'Ocupación']} />
                  <Area type="monotone" dataKey="ocupacion" stroke="#059669" strokeWidth={2} fill="url(#relleno)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
