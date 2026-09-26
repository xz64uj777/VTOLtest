import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative assets work on GitHub Pages and inside an Android WebView/Capacitor shell.
  base: './',
  plugins: [react()],
  server: {
    port: 8091,
    host: true,
    strictPort: false,
  },
})
