import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { aiPlugin } from './server/aiPlugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), aiPlugin()],
  server: { port: 5180, strictPort: true },
})
