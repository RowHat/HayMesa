import type { ObjectDetection } from '@tensorflow-models/coco-ssd'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorApi, pedir } from '../api'
import PromoDueno from '../componentes/PromoDueno'
import { contarPersonasPorMesa, type Caja } from '../deteccion'
import { borrarToken, leerToken } from '../sesion'
import { alActualizarLocal, alCambiarConexion } from '../supabaseNavegador'
import type { Local, Zona } from '../tipos'

// Mesa mientras el dueño la edita. "id" existe solo si ya está guardada en el server.
type MesaBorrador = { clave: number; id?: number; nombre: string; capacidad: number; zona: Zona }
type EstadoDetectado = { ocupada: boolean; personas: number }
type Punto = { x: number; y: number }

const MS_ENTRE_DETECCIONES = 700
const MS_ENTRE_ENVIOS = 2000
// Una mesa cambia de estado solo si la mayoría de las últimas lecturas coinciden
const LECTURAS_PARA_SUAVIZAR = 3
const CONFIANZA_MINIMA = 0.5

let siguienteClave = 1

function aBorrador(local: Local): MesaBorrador[] {
  return local.mesas.map((m) => ({ clave: siguienteClave++, id: m.id, nombre: m.nombre, capacidad: m.capacidad, zona: m.zona }))
}

function zonaDesdePuntos(a: Punto, b: Punto): Zona {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), ancho: Math.abs(a.x - b.x), alto: Math.abs(a.y - b.y) }
}

function mesasGuardadas(mesas: MesaBorrador[]) {
  return mesas.filter((m): m is MesaBorrador & { id: number } => m.id !== undefined)
}

// Manda al server solo el estado de cada mesa, nunca la imagen
function enviarEstado(estados: Map<number, EstadoDetectado>) {
  const mesasEstado = [...estados].map(([mesaId, e]) => ({ mesaId, ocupada: e.ocupada, personas: e.personas }))
  if (leerToken() && mesasEstado.length > 0) {
    pedir('/mi-local/estado', 'POST', { mesas: mesasEstado }).catch((err: Error) => console.warn('Estado:', err.message))
  }
}

function entre0y1(n: number) {
  return Math.min(1, Math.max(0, n))
}

