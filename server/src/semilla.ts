import bcrypt from 'bcrypt'
import { db } from './db.js'

// Si la base está vacía, crea el local de demo para el evento
export function crearLocalDemo() {
  const { cantidad } = db.prepare('SELECT COUNT(*) AS cantidad FROM restaurantes').get() as { cantidad: number }
  if (cantidad > 0) return

  db.prepare(
    'INSERT INTO restaurantes (nombre, tipo, direccion, lat, lng, email, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run('Bar del Evento', 'Bar', 'Rosario, Santa Fe', -32.9476, -60.6305, 'demo@haymesa.com', bcrypt.hashSync('demo1234', 10))

  console.log('Local de demo creado: demo@haymesa.com / demo1234')
}
