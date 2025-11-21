import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

function serveExternalPublicStatic() {
  return {
    name: 'serve-external-public-static',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/static/')) return next()
        const urlNoQuery = req.url.split('?')[0]
        const relative = urlNoQuery.replace(/^\/+/, '')
        const candidate = path.normalize(path.join(here, '..', 'public', relative))
        const publicRoot = path.normalize(path.join(here, '..', 'public'))
        if (!candidate.startsWith(publicRoot)) return next()
        fs.stat(candidate, (err, stat) => {
          if (err || !stat.isFile()) return next()
          let contentType = 'application/octet-stream'
          if (candidate.endsWith('.html')) contentType = 'text/html; charset=utf-8'
          else if (candidate.endsWith('.js')) contentType = 'text/javascript; charset=utf-8'
          else if (candidate.endsWith('.mjs')) contentType = 'text/javascript; charset=utf-8'
          else if (candidate.endsWith('.css')) contentType = 'text/css; charset=utf-8'
          else if (candidate.endsWith('.svg')) contentType = 'image/svg+xml'
          else if (candidate.endsWith('.png')) contentType = 'image/png'
          else if (candidate.endsWith('.jpg') || candidate.endsWith('.jpeg')) contentType = 'image/jpeg'
          else if (candidate.endsWith('.gif')) contentType = 'image/gif'
          else if (candidate.endsWith('.webp')) contentType = 'image/webp'
          else if (candidate.endsWith('.woff')) contentType = 'font/woff'
          else if (candidate.endsWith('.woff2')) contentType = 'font/woff2'
          else if (candidate.endsWith('.ttf')) contentType = 'font/ttf'
          else if (candidate.endsWith('.eot')) contentType = 'application/vnd.ms-fontobject'
          else if (candidate.endsWith('.otf')) contentType = 'font/otf'
          res.setHeader('Content-Type', contentType)
          fs.createReadStream(candidate).pipe(res)
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), serveExternalPublicStatic()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    hmr: { host: '127.0.0.1', port: 5180 }
  },
  resolve: {
    dedupe: ['three']
  },
  optimizeDeps: {
    include: ['three', 'three/webgpu', 'three/tsl', 'globe.gl', 'three-globe', 'three-render-objects']
  },
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
})
