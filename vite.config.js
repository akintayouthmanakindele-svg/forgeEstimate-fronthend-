import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: true, // service worker off — it was failing to register; config kept so it can be re-enabled
      registerType: 'autoUpdate',
      manifest: {
        name: 'ForgeEstimate Ultra Pro',
        short_name: 'ForgeEstimate',
        description: 'AI-Powered Construction Blueprint Estimation',
        theme_color: '#10b981',
        background_color: '#091510',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/\/api\//, /\/.netlify\//]
      }
    })
  ],
  build: { outDir: 'dist', assetsDir: 'assets' }
})
