// Paints one frame of the map. It keeps no state: give it the scene, the
// camera, the colours and what is selected, and it draws.
//
// Everything is projected to screen pixels by hand (see camera.ts) and then
// drawn with ordinary 2D canvas calls, far things first.

import { edgeKey, type PathToKnown } from '../domain/path.ts'
import { project, type Camera } from './camera.ts'
import type { Scene, SceneEdge, SceneNode } from './scene.ts'

export type Theme = {
  bg: string
  surface: string
  line: string
  text: string
  muted: string
  have: string
  haveInk: string
  next: string
  gap: string
  /** 0 turns the glow off (used in light mode, where it looks muddy). */
  glow: number
}

export type DrawState = {
  selectedId: string | null
  hoverId: string | null
  /** Seconds since the page loaded, for pulses and twinkles. */
  time: number
  /** False when the person asked for reduced motion. */
  motion: boolean
  /** Seconds since the opening animation began. Infinity means "already finished". */
  reveal: number
  /** The route from known skills to the selected one, if a skill is selected. */
  path: PathToKnown | null
  /** Names shown last frame. They keep their place so names do not flicker as the map turns. */
  keepLabels: Set<string>
}

/** Where one skill ended up on screen. Used for clicks and hover. */
export type ScreenNode = { id: string; sx: number; sy: number; r: number; depth: number }

export type Frame = { nodes: ScreenNode[]; labels: Set<string> }

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const LABEL_SIZE = 12

// ---------- opening animation timing ----------

const RING_DELAY = 0.17
const NODE_GROW = 0.5

/** When a skill starts to appear: inner rings first, with a little scatter so it does not look mechanical. */
function appearsAt(n: SceneNode): number {
  let hash = 0
  for (let i = 0; i < n.id.length; i++) hash = (hash * 31 + n.id.charCodeAt(i)) % 997
  return 0.2 + n.ring * RING_DELAY + (hash / 997) * 0.14
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Starts fast, ends gently. */
const easeOut = (t: number) => 1 - (1 - t) ** 3
/** Like easeOut, but overshoots slightly and settles: a small "pop". */
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2

/** How long the whole opening animation takes for this scene. */
export function revealDuration(scene: Scene): number {
  return 0.2 + scene.ringRadii.length * RING_DELAY + 0.14 + NODE_GROW + 0.4
}

// ---------- small helpers ----------

/** Splits a name over at most two lines so long names do not run into neighbours. */
export function wrapLabel(name: string, maxChars = 15): string[] {
  if (name.length <= maxChars) return [name]
  const words = name.split(' ')
  let first = ''
  let i = 0
  while (i < words.length && (first + ' ' + words[i]).trim().length <= maxChars) {
    first = (first + ' ' + words[i]).trim()
    i++
  }
  if (first === '') {
    first = words[0] ?? name
    i = 1
  }
  const rest = words.slice(i).join(' ')
  if (rest === '') return [first]
  return [first, rest.length > maxChars + 2 ? rest.slice(0, maxChars + 1).trimEnd() + '…' : rest]
}

/** Things further away are drawn fainter. 1 at the centre of the disc, less toward the far edge. */
function depthFade(size: number, cam: Camera): number {
  const relative = size / cam.scale
  return Math.min(1, Math.max(0.45, 1 - (1 - relative) * 2.2))
}

type Point = { sx: number; sy: number }

/**
 * The line between two skills, as screen points. It is a curve that bends
 * toward the centre and arcs up off the disc, so lines read as bridges rather
 * than a tangle of straight chords.
 */
function curve(a: SceneNode, b: SceneNode, cam: Camera, steps = 16): Point[] {
  const pull = a.cat === b.cat ? 0.86 : 0.62
  const cx = ((a.x + b.x) / 2) * pull
  const cy = ((a.y + b.y) / 2) * pull
  const lift = Math.min(150, Math.hypot(a.x - b.x, a.y - b.y) * 0.24)
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    // Quadratic Bezier: blend start, control point and end.
    const x = u * u * a.x + 2 * u * t * cx + t * t * b.x
    const y = u * u * a.y + 2 * u * t * cy + t * t * b.y
    const z = 4 * lift * u * t // 0 at both ends, highest in the middle
    points.push(project(cam, x, y, z))
  }
  return points
}

