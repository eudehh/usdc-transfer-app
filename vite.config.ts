import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is set for GitHub Pages (served under /usdc-transfer-app/) on build,
// but stays at "/" during local dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/usdc-transfer-app/' : '/',
  plugins: [react()],
}))
