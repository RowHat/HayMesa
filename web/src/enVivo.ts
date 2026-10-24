import { useEffect, useState } from 'react'
import { pedir } from './api'
import { socket } from './socket'
import type { Local } from './tipos'

// Todos los locales, actualizados en vivo con "local_actualizado"
export function useLocales() {
  const [locales, setLocales] = useState<Local[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    function cargar() {
      pedir<Local[]>('/locales')
        .then((datos) => {
          setLocales(datos)
          setError('')
        })
        .catch((err) => setError(err.message))
        .finally(() => setCargando(false))
    }

    function alActualizar(local: Local) {
      setLocales((anteriores) =>
        anteriores.some((l) => l.id === local.id)
          ? anteriores.map((l) => (l.id === local.id ? local : l))
          : [...anteriores, local],
      )
    }

    cargar()
    socket.on('local_actualizado', alActualizar)
    socket.on('connect', cargar) // si se cortó la conexión, recargamos todo al volver
    return () => {
      socket.off('local_actualizado', alActualizar)
      socket.off('connect', cargar)
    }
  }, [])

  return { locales, cargando, error }
}

// Un local, actualizado en vivo
export function useLocal(id: number) {
  const [local, setLocal] = useState<Local | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    function cargar() {
      pedir<Local>(`/locales/${id}`)
        .then(setLocal)
        .catch((err) => setError(err.message))
    }

    function alActualizar(actualizado: Local) {
      if (actualizado.id === id) setLocal(actualizado)
    }

    cargar()
    socket.on('local_actualizado', alActualizar)
    socket.on('connect', cargar)
    return () => {
      socket.off('local_actualizado', alActualizar)
      socket.off('connect', cargar)
    }
  }, [id])

  return { local, error }
}

export function useConectado() {
  const [conectado, setConectado] = useState(socket.connected)
  useEffect(() => {
    const alConectar = () => setConectado(true)
    const alDesconectar = () => setConectado(false)
    socket.on('connect', alConectar)
    socket.on('disconnect', alDesconectar)
    return () => {
      socket.off('connect', alConectar)
      socket.off('disconnect', alDesconectar)
    }
  }, [])
  return conectado
}
