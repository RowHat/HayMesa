import type { Server } from 'socket.io'
import { leerToken } from './auth.js'
import { guardarEstado, obtenerLocal, type EstadoMesa } from './locales.js'

function esEstadoValido(e: any): e is EstadoMesa {
  return (
    e && Number.isInteger(e.mesaId) && typeof e.ocupada === 'boolean' && Number.isInteger(e.personas) && e.personas >= 0
  )
}

export function iniciarTiempoReal(io: Server) {
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
      const local = obtenerLocal(restauranteId)
      if (local) io.emit('local_actualizado', local)
    })
  })
}
