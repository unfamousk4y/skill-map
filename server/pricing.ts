// What a Claude call costs. Prices are US dollars per million tokens for
// claude-haiku-5-5 with a prompt of 100,000 tokens or fewer, from Anthropic's
// model table dated 2026-11-03. A token is roughly three quarters of a word.
// If prices change, change them here: the spend log stores token counts, so
// old entries can be re-priced.

export const PRICE_PER_MILLION = {
  input: 0.1,
  output: 0.5,
  /** Writing the standing instructions into the cache costs a little extra once. */
  cacheWrite: 0.1 * 1.25,
  /** Reading them back on later calls costs a tenth. */
  cacheRead: 0.1 * 0.1,
}

export type TokenUse = { input: number; output: number; cacheWrite: number; cacheRead: number }

export function costOf(use: TokenUse): number {
  return (
    (use.input * PRICE_PER_MILLION.input +
      use.output * PRICE_PER_MILLION.output +
      use.cacheWrite * PRICE_PER_MILLION.cacheWrite +
      use.cacheRead * PRICE_PER_MILLION.cacheRead) /
    1_000_000
  )
}
