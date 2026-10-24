import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { colorMarcador, type Ubicacion } from '../disponibilidad'
import type { Local } from '../tipos'

const CENTRO_INICIAL: [number, number] = [-32.9476, -60.6305] // Rosario

// Encuadra el mapa cuando aparecen locales nuevos o el usuario comparte su ubicación
// (no en cada actualización de mesas, para no mover el mapa a cada rato)
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

type Props = { locales: Local[]; personas: number; ubicacion: Ubicacion | null; sugeridos: number[]; className?: string }

export default function MapaLocales({ locales, personas, ubicacion, sugeridos, className = '' }: Props) {
  const puntos: [number, number][] = locales.map((l) => [l.lat, l.lng])
  if (ubicacion) puntos.push([ubicacion.lat, ubicacion.lng])

  return (
    <MapContainer center={CENTRO_INICIAL} zoom={13} scrollWheelZoom={false} className={`z-0 ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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

      {locales.map((local) => (
        <CircleMarker
          key={local.id}
          center={[local.lat, local.lng]}
          radius={sugeridos.includes(local.id) ? 18 : 13}
          pathOptions={{
            color: sugeridos.includes(local.id) ? '#0284c7' : '#ffffff',
            weight: sugeridos.includes(local.id) ? 5 : 3,
            fillColor: colorMarcador(local, personas),
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <p className="font-semibold">{local.nombre}</p>
            <p>
              {local.enVivo ? `${local.mesasLibres} de ${local.mesas.length} mesas libres` : 'Sin datos ahora'}
            </p>
            <Link to={`/local/${local.id}`}>Ver mesas →</Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
