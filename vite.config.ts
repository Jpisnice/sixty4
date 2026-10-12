import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: { target: 'es2020', sourcemap: !!process.env.SOURCEMAP },
  plugins: [
    nitro(),
    tanstackStart({ server: { build: { inlineCss: true } } }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})

export default config
