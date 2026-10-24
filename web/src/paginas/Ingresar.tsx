import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { pedir } from '../api'
import { guardarToken } from '../sesion'
import type { Local } from '../tipos'

type RespuestaSesion = { token: string; local: Local }

const TIPOS = ['Restaurante', 'Bar', 'Café', 'Parrilla', 'Pizzería', 'Cervecería']

const claseInput = 'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none'

export default function Ingresar() {
  const navegar = useNavigate()
  const [modo, setModo] = useState<'login' | 'registro'>('login')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(TIPOS[0])
  const [direccion, setDireccion] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  function usarMiUbicacion() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
      },
      () => setError('No pudimos obtener tu ubicación, cargala a mano'),
    )
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const respuesta =
        modo === 'login'
          ? await pedir<RespuestaSesion>('/login', 'POST', { email, password })
          : await pedir<RespuestaSesion>('/registro', 'POST', {
              nombre,
              tipo,
              direccion,
              lat: Number(lat),
              lng: Number(lng),
              email,
              password,
            })
      guardarToken(respuesta.token)
      navegar('/dueno/panel')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <Link to="/" className="text-sm text-emerald-700">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">Panel del local</h1>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
          {(['login', 'registro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-md py-2 ${modo === m ? 'bg-white font-semibold shadow' : 'text-slate-600'}`}
            >
              {m === 'login' ? 'Ingresar' : 'Registrar local'}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} className="mt-4 space-y-3">
          {modo === 'registro' && (
            <>
              <input className={claseInput} placeholder="Nombre del local" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              <select className={claseInput} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input className={claseInput} placeholder="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} required />
              <div className="flex gap-2">
                <input className={claseInput} placeholder="Latitud" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
                <input className={claseInput} placeholder="Longitud" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required />
              </div>
              <button type="button" onClick={usarMiUbicacion} className="text-sm text-emerald-700 underline">
                Usar mi ubicación actual
              </button>
            </>
          )}

          <input className={claseInput} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={claseInput} placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {enviando ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear local'}
          </button>
        </form>
      </div>
    </main>
  )
}
