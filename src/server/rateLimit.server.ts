// In-memory token buckets. Per process: enough while there are no rewards.

interface Bucket {
  tokens: number
  at: number
}

export class TokenBucket {
  private buckets = new Map<string, Bucket>()

  /** `capacity` tokens, refilled evenly over `periodMs`. */
  constructor(
    private capacity: number,
    private periodMs: number,
  ) {}

  take(key: string, now = Date.now()) {
    const rate = this.capacity / this.periodMs
    const b = this.buckets.get(key) ?? { tokens: this.capacity, at: now }
    b.tokens = Math.min(this.capacity, b.tokens + (now - b.at) * rate)
    b.at = now
    if (this.buckets.size > 50_000) this.prune(now)
    if (b.tokens < 1) {
      this.buckets.set(key, b)
      return false
    }
    b.tokens -= 1
    this.buckets.set(key, b)
    return true
  }

  private prune(now: number) {
    const rate = this.capacity / this.periodMs
    for (const [key, b] of this.buckets) {
      if (b.tokens + (now - b.at) * rate >= this.capacity) this.buckets.delete(key)
    }
  }
}

const DAY = 24 * 60 * 60 * 1000

/** 30 answer requests a day per phone, refused ones included. */
export const perDevice = new TokenBucket(30, DAY)
/** A looser limit per IP, since many phones can share one. */
export const perIp = new TokenBucket(600, DAY)
/** 30 debug-menu resets a day per phone, kept apart so testing doesn't use up answers. */
export const perDeviceReset = new TokenBucket(30, DAY)
