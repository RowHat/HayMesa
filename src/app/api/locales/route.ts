import { listarLocales } from '@/servidor/locales'

export const dynamic = 'force-dynamic'

// Público: todos los locales con sus mesas
export async function GET() {
  return Response.json(await listarLocales())
}
