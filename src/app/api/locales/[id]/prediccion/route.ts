import { predecir } from '@/servidor/prediccion'

// Público: ocupación esperada según el historial de ese día y hora
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return Response.json(await predecir(Number((await params).id)))
}
