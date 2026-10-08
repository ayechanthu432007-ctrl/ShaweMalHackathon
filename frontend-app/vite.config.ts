/// <reference types="vitest/config" />
import dns from 'node:dns'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Serve the dev server on IPv4 loopback so http://localhost:5173 (the origin the API's CORS allows) is reachable
// on machines where `localhost` resolves to ::1 first.
dns.setDefaultResultOrder('ipv4first')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
