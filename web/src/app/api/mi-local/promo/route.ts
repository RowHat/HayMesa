import { noAutorizado, restauranteDe } from '@/servidor/auth'
import { obtenerLocal } from '@/servidor/locales'
import { activarPromo, terminarPromo } from '@/servidor/promos'
import { avisarLocalActualizado } from '@/servidor/tiempoReal'

// Dueño: activa una promo de último momento para sus mesas libres
export async function POST(req: Request) {
  const id = restauranteDe(req)
  if (id === null) return noAutorizado()
  const local = await obtenerLocal(id)
  if (!local) return noAutorizado()

  const { descripcion, minutos, cupo } = await req.json().catch(() => ({}))
  if (typeof descripcion !== 'string' || descripcion.trim().length < 3 || descripcion.length > 80) {
    return Response.json({ error: 'Escribí la promo (entre 3 y 80 caracteres)' }, { status: 400 })
  }
  if (!Number.isInteger(minutos) || minutos < 5 || minutos > 180) {
    return Response.json({ error: 'La vigencia tiene que ser de 5 a 180 minutos' }, { status: 400 })
  }
  if (!local.enVivo || local.mesasLibres === 0) {
    return Response.json(
      { error: 'Para activar una promo necesitás la cámara en vivo y al menos una mesa libre' },
      { status: 409 },
    )
  }
  if (!Number.isInteger(cupo) || cupo < 1 || cupo > local.mesasLibres) {
    return Response.json(
      { error: `El cupo tiene que ser de 1 a ${local.mesasLibres} mesas (las que tenés libres)` },
      { status: 400 },
    )
  }

  await activarPromo(id, descripcion.trim(), minutos, cupo)
  await avisarLocalActualizado(id)
  return Response.json(await obtenerLocal(id))
}

// Dueño: termina la promo antes de tiempo
export async function DELETE(req: Request) {
  const id = restauranteDe(req)
  if (id === null) return noAutorizado()
  await terminarPromo(id, 'manual')
  await avisarLocalActualizado(id)
  return Response.json(await obtenerLocal(id))
}
