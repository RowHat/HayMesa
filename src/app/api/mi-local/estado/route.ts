import { noAutorizado, restauranteDe } from '@/servidor/auth'
import { guardarEstado, type EstadoMesa } from '@/servidor/locales'
import { avisarLocalActualizado } from '@/servidor/tiempoReal'

function esEstadoValido(e: any): e is EstadoMesa {
  return e && Number.isInteger(e.mesaId) && typeof e.ocupada === 'boolean' && Number.isInteger(e.personas) && e.personas >= 0
}

// La cámara del local manda { mesas: [{ mesaId, ocupada, personas }] } cada pocos segundos (nunca la imagen)
export async function POST(req: Request) {
  const id = restauranteDe(req)
  if (id === null) return noAutorizado()

  const mesas = (await req.json().catch(() => ({})))?.mesas
  if (!Array.isArray(mesas) || !mesas.every(esEstadoValido)) {
    return Response.json({ error: 'Formato de mesas inválido' }, { status: 400 })
  }

  await guardarEstado(id, mesas)
  await avisarLocalActualizado(id)
  return Response.json({ ok: true })
}
