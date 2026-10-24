import { responderAsistente } from '@/servidor/asistente'

// La ubicación es opcional y solo se usa para esta respuesta: no se guarda
export async function POST(req: Request) {
  const { texto, lat, lng } = await req.json().catch(() => ({}))

  if (typeof texto !== 'string' || !texto.trim() || texto.length > 500) {
    return Response.json({ error: 'Escribí una pregunta (hasta 500 caracteres)' }, { status: 400 })
  }

  const ubicacion = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  return Response.json(await responderAsistente(texto.trim(), ubicacion))
}
