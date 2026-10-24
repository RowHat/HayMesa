import { obtenerLocalPorSlug } from '@/servidor/locales'

// Público: un local, por slug ("cerveceria-la-fluvial") o por id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const local = await obtenerLocalPorSlug(decodeURIComponent((await params).id))
  if (!local) return Response.json({ error: 'No existe ese local' }, { status: 404 })
  return Response.json(local)
}
