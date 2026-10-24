import { useEffect, useState } from 'react'
import { pedir } from './api'
import { alActualizarLocal, alCambiarConexion } from './supabaseNavegador'
import type { Local } from './tipos'

const MS_ENTRE_RECARGAS = 20_000

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
    // Si se cortó la conexión, recargamos todo al volver. Y cada tanto también, para ver
    // cámaras que se apagaron o promos que vencieron (de eso no llega ningún aviso)
    const dejarDeEscuchar = alActualizarLocal(alActualizar)
    const dejarConexion = alCambiarConexion((ok) => ok && cargar())
    const intervalo = setInterval(cargar, MS_ENTRE_RECARGAS)
    return () => {
      dejarDeEscuchar()
      dejarConexion()
      clearInterval(intervalo)
    }
  }, [])

  return { locales, cargando, error }
}

// Un local (por slug o id), actualizado en vivo
export function useLocal(clave: string) {
  const [local, setLocal] = useState<Local | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    function cargar() {
      pedir<Local>(`/locales/${encodeURIComponent(clave)}`)
        .then(setLocal)
        .catch((err) => setError(err.message))
    }

    function alActualizar(actualizado: Local) {
      if (actualizado.slug === clave || String(actualizado.id) === clave) setLocal(actualizado)
    }

    cargar()
    const dejarDeEscuchar = alActualizarLocal(alActualizar)
    const dejarConexion = alCambiarConexion((ok) => ok && cargar())
    const intervalo = setInterval(cargar, MS_ENTRE_RECARGAS)
    return () => {
      dejarDeEscuchar()
      dejarConexion()
      clearInterval(intervalo)
    }
  }, [clave])

  return { local, error }
}

export function useConectado() {
  const [conectado, setConectado] = useState(false)
  useEffect(() => alCambiarConexion(setConectado), [])
  return conectado
}

// Hora actual que se actualiza sola (para las cuentas regresivas de las promos)
export function useAhora(cadaMs = 1000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(intervalo)
  }, [cadaMs])
  return ahora
}
