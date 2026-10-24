import { obtenerLocal } from '@/servidor/locales'

// Público: un local
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const local = await obtenerLocal(Number((await params).id))
  if (!local) return Response.json({ error: 'No existe ese local' }, { status: 404 })
  return Response.json(local)
}
