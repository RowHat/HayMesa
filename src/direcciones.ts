// Gran Rosario, para que la búsqueda priorice resultados de la zona
const ZONA_ROSARIO = '-60.95,-32.80,-60.55,-33.10'

export type Resultado = { lat: string; lon: string; display_name: string }

// Nominatim (OpenStreetMap). Sus reglas piden no buscar en cada tecla: buscamos al confirmar.
export async function buscarEnNominatim(texto: string): Promise<Resultado[]> {
  const buscar = async (extra: Record<string, string>) => {
    const parametros = new URLSearchParams({ q: texto, format: 'jsonv2', limit: '5', countrycodes: 'ar', 'accept-language': 'es', ...extra })
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${parametros}`)
    if (!respuesta.ok) throw new Error('El buscador de direcciones no respondió')
    return (await respuesta.json()) as Resultado[]
  }
  const enRosario = await buscar({ viewbox: ZONA_ROSARIO, bounded: '1' })
  return enRosario.length > 0 ? enRosario : buscar({})
}
