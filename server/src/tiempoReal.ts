import type { Server } from 'socket.io'
import { leerToken } from './auth.js'
import { guardarEstado, obtenerLocal, type EstadoMesa } from './locales.js'

let io: Server | null = null

// Manda a todos los clientes el estado actual de un local
export function avisarLocalActualizado(restauranteId: number) {
  const local = obtenerLocal(restauranteId)
  if (local && io) io.emit('local_actualizado', local)
}

function esEstadoValido(e: any): e is EstadoMesa {
  return (
    e && Number.isInteger(e.mesaId) && typeof e.ocupada === 'boolean' && Number.isInteger(e.personas) && e.personas >= 0
  )
}

export function iniciarTiempoReal(servidorIo: Server) {
  io = servidorIo

  io.on('connection', (socket) => {
    // La cámara del local manda { token, mesas: [{ mesaId, ocupada, personas }] }
    socket.on('estado', (datos) => {
      const restauranteId = leerToken(datos?.token ?? '')
      if (restauranteId === null) {
        socket.emit('error_estado', { error: 'Token inválido, volvé a iniciar sesión' })
        return
      }
      if (!Array.isArray(datos.mesas) || !datos.mesas.every(esEstadoValido)) {
        socket.emit('error_estado', { error: 'Formato de mesas inválido' })
        return
      }

      guardarEstado(restauranteId, datos.mesas)
      avisarLocalActualizado(restauranteId)
    })
  })
}
