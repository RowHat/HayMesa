import { divIcon, type LatLngExpression, type Marker as MarcadorLeaflet } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Ubicacion } from '../disponibilidad'

const ROSARIO: [number, number] = [-32.947, -60.642]
// Gran Rosario, para que la búsqueda priorice resultados de la zona
const ZONA_ROSARIO = '-60.95,-32.80,-60.55,-33.10'

const pin = divIcon({ className: '', html: '<div class="pin-registro"></div>', iconSize: [28, 28], iconAnchor: [14, 34] })

type Resultado = { lat: string; lon: string; display_name: string }

// Nominatim (OpenStreetMap). Sus reglas piden no buscar en cada tecla: buscamos al confirmar.
async function buscarEnNominatim(texto: string): Promise<Resultado[]> {
  const buscar = async (extra: Record<string, string>) => {
    const parametros = new URLSearchParams({ q: texto, format: 'jsonv2', limit: '5', countrycodes: 'ar', 'accept-language': 'es', ...extra })
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${parametros}`)
    if (!respuesta.ok) throw new Error('El buscador de direcciones no respondió')
    return (await respuesta.json()) as Resultado[]
  }
  const enRosario = await buscar({ viewbox: ZONA_ROSARIO, bounded: '1' })
  return enRosario.length > 0 ? enRosario : buscar({})
}

// Click en el mapa → marca la ubicación
function AlHacerClick({ alCambiar }: { alCambiar: (u: Ubicacion) => void }) {
  useMapEvents({ click: (e) => alCambiar({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

// Centra el mapa cuando la ubicación viene de la búsqueda o del GPS
function Volar({ destino }: { destino: LatLngExpression | null }) {
  const mapa = useMap()
  useEffect(() => {
    if (destino) mapa.flyTo(destino, 17)
  }, [mapa, destino])
  return null
}

type Props = {
  direccion: string
  alCambiarDireccion: (texto: string) => void
  ubicacion: Ubicacion | null
  alCambiarUbicacion: (u: Ubicacion) => void
}

export default function SelectorUbicacion({ direccion, alCambiarDireccion, ubicacion, alCambiarUbicacion }: Props) {
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [destino, setDestino] = useState<[number, number] | null>(null)
  // Lo que encontró el buscador, para que el dueño confirme que es su local
  const [encontrado, setEncontrado] = useState('')

  function irA(lat: number, lng: number, descripcion = '') {
    alCambiarUbicacion({ lat, lng })
    setDestino([lat, lng])
    setEncontrado(descripcion)
  }

  // Click o arrastre: el dueño ajustó a mano, ya no es "lo que encontró el buscador"
  function marcarAMano(u: Ubicacion) {
    alCambiarUbicacion(u)
    setEncontrado('')
  }

  async function buscar() {
    if (direccion.trim().length < 3 || buscando) return
    setBuscando(true)
    setMensaje('')
    setResultados([])
    try {
      const encontrados = await buscarEnNominatim(direccion)
      if (encontrados.length === 0) setMensaje('No encontramos esa dirección. Marcá el local tocando el mapa.')
      else if (encontrados.length === 1) irA(Number(encontrados[0].lat), Number(encontrados[0].lon), encontrados[0].display_name)
      else setResultados(encontrados)
    } catch (err) {
      setMensaje((err as Error).message)
    } finally {
      setBuscando(false)
    }
  }

  function alApretarTecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault() // que el Enter busque y no envíe el formulario
      buscar()
    }
  }

  function usarMiUbicacion() {
    navigator.geolocation.getCurrentPosition(
      (pos) => irA(pos.coords.latitude, pos.coords.longitude),
      () => setMensaje('No pudimos obtener tu ubicación. Marcá el local tocando el mapa.'),
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          placeholder="Dirección (ej: Pichincha 200)"
          value={direccion}
          onChange={(e) => alCambiarDireccion(e.target.value)}
          onKeyDown={alApretarTecla}
          required
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || direccion.trim().length < 3}
          className="shrink-0 rounded-lg border border-emerald-600 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
        >
          {buscando ? 'Buscando…' : 'Buscar en el mapa'}
        </button>
      </div>

      {resultados.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
          <li className="bg-slate-50 px-3 py-1.5 text-xs text-slate-500">Elegí la dirección correcta:</li>
          {resultados.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button
                type="button"
                onClick={() => {
                  irA(Number(r.lat), Number(r.lon), r.display_name)
                  setResultados([])
                }}
                className="w-full px-3 py-2 text-left hover:bg-emerald-50"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {mensaje && <p className="text-sm text-amber-700">{mensaje}</p>}
      {encontrado && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Encontramos: {encontrado}. Si no es exacto, arrastrá el pin hasta tu puerta.
        </p>
      )}

      <MapContainer center={ROSARIO} zoom={13} className="z-0 h-64 w-full overflow-hidden rounded-lg border border-slate-300">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AlHacerClick alCambiar={marcarAMano} />
        <Volar destino={destino} />
        {ubicacion && (
          <Marker
            position={[ubicacion.lat, ubicacion.lng]}
            icon={pin}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as MarcadorLeaflet).getLatLng()
                marcarAMano({ lat, lng })
              },
            }}
          />
        )}
      </MapContainer>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className={ubicacion ? 'text-emerald-700' : 'text-slate-500'}>
          {ubicacion
            ? `📍 Ubicación marcada (${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}). Arrastrá el pin para ajustarla.`
            : 'Tocá el mapa para marcar dónde está tu local.'}
        </p>
        <button type="button" onClick={usarMiUbicacion} className="text-emerald-700 underline">
          Usar mi ubicación actual
        </button>
      </div>
    </div>
  )
}
