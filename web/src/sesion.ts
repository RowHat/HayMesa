// Token del dueño guardado en el navegador
const CLAVE = 'haymesa_token'

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function guardarToken(token: string) {
  try {
    localStorage.setItem(CLAVE, token)
  } catch {
    // Sin localStorage la sesión dura solo mientras la página esté abierta
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // nada que borrar
  }
}
