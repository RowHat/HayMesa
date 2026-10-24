import jwt from 'jsonwebtoken'

function secreto() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('Falta JWT_SECRET')
  return s
}

export function crearToken(restauranteId: number): string {
  return jwt.sign({ restauranteId }, secreto(), { expiresIn: '7d' })
}

export function leerToken(token: string): number | null {
  try {
    const datos = jwt.verify(token, secreto()) as { restauranteId: number }
    return datos.restauranteId
  } catch {
    return null
  }
}

// Lee "Authorization: Bearer <token>"; null si no hay sesión válida
export function restauranteDe(req: Request): number | null {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  return leerToken(token)
}

export function noAutorizado() {
  return Response.json({ error: 'Tenés que iniciar sesión' }, { status: 401 })
}
