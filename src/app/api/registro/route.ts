import bcrypt from 'bcryptjs'
import { crearToken } from '@/servidor/auth'
import { obtenerLocal } from '@/servidor/locales'
import { sql } from '@/servidor/db'

export async function POST(req: Request) {
  const { nombre, tipo, direccion, lat, lng, email, password } = await req.json().catch(() => ({}))

  if (!nombre || !direccion || !email || !password) {
    return Response.json({ error: 'Completá nombre, dirección, email y contraseña' }, { status: 400 })
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return Response.json({ error: 'Falta la ubicación del local (lat y lng)' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const [existe] = await sql()`SELECT id FROM restaurantes WHERE email = ${String(email)}`
  if (existe) return Response.json({ error: 'Ya hay un local registrado con ese email' }, { status: 409 })

  const passwordHash = await bcrypt.hash(String(password), 10)
  const [fila] = await sql()<{ id: number }[]>`
    INSERT INTO restaurantes (nombre, tipo, direccion, lat, lng, email, password_hash)
    VALUES (${String(nombre)}, ${String(tipo || 'Restaurante')}, ${String(direccion)}, ${lat}, ${lng}, ${String(email)}, ${passwordHash})
    RETURNING id`

  return Response.json({ token: crearToken(fila.id), local: await obtenerLocal(fila.id) }, { status: 201 })
}
