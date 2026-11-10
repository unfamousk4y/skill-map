import react from '@vitejs/plugin-react'
// vitest/config's defineConfig is Vite's, plus typing for the `test` section.
import { defineConfig } from 'vitest/config'
import { devApi } from './server/devApi.ts'

export default defineConfig({
  // devApi adds /api/extract to the local dev server only. See server/devApi.ts.
  plugins: [react(), devApi()],
  server: { port: 5183, strictPort: true },
})
