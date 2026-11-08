import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Kiểm thử giao diện: chạy trong jsdom, không cần Back-end (npm test)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
