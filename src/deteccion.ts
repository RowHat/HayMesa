import type { Zona } from './tipos'

// Una persona detectada, en proporciones de 0 a 1 (igual que las zonas)
export type Caja = Zona

// Qué parte de la persona tiene que caer dentro de la mesa para contarla
const SOLAPAMIENTO_MINIMO = 0.3

function areaInterseccion(a: Caja, b: Zona): number {
  const ancho = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x)
  const alto = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y)
  return ancho > 0 && alto > 0 ? ancho * alto : 0
}

// Asigna cada persona a la mesa con la que más se superpone (así no se cuenta dos veces)
export function contarPersonasPorMesa(personas: Caja[], mesas: { id: number; zona: Zona }[]): Map<number, number> {
  const conteo = new Map(mesas.map((m) => [m.id, 0]))

  for (const persona of personas) {
    const areaPersona = persona.ancho * persona.alto
    let mejorMesa: number | null = null
    let mejorProporcion = 0

    for (const mesa of mesas) {
      const proporcion = areaInterseccion(persona, mesa.zona) / areaPersona
      if (proporcion > mejorProporcion) {
        mejorProporcion = proporcion
        mejorMesa = mesa.id
      }
    }

    if (mejorMesa !== null && mejorProporcion >= SOLAPAMIENTO_MINIMO) {
      conteo.set(mejorMesa, (conteo.get(mejorMesa) ?? 0) + 1)
    }
  }

  return conteo
}
