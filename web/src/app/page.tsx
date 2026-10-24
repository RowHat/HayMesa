'use client'

import dynamic from 'next/dynamic'

// Mapa, cámara y detección usan APIs del navegador: esta página se arma solo en el cliente
const Inicio = dynamic(() => import('@/paginas/Inicio'), { ssr: false })

export default function Pagina() {
  return <Inicio />
}
