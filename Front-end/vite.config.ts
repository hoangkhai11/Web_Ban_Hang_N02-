import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** Chống XSS: thêm Content-Security-Policy vào index.html của bản build. */
function contentSecurityPolicy(apiUrl?: string): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' https: data:",
    `connect-src 'self'${apiUrl ? ' ' + new URL(apiUrl).origin : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL)],
  server: {
    port: 5173,
    // Chuyển tiếp /api sang NestJS (Back-end) khi chạy dev → không cần cấu hình CORS
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}))
