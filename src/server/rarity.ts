/** The rarity bonus for an answer that a share `p` of the day's exact solvers also sent. */
export function rarityBonus(p: number) {
  return Math.min(50, Math.round(25 * Math.log10(1 / p)))
}
