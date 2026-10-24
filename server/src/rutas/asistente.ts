import { Router } from 'express'
import { responderAsistente } from '../asistente.js'

export const rutasAsistente = Router()

// La ubicación es opcional y solo se usa para esta respuesta: no se guarda
rutasAsistente.post('/asistente', async (req, res) => {
  const { texto, lat, lng } = req.body ?? {}

  if (typeof texto !== 'string' || !texto.trim() || texto.length > 500) {
    res.status(400).json({ error: 'Escribí una pregunta (hasta 500 caracteres)' })
    return
  }

  const ubicacion = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null
  res.json(await responderAsistente(texto.trim(), ubicacion))
})
