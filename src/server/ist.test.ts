import { describe, expect, it } from 'vitest'
import { addDays, puzzleNumber, secondsUntilMidnightIST, todayIST } from './ist'

describe('India dates', () => {
  it('changes day at midnight India time, not UTC', () => {
    // 18:29:59 UTC is 23:59:59 IST; 18:30 UTC is midnight IST.
    expect(todayIST(Date.parse('2026-11-14T18:29:59Z'))).toBe('2026-11-14')
    expect(todayIST(Date.parse('2026-11-14T18:30:00Z'))).toBe('2026-11-15')
    expect(secondsUntilMidnightIST(Date.parse('2026-11-14T18:29:00Z'))).toBe(60)
    expect(secondsUntilMidnightIST(Date.parse('2026-11-14T18:30:00Z'))).toBe(86400)
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('numbers puzzles from the launch date', () => {
    expect(puzzleNumber('2026-10-12')).toBe(1)
    expect(puzzleNumber('2026-10-23')).toBe(12)
  })
})
