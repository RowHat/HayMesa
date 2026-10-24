import { obtenerHistorial } from '@/servidor/locales'

// Público: ocupación de las últimas horas (por defecto 3, máximo 24)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const horas = Math.min(24, Math.max(1, Number(new URL(req.url).searchParams.get('horas')) || 3))
  return Response.json(await obtenerHistorial(Number((await params).id), horas))
}
