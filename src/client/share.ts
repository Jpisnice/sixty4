import { num } from '../game/format'
import { S } from '../game/strings'

export interface Card {
  target: number
  points: number
  exact: boolean
  distance: number
  tiles: number
  ops: string
  streak: number
}

const BG = '#08090a'
const CARD = '#26272a'
const FG = '#f7f8f8'
const MUTED = 'rgb(247 248 248 / 0.55)'
const LINE = 'rgb(247 248 248 / 0.12)'
const ACCENT = '#e39a3b'
const SERIF = "Fraunces, ui-serif, Cambria, 'Noto Serif', Georgia, serif"
const MONO = "'Fragment Mono', ui-monospace, Menlo, Consolas, monospace"
const SANS = 'ui-sans-serif, system-ui, sans-serif'

/**
 * The result as a 600×640 card in the page's colours: today's target, the
 * six tiles with the used ones in marigold (which ones is not shown), the
 * points and the link. Holds no part of the answer.
 */
export function cardSvg(c: Card, host: string) {
  const tiles = []
  for (let i = 0; i < 6; i++) {
    const x = 182 + (i % 3) * 82
    const y = 300 + Math.floor(i / 3) * 68
    tiles.push(
      i < c.tiles
        ? `<rect x="${x}" y="${y}" width="72" height="58" rx="12" fill="${ACCENT}"/>`
        : `<rect x="${x + 0.5}" y="${y + 0.5}" width="71" height="57" rx="12" fill="${CARD}" stroke="${LINE}"/>`,
    )
  }
  const detail = [c.exact ? S.cardExact : S.away(c.distance), S.cardTiles(c.tiles), c.ops]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="640" viewBox="0 0 600 640">
<rect width="600" height="640" fill="${BG}"/>
<text x="48" y="84" font-family="${SERIF}" font-size="30" letter-spacing="-0.6" fill="${FG}">${S.title}</text>
${c.streak >= 2 ? `<text x="552" y="82" text-anchor="end" font-family="${MONO}" font-size="13" letter-spacing="2" fill="${ACCENT}">${S.streak(c.streak).toUpperCase()}</text>` : ''}
<g text-anchor="middle">
<text x="300" y="164" font-family="${MONO}" font-size="13" letter-spacing="2.4" fill="${MUTED}">${S.target.toUpperCase()}</text>
<text x="300" y="262" font-family="${SERIF}" font-size="112" letter-spacing="-2.8" fill="${FG}">${num(c.target)}</text>
${tiles.join('')}
<text x="300" y="496" font-family="${SERIF}" font-size="40" letter-spacing="-0.8" fill="${FG}">${S.points(c.points)}</text>
<text x="300" y="528" font-family="${SANS}" font-size="17" fill="${MUTED}">${detail.join('  ·  ')}</text>
</g>
<line x1="48" y1="568" x2="552" y2="568" stroke="${LINE}"/>
<text x="48" y="602" font-family="${MONO}" font-size="14" fill="${MUTED}">${host}</text>
<text x="552" y="602" text-anchor="end" font-family="${SANS}" font-size="16" font-weight="600" fill="${ACCENT}">${S.cardTry}</text>
</svg>`
}

/** The card as a PNG file at 2×, since chat apps don't show SVG. Null if the phone can't draw it. */
export async function cardFile(c: Card): Promise<File | null> {
  try {
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cardSvg(c, location.host))
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1280
    canvas.getContext('2d')!.drawImage(img, 0, 0, 1200, 1280)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    return blob && new File([blob], 'sixty4.png', { type: 'image/png' })
  } catch {
    return null
  }
}

/** Shares the card with a line and the link, or copies the line and link when the phone can't share. */
export async function shareCard(text: string, card: File | null): Promise<'shared' | 'copied' | 'failed'> {
  // The link goes in the text: apps that take a file often drop the `url` field.
  text = `${text}\n${location.origin}/`
  if (typeof navigator.share === 'function') {
    const files =
      card && typeof navigator.canShare === 'function' && navigator.canShare({ files: [card] })
        ? [card]
        : undefined
    try {
      await navigator.share(files ? { text, files } : { text })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
