import bcrypt from 'bcryptjs'
import { crearToken } from '@/servidor/auth'
import { obtenerLocal } from '@/servidor/locales'
import { sql } from '@/servidor/db'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))

  const [fila] = await sql()<{ id: number; password_hash: string }[]>`
    SELECT id, password_hash FROM restaurantes WHERE email = ${String(email ?? '')}`

  const valida = fila && (await bcrypt.compare(String(password ?? ''), fila.password_hash))
  if (!fila || !valida) return Response.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })

  return Response.json({ token: crearToken(fila.id), local: await obtenerLocal(fila.id) })
}
