import { useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import Asistente from '../componentes/Asistente'
import IndicadorEnVivo from '../componentes/IndicadorEnVivo'
import MapaLocales from '../componentes/MapaLocales'
import OfertasCerca from '../componentes/OfertasCerca'
import TarjetaLocal from '../componentes/TarjetaLocal'
import { buscarEnNominatim } from '../direcciones'
import { distanciaMetros, mesasQueAlcanzan, type Ubicacion } from '../disponibilidad'
import { useAhora, useLocales } from '../enVivo'

const OPCIONES_PERSONAS = [1, 2, 3, 4, 5, 6, 7, 8]
// Al buscar una dirección mostramos los locales a esta distancia
const RADIO_DIRECCION_METROS = 800

// Sin tildes ni mayúsculas, para que "cafe" encuentre "Café"
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

type Lugar = Ubicacion & { nombre: string }

export default function Inicio() {
  const { locales, cargando, error } = useLocales()
  const ahora = useAhora()
  const [personas, setPersonas] = useState(2)
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState('')
  const [sugeridos, setSugeridos] = useState<number[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [lugar, setLugar] = useState<Lugar | null>(null)
  const [buscandoDireccion, setBuscandoDireccion] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  // Las distancias se miden desde la dirección buscada o, si no hay, desde donde está el usuario
  const referencia = lugar ?? ubicacion
  const texto = normalizar(busqueda)
  const visibles = locales.filter((local) => {
    if (lugar) return distanciaMetros(lugar, local) <= RADIO_DIRECCION_METROS
    if (!texto) return true
    return [local.nombre, local.tipo, local.direccion].some((campo) => normalizar(campo).includes(texto))
  })

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor)
    setLugar(null)
    setErrorBusqueda('')
  }

  // Busca el texto como dirección (OpenStreetMap) y muestra los locales de alrededor
  async function buscarDireccion() {
    if (busqueda.trim().length < 3 || buscandoDireccion) return
    setBuscandoDireccion(true)
    setErrorBusqueda('')
    try {
      const [primero] = await buscarEnNominatim(busqueda)
      if (!primero) setErrorBusqueda('No encontramos esa dirección')
      else setLugar({ lat: Number(primero.lat), lng: Number(primero.lon), nombre: primero.display_name.split(',').slice(0, 2).join(',') })
    } catch (err) {
      setErrorBusqueda((err as Error).message)
    } finally {
      setBuscandoDireccion(false)
    }
  }

  // Enter: si ningún local coincide por nombre, lo tomamos como dirección
  function alApretarTecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !lugar && visibles.length === 0) buscarDireccion()
  }

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

  // Orden: sugeridos por el asistente, después los que tienen lugar para el grupo (primero los que
  // tienen más mesas libres donde entra, para favorecer a los locales vacíos; a igual lugar, el más cercano),
  // después los llenos y al final los sin datos
  const filas = visibles
    .map((local) => {
      const libresParaElGrupo = mesasQueAlcanzan(local, personas)
      return {
        local,
        libresParaElGrupo,
        disponible: libresParaElGrupo > 0,
        distancia: referencia ? distanciaMetros(referencia, local) : null,
        grupo: libresParaElGrupo > 0 ? 0 : local.enVivo ? 1 : 2,
        sugerido: sugeridos.includes(local.id),
      }
    })
    .sort(
      (a, b) =>
        Number(b.sugerido) - Number(a.sugerido) ||
        a.grupo - b.grupo ||
        b.libresParaElGrupo - a.libresParaElGrupo ||
        (a.distancia ?? 0) - (b.distancia ?? 0) ||
        a.local.nombre.localeCompare(b.local.nombre),
    )

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

          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => cambiarBusqueda(e.target.value)}
                onKeyDown={alApretarTecla}
                placeholder="Buscá un bar, restaurante o dirección"
                aria-label="Buscar locales o direcciones"
                className="w-full rounded-full border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">🔍</span>
            </div>
            {busqueda.trim().length >= 3 && !lugar && (
              <button
                onClick={buscarDireccion}
                disabled={buscandoDireccion}
                className="shrink-0 rounded-full border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                {buscandoDireccion ? 'Buscando…' : '📍 Es una dirección'}
              </button>
            )}
          </div>
          {lugar && (
            <p className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-1.5 text-sm text-sky-800">
              <span className="truncate">📍 Locales a menos de {RADIO_DIRECCION_METROS} m de {lugar.nombre}</span>
              <button onClick={() => cambiarBusqueda('')} className="shrink-0 font-medium underline">
                Quitar
              </button>
            </p>
          )}
          {errorBusqueda && <p className="mt-2 text-sm text-red-600">{errorBusqueda}</p>}

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

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 pt-4 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="lg:sticky lg:top-44 lg:order-2 lg:self-start">
          <MapaLocales
            locales={visibles}
            personas={personas}
            ubicacion={ubicacion}
            lugar={lugar}
            alUbicar={setUbicacion}
            sugeridos={sugeridos}
            ahora={ahora}
            className="h-60 w-full overflow-hidden rounded-2xl shadow-sm sm:h-80 lg:h-[calc(100vh-13rem)]"
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
              {buscandoUbicacion ? 'Buscando…' : ubicacion ? '📍 Ubicación activada' : '📍 Usar mi ubicación'}
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

          <OfertasCerca locales={visibles} personas={personas} ubicacion={referencia} ahora={ahora} />

          {locales.length > 0 && (
            <p className="mb-2 text-xs text-slate-500">
              Primero los que tienen más mesas libres para tu grupo{referencia ? '; a igual lugar, el más cercano' : ''}.
            </p>
          )}

          {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No pudimos cargar los locales: {error}</p>}
          {cargando && <p className="p-4 text-slate-500">Cargando locales…</p>}
          {!cargando && !error && locales.length === 0 && <p className="p-4 text-slate-500">Todavía no hay locales.</p>}
          {locales.length > 0 && visibles.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-600">
              {lugar
                ? `No hay locales a menos de ${RADIO_DIRECCION_METROS} m de esa dirección.`
                : 'Ningún local coincide. Si es una dirección, tocá "📍 Es una dirección" o apretá Enter.'}
            </p>
          )}

          <ul className="space-y-3">
            {filas.map((f) => (
              <li key={f.local.id}>
                <TarjetaLocal
                  local={f.local}
                  disponible={f.disponible}
                  personas={personas}
                  distancia={f.distancia}
                  sugerido={f.sugerido}
                  ahora={ahora}
                />
              </li>
            ))}
          </ul>

          <p className="mt-8 text-center text-sm text-slate-500">
            ¿Tenés un local?{' '}
            <Link href="/dueno" className="font-medium text-emerald-700 underline">
              Sumalo a HayMesa
            </Link>
          </p>
        </section>
      </main>

      <Asistente ubicacion={ubicacion} alSugerir={setSugeridos} />
    </div>
  )
}
