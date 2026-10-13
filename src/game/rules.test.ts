import { describe, expect, it } from 'vitest'
import { applySteps, canSend, score } from './rules'
import type { Step } from './rules'

// A sample puzzle with target 612. Slots 0..5 are 3, 2, 100, 10, 2, 7.
const TILES = [3, 2, 100, 10, 2, 7]
const TARGET = 612

function play(steps: Array<Step>, tiles = TILES) {
  const board = applySteps(tiles, steps)
  expect(board.error).toBeNull()
  return board.last!
}

// 3 × 2 × 100 + 10 + 2
const answer70: Array<Step> = [
  { a: 0, op: '*', b: 1 }, // 6: slot 6
  { a: 6, op: '*', b: 2 }, // 600: slot 7
  { a: 7, op: '+', b: 3 }, // 610: slot 8
  { a: 8, op: '+', b: 4 }, // 612: slot 9
]

describe('score', () => {
  it('3 × 2 × 100 + 10 + 2 is valid, 70 points', () => {
    const s = score(play(answer70), TARGET)
    expect(s).toMatchObject({ exact: true, wasted: '', tiles: 5, kinds: 2, points: 70 })
  })

  it('(100 + 7 − 10 ÷ 2) × 2 × 3 is valid, 100 points', () => {
    const e = play([
      { a: 3, op: '/', b: 4 }, // 10 ÷ 2 = 5: slot 6
      { a: 2, op: '+', b: 5 }, // 107: slot 7
      { a: 7, op: '-', b: 6 }, // 102: slot 8
      { a: 8, op: '*', b: 1 }, // 204: slot 9
      { a: 9, op: '*', b: 0 }, // 612: slot 10
    ])
    expect(score(e, TARGET)).toMatchObject({ exact: true, wasted: '', points: 100 })
  })

  it('gives near misses 3 × (10 − distance)', () => {
    // 3 × 2 × 100 + 10 = 610, 2 away
    expect(score(play(answer70.slice(0, 3)), TARGET).points).toBe(24)
    // 600 is 12 away
    expect(score(play(answer70.slice(0, 2)), TARGET).points).toBe(0)
  })
})

describe('wasted answers are refused', () => {
  // Each pads a correct answer to a puzzle with extra tiles.
  const cases: Array<[string, Array<number>, number, Array<Step>, string]> = [
    // 600 + 12 + 7 − 7
    [
      '+ 7 − 7',
      [100, 6, 12, 7, 7, 1],
      612,
      [
        { a: 0, op: '*', b: 1 },
        { a: 6, op: '+', b: 2 },
        { a: 7, op: '+', b: 3 },
        { a: 8, op: '-', b: 4 },
      ],
      'add',
    ],
    // 600 + 12 + 3 + 4 − 7
    [
      '+ 3 + 4 − 7',
      [100, 6, 3, 4, 7, 12],
      612,
      [
        { a: 0, op: '*', b: 1 },
        { a: 6, op: '+', b: 5 },
        { a: 7, op: '+', b: 2 },
        { a: 8, op: '+', b: 3 },
        { a: 9, op: '-', b: 4 },
      ],
      'add',
    ],
    // 3 × 2 × 100 × 2 ÷ 2
    [
      '× 2 ÷ 2',
      [3, 2, 100, 10, 2, 2],
      600,
      [
        { a: 0, op: '*', b: 1 },
        { a: 6, op: '*', b: 2 },
        { a: 7, op: '*', b: 4 },
        { a: 8, op: '/', b: 5 },
      ],
      'mul',
    ],
    // 6 × 100 × 2 × 5 ÷ 10
    [
      '× 2 × 5 ÷ 10',
      [6, 100, 2, 5, 10, 1],
      600,
      [
        { a: 0, op: '*', b: 1 },
        { a: 6, op: '*', b: 2 },
        { a: 7, op: '*', b: 3 },
        { a: 8, op: '/', b: 4 },
      ],
      'mul',
    ],
    // 3 × 2 × 100 × 1
    [
      '× 1',
      [3, 2, 100, 1, 9, 9],
      600,
      [
        { a: 0, op: '*', b: 1 },
        { a: 6, op: '*', b: 2 },
        { a: 7, op: '*', b: 3 },
      ],
      'one',
    ],
    // 6 × 100 × (10 − 7 − 2)
    [
      '× (10 − 7 − 2)',
      [6, 100, 10, 7, 2, 9],
      600,
      [
        { a: 2, op: '-', b: 3 }, // 3: slot 6
        { a: 6, op: '-', b: 4 }, // 1: slot 7
        { a: 0, op: '*', b: 1 }, // 600: slot 8
        { a: 8, op: '*', b: 7 }, // 600: slot 9
      ],
      'one',
    ],
  ]

  it.each(cases)('%s', (_, tiles, target, steps, reason) => {
    const e = play(steps, tiles)
    expect(e.v).toBe(target)
    expect(e.w).toBe(reason)
    expect(score(e, target).points).toBe(0)
    expect(canSend(e, target)).toBe(false)
  })

  it('checks inside brackets: (100 × 3 ÷ 3 + 2) × 6', () => {
    const e = play(
      [
        { a: 0, op: '*', b: 1 },
        { a: 6, op: '/', b: 2 },
        { a: 7, op: '+', b: 3 },
        { a: 8, op: '*', b: 4 },
      ],
      [100, 3, 3, 2, 6, 1],
    )
    expect(e.v).toBe(612)
    expect(e.w).toBe('mul')
  })
})

describe('applySteps', () => {
  it('refuses used, unknown and repeated slots', () => {
    expect(applySteps(TILES, [{ a: 0, op: '+', b: 0 }]).error).toBe('slot')
    expect(applySteps(TILES, [{ a: 0, op: '+', b: 6 }]).error).toBe('slot')
    const reuse = applySteps(TILES, [
      { a: 0, op: '+', b: 1 },
      { a: 0, op: '+', b: 2 },
    ])
    expect(reuse).toMatchObject({ error: 'slot', errorAt: 1 })
  })

  it('refuses results that are not positive whole numbers', () => {
    expect(applySteps(TILES, [{ a: 0, op: '-', b: 2 }]).error).toBe('zero')
    expect(applySteps(TILES, [{ a: 1, op: '-', b: 4 }]).error).toBe('zero')
    expect(applySteps(TILES, [{ a: 0, op: '/', b: 1 }]).error).toBe('fraction')
  })

  it('ignores tiles and steps that do not lead to the newest tile', () => {
    const e = play([
      { a: 3, op: '+', b: 5 }, // 10 + 7, never used: slot 6
      { a: 2, op: '+', b: 4 }, // 102: slot 7
      { a: 7, op: '*', b: 1 }, // 204: slot 8
      { a: 8, op: '*', b: 0 }, // 612: slot 9
    ])
    expect(score(e, TARGET)).toMatchObject({ tiles: 4, points: 60 })
  })

  it('treats 2 × 3 and 3 × 2 as the same answer', () => {
    const a = play([{ a: 0, op: '*', b: 1 }])
    const b = play([{ a: 1, op: '*', b: 0 }])
    expect(a.c).toBe(b.c)
  })

  it('treats (a + b) + c and a + (b + c) as the same answer', () => {
    const a = play([
      { a: 2, op: '+', b: 3 },
      { a: 6, op: '+', b: 5 },
    ])
    const b = play([
      { a: 3, op: '+', b: 5 },
      { a: 2, op: '+', b: 6 },
    ])
    expect(a.c).toBe(b.c)
  })
})
