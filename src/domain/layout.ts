// Places skills on a circular map.
//
// - Each category gets a slice of the circle (a "sector").
// - Each ring is a prerequisite depth: foundations in the middle, advanced
//   skills further out.
// The same input always gives the same picture, so the map never jumps around
// between visits.

export type LayoutInput = {
  id: string
  cat: string
  ring: number
  /** Prerequisite ids. Used to keep a skill near the things it builds on. */
  pre: string[]
  /** Bigger weights are placed first when nothing else decides the order. */
  weight: number
}

export type Placed = { id: string; x: number; y: number; ring: number; angle: number }
export type Sector = { cat: string; start: number; end: number }

export type Layout = {
  nodes: Map<string, Placed>
  sectors: Sector[]
  ringRadii: number[]
  outerRadius: number
}

export type LayoutOptions = {
  /** Smallest distance between neighbours on the same ring. */
  spacing: number
  baseRadius: number
  ringGap: number
  /** Empty angle between two sectors, in radians. */
  sectorPad: number
  /** Narrowest a sector may be, so its label still fits. */
  minSector: number
}

export const defaultLayoutOptions: LayoutOptions = {
  spacing: 86,
  // The innermost ring holds the most skills (everything with no
  // prerequisites), so it needs a generous radius to fit them.
  baseRadius: 270,
  ringGap: 86,
  sectorPad: 0.06,
  minSector: 0.2,
}

const FULL_TURN = Math.PI * 2

export function layoutRadial(
  inputs: LayoutInput[],
  categoryOrder: string[],
  options: LayoutOptions = defaultLayoutOptions,
): Layout {
  if (inputs.length === 0) return { nodes: new Map(), sectors: [], ringRadii: [], outerRadius: 0 }

  const ringCount = Math.max(...inputs.map((n) => n.ring)) + 1
  const cats = categoryOrder.filter((c) => inputs.some((n) => n.cat === c))
  // Anything in a category the caller did not list still gets drawn, at the end.
  for (const n of inputs) if (!cats.includes(n.cat)) cats.push(n.cat)

  const group = (cat: string, ring: number) => inputs.filter((n) => n.cat === cat && n.ring === ring)
  const radius = (ring: number, scale: number) => scale * (options.baseRadius + ring * options.ringGap)

  // The angle a category needs is set by its most crowded ring.
  const need = (cat: string, scale: number): number => {
    let widest = options.minSector
    for (let r = 0; r < ringCount; r++) {
      widest = Math.max(widest, (group(cat, r).length * options.spacing) / radius(r, scale))
    }
    return widest
  }
  const total = (scale: number) =>
    cats.reduce((sum, c) => sum + need(c, scale), 0) + cats.length * options.sectorPad

  // If everything does not fit in one turn, grow the whole map until it does.
  let scale = 1
  for (let i = 0; i < 12 && total(scale) > FULL_TURN; i++) {
    scale *= Math.max(1.02, total(scale) / FULL_TURN)
  }

  // Share out any leftover angle in proportion to what each category needs.
  const needs = cats.map((c) => need(c, scale))
  const needSum = needs.reduce((a, b) => a + b, 0)
  const spare = Math.max(0, FULL_TURN - total(scale))

  const nodes = new Map<string, Placed>()
  const sectors: Sector[] = []
  let cursor = -Math.PI / 2 // start at the top, go clockwise

  cats.forEach((cat, index) => {
    const width = (needs[index] ?? 0) + spare * ((needs[index] ?? 0) / needSum)
    const start = cursor + options.sectorPad / 2
    const end = start + width
    const mid = (start + end) / 2
    sectors.push({ cat, start, end })

    for (let r = 0; r < ringCount; r++) {
      const members = group(cat, r)
      if (members.length === 0) continue
      const rad = radius(r, scale)

      // Aim each skill at the average direction of its already-placed
      // prerequisites in this sector, which keeps connecting lines short.
      const wanted = new Map<string, number>()
      for (const n of members) {
        const parents = n.pre
          .map((p) => nodes.get(p))
          .filter((p): p is Placed => p !== undefined && p.angle >= start && p.angle <= end)
        wanted.set(n.id, parents.length ? parents.reduce((s, p) => s + p.angle, 0) / parents.length : mid)
      }
      const ordered = [...members].sort(
        (a, b) =>
          (wanted.get(a.id) ?? mid) - (wanted.get(b.id) ?? mid) ||
          b.weight - a.weight ||
          a.id.localeCompare(b.id),
      )

      // Spread evenly around the middle of the sector, but never so far apart
      // that a pair of skills looks unrelated.
      const step = Math.min(width / ordered.length, (options.spacing * 1.5) / rad)
      ordered.forEach((n, i) => {
        const angle = mid + (i - (ordered.length - 1) / 2) * step
        nodes.set(n.id, { id: n.id, ring: r, angle, x: Math.cos(angle) * rad, y: Math.sin(angle) * rad })
      })
    }
    cursor = end + options.sectorPad / 2
  })

  const ringRadii = Array.from({ length: ringCount }, (_, r) => radius(r, scale))
  return { nodes, sectors, ringRadii, outerRadius: ringRadii[ringCount - 1] ?? 0 }
}
