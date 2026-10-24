import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import Link from 'next/link'
import { colorMarcador, nivelDe, promoVigente, tiempoRestante, type Ubicacion } from '../disponibilidad'
import type { Local } from '../tipos'

const CENTRO_INICIAL: [number, number] = [-32.9476, -60.6305] // Rosario

// Encuadra el mapa cuando aparecen locales nuevos o el usuario comparte su ubicación
// (no en cada actualización de mesas, para no mover el mapa a cada rato)
// Calles en estilo claro (OpenFreeMap "positron"), sin íconos de comercios
function MapaBase() {
  const mapa = useMap()

  useEffect(() => {
    const capa = maplibreGL({ style: 'https://tiles.openfreemap.org/styles/positron' })
    capa.options.attribution =
      '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    capa.addTo(mapa)
    return () => {
      capa.remove()
    }
  }, [mapa])

  return null
}

function Encuadrar({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap()
  const clave = JSON.stringify(puntos)

  useEffect(() => {
    const coordenadas = JSON.parse(clave) as [number, number][]
    if (coordenadas.length === 1) mapa.setView(coordenadas[0], 15)
    if (coordenadas.length > 1) mapa.fitBounds(coordenadas, { padding: [40, 40], maxZoom: 16 })
  }, [mapa, clave])

  return null
}

const ICONO_TIPO: Record<string, string> = {
  Restaurante: '🍽️',
  Bar: '🍸',
  Café: '☕',
  Parrilla: '🥩',
  Pizzería: '🍕',
  Cervecería: '🍺',
}

function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function textoLibres(local: Local) {
  if (local.mesasLibres === 0) return 'Lleno'
  return `${local.mesasLibres} ${local.mesasLibres === 1 ? 'libre' : 'libres'}`
}

// Pin con el ícono del tipo de local, el color de disponibilidad y el nombre siempre visible.
// Los locales con promo laten y llevan un "%"
function icono(local: Local, personas: number, sugerido: boolean, conPromo: boolean) {
  const clases = ['marcador', sugerido ? 'marcador-sugerido' : '', conPromo ? 'marcador-promo' : ''].join(' ')
  const color = colorMarcador(local, personas)
  return divIcon({
    className: '',
    html: `<div class="marcador-pin" style="--color:${color}">
      <div class="${clases}">${ICONO_TIPO[local.tipo] ?? '📍'}${
        conPromo ? '<span class="marcador-etiqueta">%</span>' : ''
      }</div>
      <div class="marcador-nombre"><strong>${escaparHtml(local.nombre)}</strong><span>${textoLibres(local)}</span></div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  })
}

type Props = {
  locales: Local[]
  personas: number
  ubicacion: Ubicacion | null
  sugeridos: number[]
  ahora: number
  className?: string
}

const REFERENCIAS = [
  { color: '#10b981', texto: 'Mucho lugar' },
  { color: '#f59e0b', texto: 'Poco lugar' },
  { color: '#ef4444', texto: 'Sin lugar para tu grupo' },
]

function Referencias() {
  return (
    <div className="absolute bottom-3 left-3 z-[1000] rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-700 shadow">
      {REFERENCIAS.map((r) => (
        <p key={r.texto} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
          {r.texto}
        </p>
      ))}
      <p className="flex items-center gap-2">
        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-pink-600 text-[8px] font-bold text-white">%</span>
        Promo activa
      </p>
    </div>
  )
}

export default function MapaLocales({ locales: todos, personas, ubicacion, sugeridos, ahora, className = '' }: Props) {
  // En el mapa solo van los locales con la cámara en vivo
  const locales = todos.filter((l) => nivelDe(l) !== 'sin-datos')
  const puntos: [number, number][] = locales.map((l) => [l.lat, l.lng])
  if (ubicacion) puntos.push([ubicacion.lat, ubicacion.lng])

  return (
    <div className={`relative ${className}`}>
      <MapContainer center={CENTRO_INICIAL} zoom={13} scrollWheelZoom={false} className="z-0 h-full w-full">
        <MapaBase />
        <Encuadrar puntos={puntos} />

        {ubicacion && (
          <CircleMarker
            center={[ubicacion.lat, ubicacion.lng]}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }}
          >
            <Popup>Estás acá</Popup>
          </CircleMarker>
        )}

        {locales.map((local) => {
          const promo = promoVigente(local, ahora)
          return (
            <Marker
              key={local.id}
              position={[local.lat, local.lng]}
              icon={icono(local, personas, sugeridos.includes(local.id), promo !== null)}
              // Los que tienen más mesas libres quedan dibujados arriba
              zIndexOffset={local.mesasLibres * 100}
            >
              <Popup>
                <p className="font-semibold">{local.nombre}</p>
                <p>{`${local.mesasLibres} de ${local.mesas.length} mesas libres`}</p>
                {promo && (
                  <p className="font-semibold text-pink-700">
                    🔥 {promo.descripcion} · quedan {tiempoRestante(promo.venceEn, ahora)}
                  </p>
                )}
                <Link href={`/local/${local.id}`}>Ver mesas →</Link>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      <Referencias />
    </div>
  )
}
