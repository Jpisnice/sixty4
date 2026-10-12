const grouping = new Intl.NumberFormat('en-IN')

/** Digits with Indian-style grouping: 2,400 and 1,20,000. */
export function num(n: number) {
  return grouping.format(n)
}
