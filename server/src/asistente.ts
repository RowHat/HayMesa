import { GoogleGenAI, ThinkingLevel, type Content, type FunctionCall, type FunctionDeclaration } from '@google/genai'
import { listarLocales, obtenerLocal } from './locales.js'
import { predecir } from './prediccion.js'

const MAX_VUELTAS = 5

// Probamos en orden. Si uno falla o tarda demasiado (ej. 503 por alta demanda), pasamos al siguiente,
// y si fallan todos contestamos con la plantilla para que la demo no se trabe.
const MODELOS = [
  { nombre: 'gemini-3.8-flash', razonamiento: ThinkingLevel.LOW, tiempoMaximoMs: 10_000 },
  { nombre: 'gemini-3.6-flash', razonamiento: ThinkingLevel.MINIMAL, tiempoMaximoMs: 15_000 },
]
type Modelo = (typeof MODELOS)[number]

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export type Ubicacion = { lat: number; lng: number }
export type RespuestaAsistente = { respuesta: string; localesIds: number[] }

// Minúsculas y sin tildes, para comparar textos
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function distanciaMetros(a: Ubicacion, b: Ubicacion): number {
  const radianes = (g: number) => (g * Math.PI) / 180
  const dLat = radianes(b.lat - a.lat)
  const dLng = radianes(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radianes(a.lat)) * Math.cos(radianes(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

// ---------- Herramientas ----------

export function buscarLocales(personas: number, tipo: string | undefined, ubicacion: Ubicacion | null) {
  return listarLocales()
    .filter((l) => l.enVivo)
    .filter((l) => !tipo || normalizar(l.tipo).includes(normalizar(tipo)))
    .map((l) => ({
      id: l.id,
      nombre: l.nombre,
      tipo: l.tipo,
      direccion: l.direccion,
      mesasLibres: l.mesasLibres,
      mesasTotales: l.mesas.length,
      mesasLibresQueAlcanzan: l.mesas.filter((m) => !m.ocupada && m.capacidad >= personas).length,
      distanciaMetros: ubicacion ? Math.round(distanciaMetros(ubicacion, l)) : null,
    }))
    .filter((l) => l.mesasLibresQueAlcanzan > 0)
    .sort((a, b) => (a.distanciaMetros ?? 0) - (b.distanciaMetros ?? 0) || b.mesasLibresQueAlcanzan - a.mesasLibresQueAlcanzan)
}

function detalleLocal(id: number) {
  const local = obtenerLocal(id)
  if (!local) return null
  return {
    id: local.id,
    nombre: local.nombre,
    tipo: local.tipo,
    direccion: local.direccion,
    camaraEnVivo: local.enVivo,
    mesas: local.mesas.map((m) => ({ nombre: m.nombre, capacidad: m.capacidad, ocupada: m.ocupada })),
    prediccion: predecir(local.id),
  }
}

const HERRAMIENTAS: FunctionDeclaration[] = [
  {
    name: 'buscar_locales',
    description:
      'Busca locales con cámara en vivo que AHORA tienen al menos una mesa libre donde entra el grupo. Si vino la ubicación del usuario, vienen ordenados por distancia.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        personas: { type: 'integer', description: 'Cantidad de personas del grupo (1 a 20)' },
        tipo: { type: 'string', description: 'Opcional: tipo de local, por ejemplo Bar, Restaurante, Café, Parrilla, Pizzería o Cervecería' },
      },
      required: ['personas'],
    },
  },
  {
    name: 'detalle_local',
    description:
      'Devuelve las mesas de un local (capacidad y si están ocupadas) y la predicción de ocupación para las próximas horas según su historial.',
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'Id del local' } },
      required: ['id'],
    },
  },
]

// Ejecuta la herramienta que pidió Gemini y anota los locales que aparecieron
function ejecutar(llamada: FunctionCall, ubicacion: Ubicacion | null, vistos: Map<number, string>): unknown {
  const args = llamada.args ?? {}

  if (llamada.name === 'buscar_locales') {
    const personas = Math.min(20, Math.max(1, Math.round(Number(args.personas)) || 2))
    const tipo = typeof args.tipo === 'string' && args.tipo.trim() ? args.tipo : undefined
    const locales = buscarLocales(personas, tipo, ubicacion)
    for (const l of locales) vistos.set(l.id, l.nombre)
    return { personas, locales }
  }

  if (llamada.name === 'detalle_local') {
    const detalle = detalleLocal(Number(args.id))
    if (!detalle) return { error: 'No existe un local con ese id' }
    vistos.set(detalle.id, detalle.nombre)
    return detalle
  }

  return { error: `No existe la herramienta ${llamada.name}` }
}

// ---------- Gemini ----------

