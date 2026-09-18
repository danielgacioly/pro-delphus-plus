import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Porta da API para onde o dev server encaminha. Configurável porque, com mais
// de um worktree aberto ao mesmo tempo, a 4000 fica com a primeira API que
// subir e as outras precisam de porta própria (API_PORT=4010 npm run dev).
const apiTarget = `http://localhost:${process.env.API_PORT ?? 4000}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
