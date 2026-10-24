import bcrypt from 'bcrypt'
import { Router } from 'express'
import { crearToken } from '../auth.js'
import { db } from '../db.js'
import { obtenerLocal } from '../locales.js'

export const rutasAuth = Router()

rutasAuth.post('/registro', async (req, res) => {
  const { nombre, direccion, lat, lng, email, password } = req.body ?? {}

  if (!nombre || !direccion || !email || !password) {
    res.status(400).json({ error: 'Completá nombre, dirección, email y contraseña' })
    return
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'Falta la ubicación del local (lat y lng)' })
    return
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    return
  }

  const existe = db.prepare('SELECT id FROM restaurantes WHERE email = ?').get(email)
  if (existe) {
    res.status(409).json({ error: 'Ya hay un local registrado con ese email' })
    return
  }

  const passwordHash = await bcrypt.hash(String(password), 10)
  const resultado = db
    .prepare('INSERT INTO restaurantes (nombre, direccion, lat, lng, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nombre, direccion, lat, lng, email, passwordHash)

  const id = Number(resultado.lastInsertRowid)
  res.status(201).json({ token: crearToken(id), local: obtenerLocal(id) })
})

rutasAuth.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  const fila = db
    .prepare('SELECT id, password_hash FROM restaurantes WHERE email = ?')
    .get(email ?? '') as { id: number; password_hash: string } | undefined

  const valida = fila && (await bcrypt.compare(String(password ?? ''), fila.password_hash))
  if (!fila || !valida) {
    res.status(401).json({ error: 'Email o contraseña incorrectos' })
    return
  }

  res.json({ token: crearToken(fila.id), local: obtenerLocal(fila.id) })
})
