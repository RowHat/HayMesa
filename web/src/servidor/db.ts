import postgres from 'postgres'

// Conexión directa a la base de Supabase (pooler en modo transacción, apto para Vercel).
// Solo se usa en el servidor: las tablas tienen RLS sin políticas, así que el público no las ve.
let conexion: postgres.Sql | null = null

export function sql(): postgres.Sql {
  if (!conexion) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('Falta DATABASE_URL')
    conexion = postgres(url, {
      prepare: false,
      max: 3,
      types: {
        // Los ids son bigint: los leemos como number
        bigint: { to: 20, from: [20], parse: (x: string) => Number(x), serialize: (x: number) => String(x) },
      },
    })
  }
  return conexion
}

export function aIso(fecha: Date | string | null): string | null {
  return fecha === null ? null : new Date(fecha).toISOString()
}
