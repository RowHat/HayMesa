import { noAutorizado, restauranteDe } from '@/servidor/auth'
import { guardarMesas, obtenerLocal, type MesaNueva } from '@/servidor/locales'
import { avisarLocalActualizado } from '@/servidor/tiempoReal'

function esZonaValida(zona: any): boolean {
  return zona && [zona.x, zona.y, zona.ancho, zona.alto].every((n) => typeof n === 'number' && n >= 0 && n <= 1)
}

// Dueño: reemplaza todas sus mesas
export async function PUT(req: Request) {
  const id = restauranteDe(req)
  if (id === null) return noAutorizado()

  const mesas = (await req.json().catch(() => ({})))?.mesas
  if (!Array.isArray(mesas)) return Response.json({ error: 'Mandá { mesas: [...] }' }, { status: 400 })

  for (const mesa of mesas) {
    if (!mesa.nombre || !Number.isInteger(mesa.capacidad) || mesa.capacidad < 1 || !esZonaValida(mesa.zona)) {
      return Response.json(
        { error: 'Cada mesa necesita nombre, capacidad (entero ≥ 1) y zona con valores entre 0 y 1' },
        { status: 400 },
      )
    }
  }

  await guardarMesas(id, mesas as MesaNueva[])
  await avisarLocalActualizado(id)
  return Response.json(await obtenerLocal(id))
}
