import { Router } from 'express'
import { requiereAuth } from '../auth.js'
import { guardarMesas, listarLocales, obtenerLocal, type MesaNueva } from '../locales.js'
import { avisarLocalActualizado } from '../tiempoReal.js'

export const rutasLocales = Router()

// Público: todos los locales con sus mesas
rutasLocales.get('/locales', (_req, res) => {
  res.json(listarLocales())
})

// Dueño: su propio local
rutasLocales.get('/mi-local', requiereAuth, (_req, res) => {
  res.json(obtenerLocal(res.locals.restauranteId))
})

function esZonaValida(zona: any): boolean {
  return (
    zona && [zona.x, zona.y, zona.ancho, zona.alto].every((n) => typeof n === 'number' && n >= 0 && n <= 1)
  )
}

// Dueño: reemplaza todas sus mesas
rutasLocales.put('/mi-local/mesas', requiereAuth, (req, res) => {
  const mesas = req.body?.mesas
  if (!Array.isArray(mesas)) {
    res.status(400).json({ error: 'Mandá { mesas: [...] }' })
    return
  }

  for (const mesa of mesas) {
    if (!mesa.nombre || !Number.isInteger(mesa.capacidad) || mesa.capacidad < 1 || !esZonaValida(mesa.zona)) {
      res.status(400).json({ error: 'Cada mesa necesita nombre, capacidad (entero ≥ 1) y zona con valores entre 0 y 1' })
      return
    }
  }

  guardarMesas(res.locals.restauranteId, mesas as MesaNueva[])
  avisarLocalActualizado(res.locals.restauranteId)
  res.json(obtenerLocal(res.locals.restauranteId))
})
