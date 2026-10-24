import { useState } from 'react'
import { Link } from 'react-router-dom'
import Asistente from '../componentes/Asistente'
import IndicadorEnVivo from '../componentes/IndicadorEnVivo'
import MapaLocales from '../componentes/MapaLocales'
import TarjetaLocal from '../componentes/TarjetaLocal'
import { distanciaMetros, tieneMesaPara, type Ubicacion } from '../disponibilidad'
import { useLocales } from '../enVivo'

const OPCIONES_PERSONAS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function Inicio() {
  const { locales, cargando, error } = useLocales()
  const [personas, setPersonas] = useState(2)
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState('')
  const [sugeridos, setSugeridos] = useState<number[]>([])

  // La ubicación se usa en este navegador para calcular distancias (y en las preguntas al asistente)
  function usarMiUbicacion() {
    setBuscandoUbicacion(true)
    setErrorUbicacion('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setBuscandoUbicacion(false)
      },
      () => {
        setErrorUbicacion('No pudimos obtener tu ubicación')
        setBuscandoUbicacion(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // Primero los sugeridos por el asistente, después los que tienen lugar para el grupo,
  // después los llenos y al final los sin datos
  const filas = locales
    .map((local) => ({
      local,
      disponible: tieneMesaPara(local, personas),
      distancia: ubicacion ? distanciaMetros(ubicacion, local) : null,
      grupo: tieneMesaPara(local, personas) ? 0 : local.enVivo ? 1 : 2,
      sugerido: sugeridos.includes(local.id),
    }))
    .sort((a, b) => Number(b.sugerido) - Number(a.sugerido) || a.grupo - b.grupo || (a.distancia ?? 0) - (b.distancia ?? 0) || a.local.nombre.localeCompare(b.local.nombre))

  const cantidadDisponibles = filas.filter((f) => f.disponible).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-emerald-600">
              Hay<span className="text-slate-900">Mesa</span>
            </h1>
            <IndicadorEnVivo />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium text-slate-700">¿Cuántos son?</span>
            <div className="flex gap-1 overflow-x-auto">
              {OPCIONES_PERSONAS.map((n) => (
                <button
                  key={n}
                  onClick={() => setPersonas(n)}
                  aria-pressed={personas === n}
                  className={`h-9 w-9 shrink-0 rounded-full text-sm font-semibold transition ${
                    personas === n ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 pt-4 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="lg:sticky lg:top-32 lg:order-2 lg:self-start">
          <MapaLocales
            locales={locales}
            personas={personas}
            ubicacion={ubicacion}
            sugeridos={sugeridos}
            className="h-60 w-full overflow-hidden rounded-2xl shadow-sm sm:h-80 lg:h-[calc(100vh-10rem)]"
          />
        </section>

        <section className="lg:order-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{cantidadDisponibles}</span>{' '}
              {cantidadDisponibles === 1 ? 'local tiene' : 'locales tienen'} mesa para {personas}{' '}
              {personas === 1 ? 'persona' : 'personas'}
            </p>
            <button
              onClick={usarMiUbicacion}
              disabled={buscandoUbicacion}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {buscandoUbicacion ? 'Buscando…' : ubicacion ? '📍 Ordenado por distancia' : '📍 Usar mi ubicación'}
            </button>
          </div>
          {errorUbicacion && <p className="mb-3 text-sm text-red-600">{errorUbicacion}</p>}
          {ubicacion && (
            <p className="mb-3 text-xs text-slate-500">
              Tu ubicación no se guarda: se usa para calcular distancias y, si le preguntás al asistente, solo para esa respuesta.
            </p>
          )}
          {sugeridos.length > 0 && (
            <p className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
              ✨ Arriba, los locales que te sugirió el asistente
              <button onClick={() => setSugeridos([])} className="font-medium underline">
                Quitar
              </button>
            </p>
          )}

          {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No pudimos cargar los locales: {error}</p>}
          {cargando && <p className="p-4 text-slate-500">Cargando locales…</p>}
          {!cargando && !error && locales.length === 0 && <p className="p-4 text-slate-500">Todavía no hay locales.</p>}

          <ul className="space-y-3">
            {filas.map((f) => (
              <li key={f.local.id}>
                <TarjetaLocal
                  local={f.local}
                  disponible={f.disponible}
                  personas={personas}
                  distancia={f.distancia}
                  sugerido={f.sugerido}
                />
              </li>
            ))}
          </ul>

          <p className="mt-8 text-center text-sm text-slate-500">
            ¿Tenés un local?{' '}
            <Link to="/dueno" className="font-medium text-emerald-700 underline">
              Sumalo a HayMesa
            </Link>
          </p>
        </section>
      </main>

      <Asistente ubicacion={ubicacion} alSugerir={setSugeridos} />
    </div>
  )
}
