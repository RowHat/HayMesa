import 'dotenv/config'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { rutasAuth } from './rutas/auth.js'
import { rutasLocales } from './rutas/locales.js'

const app = express()
app.use(express.json())

const servidorHttp = createServer(app)
const io = new Server(servidorHttp, { cors: { origin: '*' } })

app.get('/api/salud', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', rutasAuth)
app.use('/api', rutasLocales)

io.on('connection', (socket) => {
  console.log('Socket conectado:', socket.id)
})

const puerto = Number(process.env.PORT) || 3001
servidorHttp.listen(puerto, () => {
  console.log(`Servidor HayMesa escuchando en http://localhost:${puerto}`)
})
