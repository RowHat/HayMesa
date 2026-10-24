import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Dirección del server en desarrollo (se puede cambiar con la variable HAYMESA_SERVER)
const servidor = process.env.HAYMESA_SERVER ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo, las llamadas a /api y a Socket.IO van al server
    proxy: {
      '/api': servidor,
      '/socket.io': { target: servidor, ws: true },
    },
  },
})
