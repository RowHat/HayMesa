import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Inicio from './paginas/Inicio'
import Ingresar from './paginas/Ingresar'
import Panel from './paginas/Panel'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/dueno" element={<Ingresar />} />
        <Route path="/dueno/panel" element={<Panel />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
