import type { Theme } from './renderer.ts'

/** Reads the map colours from the CSS variables in styles.css. */
export function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    bg: v('--bg'),
    surface: v('--surface'),
    line: v('--line'),
    text: v('--text'),
    muted: v('--muted'),
    have: v('--have'),
    haveInk: v('--have-ink'),
    next: v('--next'),
    gap: v('--gap'),
    glow: Number.parseFloat(v('--map-glow')) || 0,
  }
}
