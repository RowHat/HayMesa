import { Router } from 'express'
import { requiereAuth } from '../auth.js'
import { guardarMesas, listarLocales, obtenerHistorial, obtenerLocal, type MesaNueva } from '../locales.js'
import { predecir } from '../prediccion.js'
import { avisarLocalActualizado } from '../tiempoReal.js'

export const rutasLocales = Router()

// Público: todos los locales con sus mesas
rutasLocales.get('/locales', (_req, res) => {
  res.json(listarLocales())
})

// Público: un local
rutasLocales.get('/locales/:id', (req, res) => {
  const local = obtenerLocal(Number(req.params.id))
  if (!local) {
    res.status(404).json({ error: 'No existe ese local' })
    return
  }
  res.json(local)
})

// Público: ocupación de las últimas horas (por defecto 3, máximo 24)
rutasLocales.get('/locales/:id/historial', (req, res) => {
  const horas = Math.min(24, Math.max(1, Number(req.query.horas) || 3))
  res.json(obtenerHistorial(Number(req.params.id), horas))
})

// Público: ocupación esperada según el historial de ese día y hora
rutasLocales.get('/locales/:id/prediccion', (req, res) => {
  res.json(predecir(Number(req.params.id)))
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
