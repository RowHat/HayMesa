import { Link } from 'react-router-dom'

// Vista pública: la lista y el mapa de locales llegan en el próximo paso
export default function Inicio() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-emerald-50 px-4">
      <h1 className="text-4xl font-bold text-emerald-700">HayMesa</h1>
      <p className="text-slate-600">Próximamente: locales con mesas libres cerca tuyo.</p>
      <Link to="/dueno" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
        Soy dueño de un local
      </Link>
    </main>
  )
}
