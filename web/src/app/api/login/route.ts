import bcrypt from 'bcryptjs'
import { crearToken } from '@/servidor/auth'
import { obtenerLocal } from '@/servidor/locales'
import { revisar, sb } from '@/servidor/supabase'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))

  const fila = revisar(
    await sb().from('restaurantes').select('id, password_hash').eq('email', String(email ?? '')).maybeSingle(),
  ) as { id: number; password_hash: string } | null

  const valida = fila && (await bcrypt.compare(String(password ?? ''), fila.password_hash))
  if (!fila || !valida) return Response.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })

  return Response.json({ token: crearToken(fila.id), local: await obtenerLocal(fila.id) })
}
