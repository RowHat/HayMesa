import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

const secreto = process.env.JWT_SECRET ?? ''
if (!secreto) throw new Error('Falta JWT_SECRET en server/.env')

export function crearToken(restauranteId: number): string {
  return jwt.sign({ restauranteId }, secreto, { expiresIn: '7d' })
}

export function leerToken(token: string): number | null {
  try {
    const datos = jwt.verify(token, secreto) as { restauranteId: number }
    return datos.restauranteId
  } catch {
    return null
  }
}

// Middleware: exige "Authorization: Bearer <token>" y deja el id en res.locals
export function requiereAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') ?? ''
  const restauranteId = leerToken(token)
  if (restauranteId === null) {
    res.status(401).json({ error: 'Tenés que iniciar sesión' })
    return
  }
  res.locals.restauranteId = restauranteId
  next()
}
