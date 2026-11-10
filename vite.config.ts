import react from '@vitejs/plugin-react'
// vitest/config's defineConfig is Vite's, plus typing for the `test` section.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: { port: 5183, strictPort: true },
})
