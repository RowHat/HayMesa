import { io } from 'socket.io-client'

// Misma dirección que la página (en desarrollo Vite lo redirige al server)
export const socket = io()
