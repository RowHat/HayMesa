// Mismas formas que devuelve el server

// Zona de la mesa sobre la imagen, en proporciones de 0 a 1
export type Zona = { x: number; y: number; ancho: number; alto: number }

export type Mesa = {
  id: number
  nombre: string
  capacidad: number
  zona: Zona
  ocupada: boolean
  personas: number
}

export type Local = {
  id: number
  nombre: string
  tipo: string
  direccion: string
  lat: number
  lng: number
  enVivo: boolean
  mesasTotales: number
  mesasLibres: number
  mesasOcupadas: number
  mesas: Mesa[]
  promo: Promo | null
}

// Promo de último momento ("venceEn" en ISO; "mesasConPromo" = cupo que queda)
export type Promo = { descripcion: string; venceEn: string; mesasConPromo: number }

// Un punto por minuto mientras la cámara del local estuvo en vivo ("minuto" en UTC)
export type PuntoHistorial = { minuto: string; ocupadas: number; total: number }

export type Prediccion =
  | { suficientesDatos: false; diasConDatos: number }
  | {
      suficientesDatos: true
      diasConDatos: number
      // ocupación de 0 a 1, o null si no hay datos de esa hora
      proximasHoras: { hora: string; ocupacion: number | null }[]
      seLiberaA: string | null
    }