function Indicador({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span className={`rounded-full px-2 py-1 ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
      {ok ? '●' : '○'} {texto}
    </span>
  )
}

export default function Panel() {
  const { push: navegar } = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [local, setLocal] = useState<Local | null>(null)
  const [mesas, setMesas] = useState<MesaBorrador[]>([])
  const [hayCambios, setHayCambios] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [camaraLista, setCamaraLista] = useState(false)
  const [modelo, setModelo] = useState<ObjectDetection | null>(null)
  const [estados, setEstados] = useState(new Map<number, EstadoDetectado>())
  const [personasEnImagen, setPersonasEnImagen] = useState(0)
  const [conectado, setConectado] = useState(false)
  const [error, setError] = useState('')

  // Los loops de detección y dibujo leen estos refs para tener siempre el valor actual
  const mesasRef = useRef<MesaBorrador[]>([])
  const personasRef = useRef<Caja[]>([])
  const estadosRef = useRef(new Map<number, EstadoDetectado>())
  const dibujoRef = useRef<{ inicio: Punto; actual: Punto } | null>(null)

  useEffect(() => {
    mesasRef.current = mesas
  }, [mesas])

  function salir() {
    borrarToken()
    navegar('/dueno')
  }

  // Datos del local
  useEffect(() => {
    if (!leerToken()) {
      navegar('/dueno')
      return
    }
    pedir<Local | null>('/mi-local')
      .then((l) => {
        if (!l) throw new ErrorApi('El local ya no existe', 401)
        setLocal(l)
        setMesas(aBorrador(l))
      })
      .catch((err) => {
        if (err instanceof ErrorApi && err.estado === 401) {
          borrarToken()
          navegar('/dueno')
        } else {
          setError(err.message)
        }
      })
  }, [navegar])

  // Cámara
  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelado = false

    async function prender() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara acá. Abrí la página con HTTPS o desde localhost.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelado) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setCamaraLista(true)
      } catch {
        if (!cancelado) setError('No pudimos acceder a la cámara. Revisá los permisos del navegador.')
      }
    }

    prender()
    return () => {
      cancelado = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Modelo COCO-SSD (se carga solo en esta página para no hacer pesada la vista pública)
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const tf = await import('@tensorflow/tfjs')
        await tf.ready()
        const cocoSsd = await import('@tensorflow-models/coco-ssd')
        const cargado = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
        if (!cancelado) setModelo(cargado)
      } catch {
        if (!cancelado) setError('No se pudo cargar el modelo de detección. ¿Hay conexión a internet?')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  // Loop de detección: personas → mesas ocupadas
  useEffect(() => {
    if (!modelo || !camaraLista) return
    let activo = true
    const lecturas = new Map<number, boolean[]>()

    async function ciclo() {
      const video = videoRef.current
      if (!activo || !video || !modelo) return

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const predicciones = await modelo.detect(video)
        const ancho = video.videoWidth
        const alto = video.videoHeight
        const personas = predicciones
          .filter((p) => p.class === 'person' && p.score >= CONFIANZA_MINIMA)
          .map((p) => ({ x: p.bbox[0] / ancho, y: p.bbox[1] / alto, ancho: p.bbox[2] / ancho, alto: p.bbox[3] / alto }))

        const conteo = contarPersonasPorMesa(personas, mesasGuardadas(mesasRef.current))

        const nuevos = new Map<number, EstadoDetectado>()
        for (const [id, personasEnMesa] of conteo) {
          const historia = [...(lecturas.get(id) ?? []), personasEnMesa > 0].slice(-LECTURAS_PARA_SUAVIZAR)
          lecturas.set(id, historia)
          const votosOcupada = historia.filter(Boolean).length
          nuevos.set(id, { ocupada: votosOcupada * 2 > historia.length, personas: personasEnMesa })
        }

        personasRef.current = personas
        estadosRef.current = nuevos
        setEstados(nuevos)
        setPersonasEnImagen(personas.length)
      }

      if (activo) setTimeout(ciclo, MS_ENTRE_DETECCIONES)
    }

    ciclo()
    return () => {
      activo = false
    }
  }, [modelo, camaraLista])

  // Envío periódico al server
  useEffect(() => {
    const intervalo = setInterval(() => enviarEstado(estadosRef.current), MS_ENTRE_ENVIOS)
    return () => clearInterval(intervalo)
  }, [])

  // El local también se actualiza en vivo (mesas libres, promo que vence o se agota)
  useEffect(() => {
    const alActualizar = (actualizado: Local) => setLocal((actual) => (actual && actual.id === actualizado.id ? actualizado : actual))
    return alActualizarLocal(alActualizar)
  }, [])

  // Conexión con el server
  useEffect(() => {
    return alCambiarConexion(setConectado)
  }, [])

  // Dibujo de zonas y personas sobre la imagen
  useEffect(() => {
    let cuadro = 0

    function dibujar() {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (canvas && video && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        const ctx = canvas.getContext('2d')!
        const W = canvas.width
        const H = canvas.height
        const tamanioLetra = Math.max(14, W / 50)
        ctx.clearRect(0, 0, W, H)
        ctx.lineWidth = Math.max(2, W / 400)
        ctx.font = `bold ${tamanioLetra}px sans-serif`

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)'
        ctx.setLineDash([8, 6])
        for (const p of personasRef.current) ctx.strokeRect(p.x * W, p.y * H, p.ancho * W, p.alto * H)
        ctx.setLineDash([])

        for (const mesa of mesasRef.current) {
          const estado = mesa.id !== undefined ? estadosRef.current.get(mesa.id) : undefined
          const color = !estado ? '#94a3b8' : estado.ocupada ? '#ef4444' : '#22c55e'
          const x = mesa.zona.x * W
          const y = mesa.zona.y * H
          ctx.fillStyle = color + '33'
          ctx.fillRect(x, y, mesa.zona.ancho * W, mesa.zona.alto * H)
          ctx.strokeStyle = color
          ctx.strokeRect(x, y, mesa.zona.ancho * W, mesa.zona.alto * H)

          const texto = `${mesa.nombre} (${mesa.capacidad})`
          ctx.fillStyle = color
          ctx.fillRect(x, y, ctx.measureText(texto).width + 12, tamanioLetra + 10)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(texto, x + 6, y + tamanioLetra + 2)
        }

        const dibujo = dibujoRef.current
        if (dibujo) {
          const z = zonaDesdePuntos(dibujo.inicio, dibujo.actual)
          ctx.strokeStyle = '#ffffff'
          ctx.setLineDash([10, 6])
          ctx.strokeRect(z.x * W, z.y * H, z.ancho * W, z.alto * H)
          ctx.setLineDash([])
        }
      }
      cuadro = requestAnimationFrame(dibujar)
    }

    cuadro = requestAnimationFrame(dibujar)
    return () => cancelAnimationFrame(cuadro)
  }, [])

  // Marcar mesas arrastrando sobre la imagen (mouse o dedo)
  function puntoEnImagen(e: PointerEvent<HTMLCanvasElement>): Punto {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: entre0y1((e.clientX - r.left) / r.width), y: entre0y1((e.clientY - r.top) / r.height) }
  }

  function empezarDibujo(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = puntoEnImagen(e)
    dibujoRef.current = { inicio: p, actual: p }
  }

  function moverDibujo(e: PointerEvent<HTMLCanvasElement>) {
    if (dibujoRef.current) dibujoRef.current.actual = puntoEnImagen(e)
  }

  function terminarDibujo() {
    const dibujo = dibujoRef.current
    dibujoRef.current = null
    if (!dibujo) return
    const zona = zonaDesdePuntos(dibujo.inicio, dibujo.actual)
    if (zona.ancho < 0.03 || zona.alto < 0.03) return // fue un clic, no un arrastre
    setMesas((anteriores) => [
      ...anteriores,
      { clave: siguienteClave++, nombre: `Mesa ${anteriores.length + 1}`, capacidad: 4, zona },
    ])
    setHayCambios(true)
  }

  function cambiarMesa(clave: number, cambios: Partial<MesaBorrador>) {
    setMesas((anteriores) => anteriores.map((m) => (m.clave === clave ? { ...m, ...cambios } : m)))
    setHayCambios(true)
  }

  function borrarMesa(clave: number) {
    setMesas((anteriores) => anteriores.filter((m) => m.clave !== clave))
    setHayCambios(true)
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const actualizado = await pedir<Local>('/mi-local/mesas', 'PUT', {
        mesas: mesas.map(({ id, nombre, capacidad, zona }) => ({ id, nombre, capacidad, zona })),
      })
      const nuevas = aBorrador(actualizado)
      mesasRef.current = nuevas // para que el loop de detección use ya las mesas nuevas
      setLocal(actualizado)
      setMesas(nuevas)
      setHayCambios(false)

      // Estado de las mesas nuevas ya mismo, con las personas de la última lectura (sin esperar
      // al próximo ciclo). Las que ya existían mantienen su estado suavizado.
      const conteo = contarPersonasPorMesa(personasRef.current, mesasGuardadas(nuevas))
      const nuevos = new Map<number, EstadoDetectado>()
      for (const [id, personas] of conteo) {
        nuevos.set(id, estadosRef.current.get(id) ?? { ocupada: personas > 0, personas })
      }
      estadosRef.current = nuevos
      setEstados(nuevos)
      if (modelo && camaraLista) enviarEstado(nuevos)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">{local?.nombre ?? 'Cargando…'}</h1>
          <p className="text-xs text-slate-400">{local?.direccion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Indicador ok={camaraLista} texto="Cámara" />
          <Indicador ok={modelo !== null} texto={modelo ? 'Detección activa' : 'Cargando modelo…'} />
          <Indicador ok={conectado} texto={conectado ? 'Conectado' : 'Sin conexión'} />
          <button onClick={salir} className="rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800">
            Salir
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 flex items-start justify-between gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} muted playsInline className="block w-full" />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
              onPointerDown={empezarDibujo}
              onPointerMove={moverDibujo}
              onPointerUp={terminarDibujo}
              onPointerCancel={terminarDibujo}
            />
          </div>
          <p className="mt-2 text-sm text-slate-300">Personas detectadas en la imagen: {personasEnImagen}</p>
          <p className="mt-1 text-xs text-slate-400">
            🔒 La imagen se procesa en este dispositivo y nunca sale de acá. Al servidor solo llega si cada mesa está libre u
            ocupada.
          </p>
        </section>

        <aside className="space-y-3">
          <div>
            <h2 className="font-semibold">Mesas</h2>
            <p className="text-xs text-slate-400">
              Arrastrá sobre la imagen para marcar cada mesa. Incluí las sillas: así detectamos a quien está sentado.
            </p>
          </div>

          {mesas.length === 0 && <p className="text-sm text-slate-400">Todavía no marcaste mesas.</p>}

          <ul className="space-y-2">
            {mesas.map((m) => {
              const estado = m.id !== undefined ? estados.get(m.id) : undefined
              return (
                <li key={m.clave} className="rounded-lg bg-slate-800 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={m.nombre}
                      onChange={(e) => cambiarMesa(m.clave, { nombre: e.target.value })}
                      className="min-w-0 flex-1 rounded bg-slate-700 px-2 py-1 text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-300" title="Capacidad">
                      👥
                      <input
                        type="number"
                        min={1}
                        value={m.capacidad}
                        onChange={(e) => cambiarMesa(m.clave, { capacidad: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
                        className="w-14 rounded bg-slate-700 px-2 py-1 text-sm"
                      />
                    </label>
                    <button onClick={() => borrarMesa(m.clave)} aria-label="Borrar mesa" className="px-1 text-slate-400 hover:text-red-400">
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs">
                    {m.id === undefined ? (
                      <span className="text-slate-400">Sin guardar</span>
                    ) : !estado ? (
                      <span className="text-slate-400">Esperando detección…</span>
                    ) : estado.ocupada ? (
                      <span className="text-red-400">Ocupada · {estado.personas} persona(s)</span>
                    ) : (
                      <span className="text-emerald-400">Libre</span>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>

          <button
            onClick={guardar}
            disabled={!hayCambios || guardando}
            className="w-full rounded-lg bg-emerald-600 py-2 font-semibold hover:bg-emerald-700 disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : hayCambios ? 'Guardar mesas' : 'Mesas guardadas'}
          </button>
          {local && local.mesas.length > 0 && (
            <p className="text-xs text-emerald-300">Enviando el estado en vivo cada 2 segundos.</p>
          )}

          {local && <PromoDueno local={local} alCambiar={setLocal} alError={setError} />}
        </aside>
      </div>
    </main>
  )
}