function strokePoints(ctx: CanvasRenderingContext2D, points: Point[], upTo = 1): void {
  const last = Math.max(1, Math.round((points.length - 1) * upTo))
  ctx.beginPath()
  ctx.moveTo(points[0]!.sx, points[0]!.sy)
  for (let i = 1; i <= last; i++) ctx.lineTo(points[i]!.sx, points[i]!.sy)
  ctx.stroke()
}

// ---------- stars ----------

type Star = { x: number; y: number; z: number; size: number; alpha: number; phase: number; speed: number }
let starCache: { radius: number; stars: Star[] } | null = null

/** The same "random" stars every time, so the sky does not change between visits. */
function starsFor(radius: number): Star[] {
  if (starCache?.radius === radius) return starCache.stars
  let seed = 20261109
  const random = () => {
    // mulberry32: a tiny, well-known repeatable random number generator
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const stars: Star[] = []
  for (let i = 0; i < 340; i++) {
    stars.push({
      x: (random() * 2 - 1) * radius * 3.2,
      y: (random() * 2 - 1) * radius * 3.2,
      // Below the disc, at different depths, so they slide at different speeds as you turn.
      z: -radius * (0.25 + random() * 1.6),
      size: 0.5 + random() * 1.2,
      alpha: 0.25 + random() * 0.6,
      phase: random() * Math.PI * 2,
      speed: 0.4 + random() * 1.4,
    })
  }
  starCache = { radius, stars }
  return stars
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: Scene,
  cam: Camera,
  theme: Theme,
  state: DrawState,
): void {
  const dark = theme.glow > 0
  ctx.fillStyle = dark ? theme.text : theme.gap
  const fadeIn = easeOut(clamp01(state.reveal / 1.2))
  for (const star of starsFor(scene.outerRadius)) {
    const p = project(cam, star.x, star.y, star.z)
    if (p.sx < 0 || p.sx > width || p.sy < 0 || p.sy > height) continue
    const twinkle = state.motion ? 0.75 + 0.25 * Math.sin(state.time * star.speed + star.phase) : 1
    ctx.globalAlpha = star.alpha * twinkle * fadeIn * (dark ? 0.8 : 0.35)
    ctx.beginPath()
    ctx.arc(p.sx, p.sy, star.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ---------- the frame ----------

export function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  scene: Scene,
  cam: Camera,
  theme: Theme,
  state: DrawState,
): Frame {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, width, height)

  drawStars(ctx, width, height, scene, cam, theme, state)
  drawGuides(ctx, scene, cam, theme, state)

  // What stays bright. With a skill selected: the route to it from what the
  // person knows, plus whatever it leads to. On hover: its direct neighbours.
  const focus = state.selectedId ?? state.hoverId
  const bright = new Set<string>()
  if (focus) {
    bright.add(focus)
    for (const e of scene.edges) {
      if (e.from === focus) bright.add(e.to)
      if (e.to === focus) bright.add(e.from)
    }
    if (state.selectedId && state.path) for (const id of state.path.nodes) bright.add(id)
  }
  const dimmed = (id: string) => focus !== null && !bright.has(id)
  const onPath = (e: SceneEdge) =>
    state.selectedId !== null && state.path !== null && state.path.edges.has(edgeKey(e.from, e.to))

  const appear = new Map(scene.nodes.map((n) => [n.id, clamp01((state.reveal - appearsAt(n)) / NODE_GROW)]))

  // Lines from each prerequisite to the skill that needs it. Route lines go
  // last so they sit on top.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const ordered = [...scene.edges].sort((a, b) => Number(onPath(a)) - Number(onPath(b)))
  for (const e of ordered) {
    const a = scene.byId.get(e.from)
    const b = scene.byId.get(e.to)
    if (!a || !b) continue
    // A line grows from the prerequisite once both ends have started to appear.
    const grown = easeOut(Math.min(appear.get(a.id) ?? 1, appear.get(b.id) ?? 1))
    if (grown <= 0) continue
    const points = curve(a, b, cam)
    const lit = a.have && b.have
    const route = onPath(e)
    const touchesFocus = focus !== null && (e.from === focus || e.to === focus)

    if (route) {
      drawRoute(ctx, points, theme, state)
      continue
    }
    const crossing = a.cat === b.cat ? 1 : 0.5
    ctx.globalAlpha = focus === null ? (lit ? 0.7 : 0.85) * crossing : touchesFocus ? 1 : 0.1
    ctx.strokeStyle = lit ? theme.have : b.next ? theme.next : theme.line
    ctx.lineWidth = touchesFocus ? 2.2 : 1.3
    ctx.setLineDash(lit ? [] : [3, 6])
    strokePoints(ctx, points, grown)
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // Skills, far ones first so near ones overlap them correctly.
  const screen: ScreenNode[] = scene.nodes.map((n) => {
    const p = project(cam, n.x, n.y)
    return { id: n.id, sx: p.sx, sy: p.sy, r: n.radius * p.size, depth: p.depth }
  })
  const byDepth = [...screen].sort((a, b) => a.depth - b.depth)
  for (const s of byDepth) {
    const n = scene.byId.get(s.id)!
    const fade = depthFade(s.r / n.radius, cam)
    drawNode(ctx, n, s, theme, state, dimmed(n.id), fade, appear.get(n.id) ?? 1)
  }

  const reserved = drawSectorNames(ctx, width, scene, cam, theme, state)
  const visible = byDepth.filter((s) => (appear.get(s.id) ?? 1) >= 1)
  const labels = drawLabels(ctx, scene, visible, cam, theme, state, focus, dimmed, reserved)
  ctx.globalAlpha = 1
  return { nodes: screen, labels }
}

/** The glowing route from what the person knows to the selected skill, with light running along it. */
function drawRoute(ctx: CanvasRenderingContext2D, points: Point[], theme: Theme, state: DrawState): void {
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  ctx.strokeStyle = theme.next
  ctx.lineWidth = 2.6
  if (theme.glow > 0) {
    ctx.shadowColor = theme.next
    ctx.shadowBlur = 12
  }
  strokePoints(ctx, points)
  ctx.shadowBlur = 0
  if (!state.motion) return
  // Short bright dashes that travel from the prerequisite toward the goal.
  ctx.strokeStyle = theme.text
  ctx.lineWidth = 2.2
  ctx.globalAlpha = 0.9
  ctx.setLineDash([4, 22])
  ctx.lineDashOffset = -state.time * 55
  strokePoints(ctx, points)
  ctx.lineDashOffset = 0
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

function drawGuides(ctx: CanvasRenderingContext2D, scene: Scene, cam: Camera, theme: Theme, state: DrawState): void {
  ctx.strokeStyle = theme.line
  ctx.lineWidth = 1

  // Each ring is a circle on the disc. Tilted, it becomes an oval that is not
  // quite an ellipse (the near half is bigger), so it is drawn as many short lines.
  scene.ringRadii.forEach((radius, ring) => {
    const shown = easeOut(clamp01((state.reveal - ring * RING_DELAY) / 0.6))
    if (shown <= 0) return
    ctx.globalAlpha = 0.6 * shown
    ctx.beginPath()
    const steps = 96
    const sweep = Math.round(steps * shown)
    for (let i = 0; i <= sweep; i++) {
      const a = (i / steps) * Math.PI * 2 - Math.PI / 2
      const p = project(cam, Math.cos(a) * radius, Math.sin(a) * radius)
      if (i === 0) ctx.moveTo(p.sx, p.sy)
      else ctx.lineTo(p.sx, p.sy)
    }
    ctx.stroke()
  })

  // A faint divider half-way through the gap between two categories.
  if (scene.sectors.length > 1) {
    const inner = (scene.ringRadii[0] ?? 0) - 40
    const outer = scene.outerRadius + 40
    ctx.globalAlpha = 0.4 * easeOut(clamp01((state.reveal - 0.3) / 0.8))
    for (let i = 0; i < scene.sectors.length; i++) {
      const s = scene.sectors[i]!
      const previous = scene.sectors[(i - 1 + scene.sectors.length) % scene.sectors.length]!
      let gapStart = previous.end
      if (gapStart > s.start) gapStart -= Math.PI * 2
      const divider = (gapStart + s.start) / 2
      const from = project(cam, Math.cos(divider) * inner, Math.sin(divider) * inner)
      const to = project(cam, Math.cos(divider) * outer, Math.sin(divider) * outer)
      ctx.beginPath()
      ctx.moveTo(from.sx, from.sy)
      ctx.lineTo(to.sx, to.sy)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  n: SceneNode,
  s: ScreenNode,
  theme: Theme,
  state: DrawState,
  dim: boolean,
  fade: number,
  appear: number,
): void {
  if (appear <= 0) return
  const alpha = (dim ? 0.2 : 1) * fade * Math.min(1, appear * 2)
  const r = s.r * (appear < 1 ? Math.max(0, easeOutBack(appear)) : 1)

  // A skill the person has "ignites" as it appears: a ring that expands and fades.
  if (n.have && appear > 0 && appear < 1) {
    ctx.globalAlpha = (1 - appear) * 0.7
    ctx.strokeStyle = theme.have
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.sx, s.sy, r + appear * 26, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalAlpha = alpha
  if (n.next) {
    // A ring that slowly breathes. Without motion it sits still at full size.
    const phase = state.motion ? (Math.sin(state.time * 2.2) + 1) / 2 : 1
    ctx.strokeStyle = theme.next
    ctx.lineWidth = 2
    ctx.globalAlpha = alpha * (0.45 + 0.55 * phase)
    ctx.beginPath()
    ctx.arc(s.sx, s.sy, r + 5 + 4 * phase, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = alpha
  }

  ctx.beginPath()
  ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2)
  if (n.have) {
    if (theme.glow > 0 && !dim) {
      ctx.shadowColor = theme.have
      ctx.shadowBlur = theme.glow
    }
    ctx.fillStyle = theme.have
    ctx.fill()
    ctx.shadowBlur = 0
  } else {
    ctx.fillStyle = n.steppingStone ? theme.bg : theme.surface
    ctx.fill()
    ctx.strokeStyle = n.next ? theme.next : theme.gap
    ctx.lineWidth = n.steppingStone ? 1.2 : 2
    ctx.setLineDash(n.steppingStone ? [2.5, 3] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // How many postings ask for it, written inside the circle when there is room.
  if (n.demand > 0 && r >= 6.5) {
    ctx.fillStyle = n.have ? theme.haveInk : n.next ? theme.next : theme.muted
    ctx.font = `700 ${r * 0.95}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n.demand), s.sx, s.sy + r * 0.06)
  }

  if (n.id === state.selectedId) {
    ctx.strokeStyle = theme.text
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(s.sx, s.sy, r + (n.next ? 13 : 5), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

type Box = { left: number; top: number; right: number; bottom: number }

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

/** Order in which names claim space: the skills a person most needs to see first. */
function labelPriority(n: SceneNode, focus: string | null, state: DrawState): number {
  if (n.id === focus) return 1000
  if (n.steppingStone && !state.path?.nodes.has(n.id)) return -1
  return (
    (state.selectedId && state.path?.nodes.has(n.id) ? 200 : 0) +
    (n.next ? 100 : 0) +
    (state.keepLabels.has(n.id) ? 40 : 0) +
    n.demand * 2 +
    (n.have ? 1 : 0)
  )
}

/**
 * Writes skill names by their circles, always at the same readable size. When
 * two names would collide, the more important one is kept and the other waits
 * until you zoom in or turn the map.
 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  nodes: ScreenNode[],
  cam: Camera,
  theme: Theme,
  state: DrawState,
  focus: string | null,
  dimmed: (id: string) => boolean,
  reserved: Box[],
): Set<string> {
  const shown = new Set<string>()
  // Space already used: category names, every circle, then each skill name as it is placed.
  const circles = nodes.map((s) => ({
    id: s.id,
    box: { left: s.sx - s.r, right: s.sx + s.r, top: s.sy - s.r, bottom: s.sy + s.r },
  }))
  const taken: Box[] = [...reserved]
  const free = (box: Box, own: string) =>
    !taken.some((other) => overlaps(box, other)) &&
    !circles.some((c) => c.id !== own && overlaps(box, c.box))

  const priority = (s: ScreenNode) => labelPriority(scene.byId.get(s.id)!, focus, state)
  const byPriority = [...nodes].sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'

  for (const s of byPriority) {
    const n = scene.byId.get(s.id)!
    const lines = wrapLabel(n.name)
    const textHeight = lines.length * (LABEL_SIZE + 2)
    ctx.font = `${n.id === focus ? 650 : 500} ${LABEL_SIZE}px ${FONT}`
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width))
    const boxAt = (top: number): Box => ({
      left: s.sx - width / 2 - 3,
      right: s.sx + width / 2 + 3,
      top,
      bottom: top + textHeight,
    })
    // Try under the circle first, then above it. The focused skill and the
    // "learn next" skills always get their name, whatever it covers.
    const below = boxAt(s.sy + s.r + 5)
    const above = boxAt(s.sy - s.r - 5 - textHeight)
    const forced = n.id === focus || n.next
    const box = free(below, n.id) ? below : free(above, n.id) ? above : forced ? below : null
    if (!box) continue
    taken.push(box)
    shown.add(n.id)

    ctx.globalAlpha = (dimmed(n.id) ? 0.25 : 1) * depthFade(s.r / n.radius, cam)
    ctx.fillStyle = n.have || n.id === focus || n.next ? theme.text : theme.muted
    lines.forEach((line, i) => {
      const y = box.top + i * (LABEL_SIZE + 2)
      // An outline in the background colour keeps text readable over lines.
      ctx.lineWidth = 3.5
      ctx.strokeStyle = theme.bg
      ctx.strokeText(line, s.sx, y)
      ctx.fillText(line, s.sx, y)
    })
  }
  return shown
}

/** Category names just outside the last ring. Returns the space they take up. */
function drawSectorNames(
  ctx: CanvasRenderingContext2D,
  width: number,
  scene: Scene,
  cam: Camera,
  theme: Theme,
  state: DrawState,
): Box[] {
  const boxes: Box[] = []
  ctx.font = `600 11px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = theme.muted
  ctx.globalAlpha = easeOut(clamp01((state.reveal - 0.5) / 0.8))
  const centre = project(cam, 0, 0)

  // The middle of the map is where the basics live. Say so, if there is room.
  if ((scene.ringRadii[0] ?? 0) * centre.size * Math.cos(cam.pitch) > 46) {
    ctx.textAlign = 'center'
    ctx.fillText('FOUNDATIONS', centre.sx, centre.sy)
  }

  for (const s of scene.sectors) {
    const mid = (s.start + s.end) / 2
    const p = project(cam, Math.cos(mid) * (scene.outerRadius + 78), Math.sin(mid) * (scene.outerRadius + 78))
    const name = s.name.toUpperCase()
    const textWidth = ctx.measureText(name).width
    // Text grows away from the map: to the right on the right side, and so on.
    // Then slide it back inside the canvas if a long name would be cut off.
    const side = (p.sx - centre.sx) / Math.max(1, scene.outerRadius * centre.size)
    const wanted = side > 0.35 ? p.sx : side < -0.35 ? p.sx - textWidth : p.sx - textWidth / 2
    const left = Math.min(Math.max(wanted, 8), Math.max(8, width - textWidth - 8))
    ctx.textAlign = 'left'
    ctx.fillText(name, left, p.sy)
    boxes.push({ left: left - 4, right: left + textWidth + 4, top: p.sy - 9, bottom: p.sy + 9 })
  }
  ctx.globalAlpha = 1
  return boxes
}

/** The skill under a screen point, if any. The nearest centre wins. */
export function pick(nodes: ScreenNode[], sx: number, sy: number, slack = 6): string | null {
  let best: string | null = null
  let bestDistance = Infinity
  for (const n of nodes) {
    const d = Math.hypot(n.sx - sx, n.sy - sy)
    if (d <= n.r + slack && d < bestDistance) {
      best = n.id
      bestDistance = d
    }
  }
  return best
}
