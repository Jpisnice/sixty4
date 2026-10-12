// The game rules, shared by the page and the server. Pure code, no imports.
//
// Every tile is an expression. A merged tile keeps its operation group already
// flattened: runs of + and − become plus and minus terms, runs of × and ÷
// become top and bottom factors. That makes the wasted check, the standard
// form and the score cheap to work out one step at a time.

export type Op = '+' | '-' | '*' | '/'

/** One merge: slot `a` op slot `b` makes a new slot at the end. */
export interface Step {
  a: number
  op: Op
  b: number
}

export type Waste = 'one' | 'add' | 'mul'

export interface Expr {
  /** Value of the tile. */
  v: number
  /** Group kind: 'a' for + and −, 'm' for × and ÷, '' for an original tile. */
  k: '' | 'a' | 'm'
  /** Plus terms or top factors (empty for an original tile). */
  p: Array<Expr>
  /** Minus terms or bottom factors. */
  n: Array<Expr>
  /** Standard form, used to tell answers apart. */
  c: string
  /** Number of original tiles used. */
  t: number
  /** Kinds of operation used, as bits: + 1, − 2, × 4, ÷ 8. */
  o: number
  /** Why the expression is wasted, or '' if it is not. */
  w: Waste | ''
}

export const OPS: ReadonlyArray<Op> = ['+', '-', '*', '/']
export const OP_SIGN: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

export function leaf(v: number): Expr {
  return { v, k: '', p: [], n: [], c: String(v), t: 1, o: 0, w: '' }
}

/** The result of `x op y`, or 0 when it is not a positive whole number. */
export function calc(x: number, op: Op, y: number): number {
  switch (op) {
    case '+':
      return x + y
    case '-':
      return x > y ? x - y : 0
    case '*':
      return x * y
    case '/':
      return x % y === 0 ? x / y : 0
  }
}

/** Merges two tiles. Returns null when the result is not a positive whole number. */
export function combine(x: Expr, op: Op, y: Expr): Expr | null {
  const v = calc(x.v, op, y.v)
  if (!v) return null
  const k = op === '+' || op === '-' ? 'a' : 'm'
  const flip = op === '-' || op === '/'
  const p = x.k === k ? x.p.slice() : [x]
  const n = x.k === k ? x.n.slice() : []
  if (y.k === k) {
    p.push(...(flip ? y.n : y.p))
    n.push(...(flip ? y.p : y.n))
  } else {
    ;(flip ? n : p).push(y)
  }

  let t = 0
  let o = 0
  let w: Waste | '' = ''
  for (const e of p) (t += e.t), (o |= e.o), (w ||= e.w)
  for (const e of n) (t += e.t), (o |= e.o), (w ||= e.w)
  if (p.length > 1) o |= k === 'a' ? 1 : 4
  if (n.length) o |= k === 'a' ? 2 : 8
  w ||= groupWaste(k, p, n)

  const sym = k === 'a' ? ['+', '-'] : ['*', '/']
  const ps = p.map((e) => e.c).sort()
  const ns = n.map((e) => e.c).sort()
  const c = `(${sym[0]} ${ps.join(' ')}${ns.length ? ` ${sym[1]} ${ns.join(' ')}` : ''})`

  return { v, k, p, n, c, t, o, w }
}

/** Checks one flattened group for a part that cancels out or is worth 1. */
function groupWaste(k: 'a' | 'm', p: Array<Expr>, n: Array<Expr>): Waste | '' {
  if (k === 'm' && (p.some((e) => e.v === 1) || n.some((e) => e.v === 1))) return 'one'
  if (!n.length) return ''
  const fold = k === 'a' ? (s: number, x: number) => s + x : (s: number, x: number) => s * x
  const seen = subsetValues(p, fold)
  for (const v of subsetValues(n, fold)) if (seen.has(v)) return k === 'a' ? 'add' : 'mul'
  return ''
}

function subsetValues(list: Array<Expr>, fold: (s: number, x: number) => number) {
  const out = new Set<number>()
  for (let mask = 1; mask < 1 << list.length; mask++) {
    let acc = NaN
    for (let i = 0; i < list.length; i++) {
      if (mask & (1 << i)) acc = Number.isNaN(acc) ? list[i].v : fold(acc, list[i].v)
    }
    out.add(acc)
  }
  return out
}

export type StepError = 'slot' | 'zero' | 'fraction'

export interface Board {
  /** Every slot: the 6 tiles, then one new tile per step. */
  slots: Array<Expr>
  /** Slots already merged into another tile. */
  used: Set<number>
  /** The newest tile, or null before the first step. */
  last: Expr | null
  error: StepError | null
  /** Index of the step that failed. */
  errorAt: number
}

/** Replays steps over the tiles. Stops at the first bad step. */
export function applySteps(tiles: ReadonlyArray<number>, steps: ReadonlyArray<Step>): Board {
  const slots = tiles.map(leaf)
  const used = new Set<number>()
  let last: Expr | null = null
  for (let i = 0; i < steps.length; i++) {
    const { a, op, b } = steps[i]
    const ok = (s: number) => Number.isInteger(s) && s >= 0 && s < slots.length && !used.has(s)
    if (a === b || !ok(a) || !ok(b) || !OPS.includes(op)) {
      return { slots, used, last, error: 'slot', errorAt: i }
    }
    const e = combine(slots[a], op, slots[b])
    if (!e) {
      const error = op === '/' ? 'fraction' : 'zero'
      return { slots, used, last, error, errorAt: i }
    }
    used.add(a).add(b)
    slots.push(e)
    last = e
  }
  return { slots, used, last, error: null, errorAt: -1 }
}

export function isWasted(e: Expr): Waste | '' {
  return e.w
}

export function canonical(e: Expr): string {
  return e.c
}

export function kindsCount(o: number) {
  return (o & 1) + ((o >> 1) & 1) + ((o >> 2) & 1) + ((o >> 3) & 1)
}

export interface Score {
  points: number
  exact: boolean
  distance: number
  /** Tiles needed and kinds of operation, for the breakdown. */
  tiles: number
  kinds: number
  wasted: Waste | ''
}

/** Points for an answer, before the rarity bonus. */
export function score(e: Expr, target: number): Score {
  const distance = Math.abs(e.v - target)
  const tiles = e.t
  const kinds = kindsCount(e.o)
  const base = { exact: distance === 0, distance, tiles, kinds, wasted: e.w }
  if (e.w) return { ...base, points: 0 }
  if (distance === 0) return { ...base, points: 10 * tiles + 10 * kinds }
  return { ...base, points: distance <= 9 ? 3 * (10 - distance) : 0 }
}

/** Whether an answer may be sent: close enough, at least one step, not wasted. */
export function canSend(e: Expr | null, target: number) {
  return !!e && e.k !== '' && !e.w && Math.abs(e.v - target) <= 9
}

