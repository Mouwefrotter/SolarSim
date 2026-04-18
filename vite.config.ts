import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PVGIS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 SolarSim/1.0'

/** PVGIS blocks browser CORS; proxy via dev/preview server so fetch() is same-origin. */
const pvgisProxy = {
  '/api/pvgis': {
    target: 'https://re.jrc.ec.europa.eu',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api\/pvgis/, '/api/v5_2'),
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        /** JRC often returns HTML error/WAF pages for non-browser or bare User-Agents. */
        proxyReq.setHeader('User-Agent', PVGIS_UA)
        proxyReq.setHeader('Accept', 'application/json, text/plain, */*')
        proxyReq.setHeader('Accept-Language', 'en-GB,en;q=0.9')
        proxyReq.setHeader('Referer', 'https://re.jrc.ec.europa.eu/pvg_tools/en/')
      })
    },
  },
} as const

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { ...pvgisProxy },
  },
  preview: {
    proxy: { ...pvgisProxy },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
