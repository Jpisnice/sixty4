import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { nitro } from 'nitro/vite'
import { serviceWorker } from './sw-plugin'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: { target: 'es2020', sourcemap: !!process.env.SOURCEMAP },
  plugins: [
    nitro({
      compressPublicAssets: { gzip: true, brotli: true },
      routeRules: {
        '/sw.js': { headers: { 'cache-control': 'no-cache' } },
        '/manifest.webmanifest': { headers: { 'cache-control': 'public, max-age=86400' } },
      },
    }),
    tanstackStart({ server: { build: { inlineCss: true } } }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    serviceWorker(),
  ],
})

export default config
