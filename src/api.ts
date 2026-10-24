import { leerToken } from './sesion'

export class ErrorApi extends Error {
  estado: number
  constructor(mensaje: string, estado: number) {
    super(mensaje)
    this.estado = estado
  }
}

// Llama al server en /api (en desarrollo Vite lo redirige al puerto 3001)
export async function pedir<T>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const token = leerToken()
  const respuesta = await fetch('/api' + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) throw new ErrorApi(datos.error ?? 'Error del servidor', respuesta.status)
  return datos as T
}
