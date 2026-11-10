// Measures how long the map takes to draw, on made-up maps of any size.
// Open the app with ?bench at the end of the address to use it.
//
// Why made-up maps: a real analysis has 40 to 80 skills. To know how much
// headroom the renderer has, it needs testing well past that.

import { layoutRadial, type LayoutInput } from '../domain/layout.ts'
import { draw, type Theme } from './renderer.ts'
import { fitCamera } from './camera.ts'
import { nodeRadius, type Scene, type SceneEdge, type SceneNode } from './scene.ts'

/** A repeatable random number generator, so every run tests the same map. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fake map with the same shape as a real one: 10 categories, 5 rings, prerequisites pointing inward. */
export function syntheticScene(count: number): Scene {
  const random = seeded(count)
  const categories = Array.from({ length: 10 }, (_, i) => `c${i}`)
  const inputs: LayoutInput[] = []
  const byCatRing = new Map<string, string[]>()

  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length]!
    // Fewer skills on the outer rings, as in the real taxonomy.
    const ring = Math.min(4, Math.floor(random() * random() * 5))
    const below = ring > 0 ? (byCatRing.get(`${cat}:${ring - 1}`) ?? []) : []
    const pre = below.length > 0 ? [below[Math.floor(random() * below.length)]!] : []
    const id = `s${i}`
    inputs.push({ id, cat, ring: pre.length > 0 ? ring : 0, pre, weight: Math.floor(random() * 7) })
    const key = `${cat}:${pre.length > 0 ? ring : 0}`
    byCatRing.set(key, [...(byCatRing.get(key) ?? []), id])
  }

  const layout = layoutRadial(inputs, categories)
  const nodes: SceneNode[] = inputs.map((input, i) => {
    const placed = layout.nodes.get(input.id)!
    const have = random() < 0.4
    const demand = input.weight
    const steppingStone = !have && demand === 0
    return {
      id: input.id,
      name: `Skill number ${i}`,
      cat: input.cat,
      x: placed.x,
      y: placed.y,
      ring: placed.ring,
      radius: nodeRadius(demand, steppingStone),
      demand,
      have,
      next: i % 97 === 0,
      steppingStone,
    }
  })
  const edges: SceneEdge[] = inputs.flatMap((input) => input.pre.map((from) => ({ from, to: input.id })))

  return {
    nodes,
    byId: new Map(nodes.map((n) => [n.id, n])),
    edges,
    sectors: layout.sectors.map((s) => ({ ...s, name: `Category ${s.cat}` })),
    ringRadii: layout.ringRadii,
    outerRadius: layout.outerRadius,
  }
}

export type Timing = {
  /**
   * Milliseconds. The average comes from the total time for all frames, so it
   * stays accurate on browsers whose clock only ticks once a millisecond.
   */
  mean: number
  /** The middle value, the 95th percentile (a slow frame), and the worst. */
  median: number
  p95: number
  worst: number
}

export type BenchResult = {
  nodes: number
  edges: number
  /** Time our own code spends drawing one frame. */
  script: Timing
  /**
   * Time between frames actually shown on screen, or null if the browser
   * showed none (it stops showing frames when the window is hidden).
   */
  live: Timing | null
}

function summarise(times: number[]): Timing {
  const sorted = [...times].sort((x, y) => x - y)
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0
  const mean = times.reduce((sum, t) => sum + t, 0) / Math.max(1, times.length)
  return { mean, median: at(0.5), p95: at(0.95), worst: sorted[sorted.length - 1] ?? 0 }
}

type Painter = (frameNumber: number) => void

/** Makes a function that draws one frame of the scene, with the camera a little further round each time. */
function painter(ctx: CanvasRenderingContext2D, width: number, height: number, scene: Scene, theme: Theme): Painter {
  let labels = new Set<string>()
  return (frameNumber) => {
    const cam = fitCamera(scene.outerRadius, width, height, 0.85, frameNumber * 0.02)
    labels = draw(ctx, width, height, 1, scene, cam, theme, {
      selectedId: null,
      hoverId: null,
      time: frameNumber / 60,
      motion: true,
      reveal: Infinity,
      path: null,
      keepLabels: labels,
    }).labels
  }
}

/**
 * Measure 1: how long our drawing code runs per frame.
 * This is the part we control. It does not include the browser's own work of
 * putting the pixels on screen afterwards, which is what measure 2 is for.
 */
function measureScript(paint: Painter, frames: number): Timing {
  const times: number[] = []
  const begin = performance.now()
  for (let i = 0; i < frames; i++) {
    const start = performance.now()
    paint(i)
    times.push(performance.now() - start)
  }
  // One long measurement divided by the frame count beats adding up many tiny ones.
  return { ...summarise(times), mean: (performance.now() - begin) / frames }
}

/**
 * Measure 2: let the browser run the animation for real and time the gap
 * between frames it shows. On a 60 Hz screen a healthy result is about 16.7 ms.
 * It can never be faster than the screen's refresh rate.
 */
function measureLive(paint: Painter, seconds: number): Promise<Timing | null> {
  return new Promise((resolve) => {
    const gaps: number[] = []
    let last = 0
    let frameNumber = 0
    const started = performance.now()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      resolve(gaps.length >= 10 ? summarise(gaps) : null)
    }
    // If the window is hidden the browser shows no frames at all. Give up, do not hang.
    setTimeout(finish, seconds * 1000 + 1500)
    const tick = (now: number) => {
      if (finished) return
      if (last > 0) gaps.push(now - last)
      last = now
      paint(frameNumber++)
      if (now - started < seconds * 1000) requestAnimationFrame(tick)
      else finish()
    }
    requestAnimationFrame(tick)
  })
}

export async function measureScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: Scene,
  theme: Theme,
): Promise<BenchResult> {
  const paint = painter(ctx, width, height, scene, theme)
  for (let i = 0; i < 10; i++) paint(i) // warm up, so one-off start-up costs are not counted
  return {
    nodes: scene.nodes.length,
    edges: scene.edges.length,
    script: measureScript(paint, 120),
    live: await measureLive(paint, 2),
  }
}
