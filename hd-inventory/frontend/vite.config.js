import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // necesario para Docker
    port: 5173,
    allowedHosts: ['mxtjsf225', 'mxtjsf225.tpvaoc.com'],
    // Polling necesario para HMR en Docker sobre Windows/WSL
    // Sin esto, Vite no detecta cambios en archivos desde el contenedor
    watch: {
      usePolling: true,
      interval: 300,      // ms entre cada revisión de archivos
    },
    proxy: {
      // Redirige llamadas /api/** al backend Django
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      // Redirige /media/** al backend para servir imágenes de materiales
      '/media': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
