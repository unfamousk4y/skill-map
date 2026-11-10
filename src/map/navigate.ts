// Arrow-key movement between skills on the map.
//
// Pressing Right should go to "the skill to the right", as it looks on screen
// at that moment (the map may be turned or tilted). So this works on screen
// positions, not map positions.

export type Direction = 'left' | 'right' | 'up' | 'down'
type Spot = { id: string; sx: number; sy: number }

const STEP: Record<Direction, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
}

/**
 * The best skill to move to from `fromId` in the given direction, or null if
 * there is nothing that way.
 *
 * Each candidate is scored by how far it is along the direction, plus a
 * penalty for being off to the side. Lowest score wins. The penalty (twice the
 * sideways distance) makes "straight ahead but a bit further" beat "close but
 * mostly sideways".
 */
export function nextInDirection(spots: Spot[], fromId: string, direction: Direction): string | null {
  const from = spots.find((s) => s.id === fromId)
  if (!from) return null
  const [dx, dy] = STEP[direction]
  let best: string | null = null
  let bestScore = Infinity
  for (const s of spots) {
    if (s.id === fromId) continue
    const along = (s.sx - from.sx) * dx + (s.sy - from.sy) * dy
    const sideways = Math.abs((s.sx - from.sx) * dy - (s.sy - from.sy) * dx)
    // Must be genuinely in that direction: ahead, and not more sideways than ahead.
    if (along <= 0.5 || sideways > along * 1.5) continue
    const score = along + sideways * 2
    if (score < bestScore || (score === bestScore && best !== null && s.id < best)) {
      best = s.id
      bestScore = score
    }
  }
  return best
}
