import { describe, expect, it } from 'vitest'
import { defaultLayoutOptions, layoutRadial, type LayoutInput } from './layout.ts'

const node = (id: string, cat: string, ring: number, pre: string[] = []): LayoutInput => ({
  id,
  cat,
  ring,
  pre,
  weight: 1,
})

/** A deliberately crowded map: 3 categories, 4 rings, many skills per ring. */
function crowded(): LayoutInput[] {
  const out: LayoutInput[] = []
  for (const cat of ['a', 'b', 'c']) {
    for (let ring = 0; ring < 4; ring++) {
      for (let i = 0; i < 9; i++) out.push(node(`${cat}${ring}-${i}`, cat, ring))
    }
  }
  return out
}

describe('layoutRadial', () => {
  it('returns an empty layout for no skills', () => {
    const layout = layoutRadial([], ['a'])
    expect(layout.nodes.size).toBe(0)
    expect(layout.sectors).toEqual([])
  })

  it('places every skill exactly once', () => {
    const inputs = crowded()
    expect(layoutRadial(inputs, ['a', 'b', 'c']).nodes.size).toBe(inputs.length)
  })

  it('gives the same result every time', () => {
    const one = layoutRadial(crowded(), ['a', 'b', 'c'])
    const two = layoutRadial(crowded().reverse(), ['a', 'b', 'c'])
    expect([...two.nodes.values()].sort((x, y) => x.id.localeCompare(y.id))).toEqual(
      [...one.nodes.values()].sort((x, y) => x.id.localeCompare(y.id)),
    )
  })

  it('never puts two skills on top of each other, even when crowded', () => {
    const placed = [...layoutRadial(crowded(), ['a', 'b', 'c']).nodes.values()]
    let closest = Infinity
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!
        const b = placed[j]!
        closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y))
      }
    }
    expect(closest).toBeGreaterThanOrEqual(defaultLayoutOptions.spacing * 0.9)
  })

  it('keeps each skill inside its own category sector', () => {
    const inputs = crowded()
    const layout = layoutRadial(inputs, ['a', 'b', 'c'])
    for (const input of inputs) {
      const sector = layout.sectors.find((s) => s.cat === input.cat)!
      const angle = layout.nodes.get(input.id)!.angle
      expect(angle).toBeGreaterThanOrEqual(sector.start - 1e-9)
      expect(angle).toBeLessThanOrEqual(sector.end + 1e-9)
    }
  })

  it('fits all sectors into one full turn without overlap', () => {
    const { sectors } = layoutRadial(crowded(), ['a', 'b', 'c'])
    for (let i = 1; i < sectors.length; i++) {
      expect(sectors[i]!.start).toBeGreaterThan(sectors[i - 1]!.end)
    }
    const span = sectors[sectors.length - 1]!.end - sectors[0]!.start
    expect(span).toBeLessThanOrEqual(Math.PI * 2 + 1e-9)
  })

  it('puts deeper rings further from the centre', () => {
    const layout = layoutRadial([node('root', 'a', 0), node('leaf', 'a', 2, ['root'])], ['a'])
    const dist = (id: string) => Math.hypot(layout.nodes.get(id)!.x, layout.nodes.get(id)!.y)
    expect(dist('leaf')).toBeGreaterThan(dist('root'))
  })

  it('still draws a skill whose category was not in the given order', () => {
    const layout = layoutRadial([node('x', 'unlisted', 0)], ['a'])
    expect(layout.nodes.has('x')).toBe(true)
  })
})
