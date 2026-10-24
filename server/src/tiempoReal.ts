import type { Server } from 'socket.io'
import { leerToken } from './auth.js'
import { guardarEstado, listarLocales, obtenerLocal, type EstadoMesa } from './locales.js'
import { vencerPromos } from './promos.js'

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

  // Si una cámara deja de mandar datos o vence una promo no llega ningún evento, así que revisamos
  // cada tanto qué cambió y avisamos
  const estabaEnVivo = new Map<number, boolean>()
  setInterval(() => {
    for (const id of vencerPromos()) avisarLocalActualizado(id)

    for (const local of listarLocales()) {
      const antes = estabaEnVivo.get(local.id)
      estabaEnVivo.set(local.id, local.enVivo)
      if (antes !== undefined && antes !== local.enVivo) io?.emit('local_actualizado', local)
    }
  }, 10_000)
}
