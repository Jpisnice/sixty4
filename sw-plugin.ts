import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { minifySync } from 'rolldown/utils'
import type { Plugin } from 'vite'

/**
 * Emits /sw.js from src/sw/sw.js with the hashed client assets to precache.
 * Minified to keep it within 2 KB.
 */
export function serviceWorker(): Plugin {
  return {
    name: 'make-the-number:sw',
    apply: 'build',
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        // CSS is inlined into the HTML, so only scripts are precached.
        .filter((f) => f.startsWith('assets/') && f.endsWith('.js'))
        .sort()
        .map((f) => `/${f}`)
      const version = createHash('sha1').update(assets.join()).digest('hex').slice(0, 8)
      const template = readFileSync(new URL('./src/sw/sw.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(assets))
      const { code } = minifySync('sw.js', template, { mangle: { toplevel: true } })
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code })
    },
  }
}
