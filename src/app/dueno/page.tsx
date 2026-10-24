'use client'

import dynamic from 'next/dynamic'

// Mapa, cámara y detección usan APIs del navegador: esta página se arma solo en el cliente
const Ingresar = dynamic(() => import('@/paginas/Ingresar'), { ssr: false })

export default function Pagina() {
  return <Ingresar />
}
