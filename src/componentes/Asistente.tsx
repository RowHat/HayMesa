import { useEffect, useRef, useState, type FormEvent } from 'react'
import { pedir } from '../api'
import type { Ubicacion } from '../disponibilidad'

type Mensaje = { de: 'usuario' | 'asistente'; texto: string }
type RespuestaAsistente = { respuesta: string; localesIds: number[] }

const SALUDO: Mensaje = {
  de: 'asistente',
  texto: '¡Hola! Contame cuántos son y qué tienen ganas de comer, y te digo dónde hay lugar ahora.',
}

const SUGERENCIAS = ['Somos 4, queremos cenar ahora, ¿dónde hay lugar?', 'Somos 2, ¿algún café tranquilo cerca?']

type Props = { ubicacion: Ubicacion | null; alSugerir: (ids: number[]) => void }

export default function Asistente({ ubicacion, alSugerir }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([SALUDO])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, pensando, abierto])

  async function preguntar(pregunta: string) {
    if (!pregunta.trim() || pensando) return
    setMensajes((anteriores) => [...anteriores, { de: 'usuario', texto: pregunta }])
    setTexto('')
    setPensando(true)
    try {
      // La ubicación (si la compartiste) va solo en esta pregunta, para ordenar por cercanía
      const datos = await pedir<RespuestaAsistente>('/asistente', 'POST', { texto: pregunta, ...(ubicacion ?? {}) })
      setMensajes((anteriores) => [...anteriores, { de: 'asistente', texto: datos.respuesta }])
      alSugerir(datos.localesIds)
    } catch {
      setMensajes((anteriores) => [...anteriores, { de: 'asistente', texto: 'Uy, no pude responder. Probá de nuevo en un ratito.' }])
    } finally {
      setPensando(false)
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    preguntar(texto)
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="fixed right-4 bottom-4 z-[1100] flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-700"
      >
        💬 Preguntale a HayMesa
      </button>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1100] flex h-[75vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[34rem] sm:w-96 sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">Asistente HayMesa</p>
          <p className="text-xs text-slate-500">Responde con la disponibilidad en vivo</p>
        </div>
        <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.de === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.de === 'usuario' ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800'
              }`}
            >
              {m.texto}
            </p>
          </div>
        ))}

        {pensando && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-500">
              <span className="animate-pulse">Buscando mesas…</span>
            </p>
          </div>
        )}

        {mensajes.length === 1 && (
          <div className="flex flex-col items-start gap-2 pt-2">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => preguntar(s)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-left text-sm text-emerald-800 hover:bg-emerald-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí tu pregunta…"
          maxLength={500}
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pensando || !texto.trim()}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
