import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// GitHub Pages has no SPA rewrite, so a direct load / refresh of a client route
// (e.g. /readiness-proto/agent-view) would 404. Serving a copy of index.html as
// 404.html makes Pages hand every unknown path to the SPA, which then routes it.
// Assets resolve fine because the build `base` is absolute.
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const out = resolve(__dirname, 'dist')
      const index = resolve(out, 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve(out, '404.html'))
    },
  }
}

// https://vite.dev/config/
// On `build` we serve from the GitHub Pages project subpath; dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/readiness-proto/' : '/',
  plugins: [react(), spaFallback()],
}))
