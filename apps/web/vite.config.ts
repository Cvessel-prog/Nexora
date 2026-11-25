import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react'
          if (id.includes('/node_modules/@phosphor-icons/')) return 'icons'
        },
      },
    },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8765' } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true, include: ['src/**/*.test.ts?(x)'] },
})
