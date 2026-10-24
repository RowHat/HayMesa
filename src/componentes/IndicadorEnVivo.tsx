import { useConectado } from '../enVivo'

export default function IndicadorEnVivo() {
  const conectado = useConectado()
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className={`relative flex h-2.5 w-2.5`}>
        {conectado && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${conectado ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      </span>
      {conectado ? 'En vivo' : 'Reconectando…'}
    </span>
  )
}
