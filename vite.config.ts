import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'service-worker.js',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: "JEE Scheduler Pro",
        short_name: "JEE Scheduler",
        description: "An AI-powered, multilingual weekly scheduler for JEE aspirants, featuring a clean, futuristic UI to optimize study sessions based on performance metrics.",
        theme_color: '#02040a',
        background_color: '#02040a',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'https://ponsrischool.in/wp-content/uploads/2025/11/Gemini_Generated_Image_ujvnj5ujvnj5ujvn.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})