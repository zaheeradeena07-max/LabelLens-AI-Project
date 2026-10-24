import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '')
  if (command === 'build' && mode === 'production' && !env.VITE_API_BASE_URL) {
    throw new Error('Set VITE_API_BASE_URL to the deployed Express API origin before building for production.')
  }
  return {
    plugins: [react()],
    ...(mode === 'development' ? {
      server: {
        proxy: {
          '/api': {
            target: env.VITE_API_PROXY_TARGET || 'http://localhost:5001',
            changeOrigin: true,
          },
        },
      },
    } : {}),
  }
})
