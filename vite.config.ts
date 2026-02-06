import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@dnd-kit')) return 'dnd-vendor'
          if (id.includes('@ant-design/cssinjs')) return 'cssinjs-vendor'
          if (id.includes('@ant-design/icons')) return 'icons-vendor'
          if (id.includes('lodash')) return 'lodash-vendor'
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
})
