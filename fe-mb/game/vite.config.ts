/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 5184: 5173 belongs to another app on this machine and 5183 to the old
// phaser/ build. strictPort so a collision fails loudly instead of silently
// serving a different app to Playwright.
export default defineConfig({
  plugins: [react()],
  server: { port: 5184, strictPort: true },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
})