function promptDelSistema(ubicacion: Ubicacion | null) {
  const ahora = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  return `Sos el asistente de HayMesa, una app que muestra en tiempo real qué bares y restaurantes de Rosario tienen mesas libres. Lo detecta una cámara en cada local, sin guardar imágenes.
Ahora es ${ahora} en Rosario.

Reglas:
- Usá siempre las herramientas para responder sobre locales, mesas, horarios o disponibilidad. Nunca inventes locales ni disponibilidad: si las herramientas no lo devuelven, no existe.
- Si el usuario no dice cuántos son, asumí 2 y aclaralo.
- Si no hay lugar, decilo. Si la predicción de detalle_local dice a qué hora suele liberarse, contalo.
- Respondé corto (máximo 3 oraciones), en español rioplatense, con voseo y tono amable. Texto plano, sin markdown ni asteriscos.
- Nombrá los locales con su nombre exacto. Si tenés la distancia, mencionala.
- ${ubicacion ? 'El usuario compartió su ubicación: buscar_locales devuelve la distancia en metros.' : 'El usuario no compartió su ubicación, así que no sabés qué tan cerca está.'}`
}

async function responderConGemini(texto: string, ubicacion: Ubicacion | null, modelo: Modelo, senal: AbortSignal): Promise<RespuestaAsistente> {
  const contenidos: Content[] = [{ role: 'user', parts: [{ text: texto }] }]
  const vistos = new Map<number, string>()

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await ai.models.generateContent({
      model: modelo.nombre,
      contents: contenidos,
      config: {
        systemInstruction: promptDelSistema(ubicacion),
        tools: [{ functionDeclarations: HERRAMIENTAS }],
        thinkingConfig: { thinkingLevel: modelo.razonamiento },
        abortSignal: senal,
      },
    })

    const llamadas = respuesta.functionCalls ?? []
    if (llamadas.length === 0) {
      const textoFinal = respuesta.text?.replace(/\*\*/g, '').trim()
      if (!textoFinal) throw new Error('Gemini respondió vacío')
      // Solo resaltamos los locales que la respuesta nombra
      const mencionados = [...vistos].filter(([, nombre]) => normalizar(textoFinal).includes(normalizar(nombre)))
      return { respuesta: textoFinal, localesIds: mencionados.map(([id]) => id) }
    }

    // Devolvemos el turno del modelo tal cual (incluye las firmas de razonamiento que pide Gemini 3)
    contenidos.push(respuesta.candidates![0].content!)
    contenidos.push({
      role: 'user',
      parts: llamadas.map((llamada) => ({
        functionResponse: { id: llamada.id, name: llamada.name, response: { resultado: ejecutar(llamada, ubicacion, vistos) } },
      })),
    })
  }

  throw new Error(`Gemini no terminó en ${MAX_VUELTAS} vueltas`)
}

// ---------- Plan B sin IA ----------

const NUMEROS: Record<string, number> = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }

function personasDelTexto(texto: string): number {
  const normal = normalizar(texto)
  const digitos = normal.match(/\b(\d{1,2})\b/)
  if (digitos) return Math.min(20, Math.max(1, Number(digitos[1])))
  for (const [palabra, numero] of Object.entries(NUMEROS)) {
    if (new RegExp(`\\b${palabra}\\b`).test(normal)) return numero
  }
  return 2
}

function responderConPlantilla(texto: string, ubicacion: Ubicacion | null): RespuestaAsistente {
  const personas = personasDelTexto(texto)
  const locales = buscarLocales(personas, undefined, ubicacion).slice(0, 3)
  if (locales.length === 0) {
    return { respuesta: `Ahora no encontré mesas libres para ${personas}. La lista se actualiza en vivo, fijate en un ratito.`, localesIds: [] }
  }
  const nombres = locales.map((l) => (l.distanciaMetros !== null ? `${l.nombre} (a ${l.distanciaMetros} m)` : l.nombre))
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
  return { respuesta: `Para ${personas} hay lugar ahora en ${lista}.`, localesIds: locales.map((l) => l.id) }
}

export async function responderAsistente(texto: string, ubicacion: Ubicacion | null): Promise<RespuestaAsistente> {
  for (const modelo of MODELOS) {
    const controlador = new AbortController()
    const temporizador = setTimeout(() => controlador.abort(), modelo.tiempoMaximoMs)
    try {
      return await responderConGemini(texto, ubicacion, modelo, controlador.signal)
    } catch (err) {
      console.warn(`Asistente: falló ${modelo.nombre} →`, (err as Error).message.slice(0, 120))
    } finally {
      clearTimeout(temporizador)
    }
  }
  console.warn('Asistente: fallaron todos los modelos, uso la plantilla')
  return responderConPlantilla(texto, ubicacion)
}
