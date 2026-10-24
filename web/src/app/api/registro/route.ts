import bcrypt from 'bcryptjs'
import { crearToken } from '@/servidor/auth'
import { obtenerLocal } from '@/servidor/locales'
import { revisar, sb } from '@/servidor/supabase'

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

  const existe = revisar(await sb().from('restaurantes').select('id').eq('email', email).maybeSingle())
  if (existe) return Response.json({ error: 'Ya hay un local registrado con ese email' }, { status: 409 })

  const passwordHash = await bcrypt.hash(String(password), 10)
  const fila = revisar(
    await sb()
      .from('restaurantes')
      .insert({ nombre, tipo: tipo || 'Restaurante', direccion, lat, lng, email, password_hash: passwordHash })
      .select('id')
      .single(),
  ) as { id: number }

  return Response.json({ token: crearToken(fila.id), local: await obtenerLocal(fila.id) }, { status: 201 })
}
