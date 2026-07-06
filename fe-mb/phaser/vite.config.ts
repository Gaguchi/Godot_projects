import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5183, not the Vite default 5173: another local project often occupies
  // 5173, and Playwright's reuseExistingServer would silently test THAT app.
  server: { port: 5183, strictPort: true },
  build: { target: 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
});
