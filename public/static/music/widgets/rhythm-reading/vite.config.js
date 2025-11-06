import { defineConfig } from 'vite'

export default defineConfig({
    base: '/',
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: false, // Auto-find available port if 5173 is taken
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
})

