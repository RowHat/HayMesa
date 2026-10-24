import { noAutorizado, restauranteDe } from '@/servidor/auth'
import { obtenerLocal } from '@/servidor/locales'

export const dynamic = 'force-dynamic'

// Dueño: su propio local
export async function GET(req: Request) {
  const id = restauranteDe(req)
  if (id === null) return noAutorizado()
  return Response.json(await obtenerLocal(id))
}
