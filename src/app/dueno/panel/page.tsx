'use client'

import dynamic from 'next/dynamic'

// Mapa, cámara y detección usan APIs del navegador: esta página se arma solo en el cliente
const Panel = dynamic(() => import('@/paginas/Panel'), { ssr: false })

export default function Pagina() {
  return <Panel />
}
