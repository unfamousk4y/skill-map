import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { pathToKnown, type PathToKnown } from '../domain/path.ts'
import { easeCamera, fitCamera, type Camera } from './camera.ts'
import { nextInDirection, type Direction } from './navigate.ts'
import { draw, pick, revealDuration, type Frame, type Theme } from './renderer.ts'
import type { Scene } from './scene.ts'
import { readTheme } from './theme.ts'

type Props = {
  scene: Scene
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const MIN_SCALE = 0.12
const MAX_SCALE = 3
/** How far the disc leans back in 3D view, in radians (about 49 degrees). */
const TILT = 0.85
const MAX_PITCH = 1.25
/** Radians per second of idle spin. Slow enough to read names as they pass. */
const IDLE_SPIN = 0.035
/** Seconds without input before the idle spin resumes. */
const IDLE_AFTER = 4

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}
const STEPS: Record<Direction, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function MapCanvas({ scene, selectedId, onSelect }: Props) {
  const hintId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // People who ask for reduced motion start in the flat view, with no spin.
  const [tilted, setTilted] = useState(() => !prefersReducedMotion())
  const tiltedRef = useRef(tilted)

  // These change many times a second, so they live in refs. Putting them in
  // React state would re-render the component on every frame.
  const camera = useRef<Camera>({ yaw: 0, pitch: 0, scale: 1, x: 0, y: 0 })
  const target = useRef<Camera>({ yaw: 0, pitch: 0, scale: 1, x: 0, y: 0 })
  const size = useRef({ width: 0, height: 0 })
  const theme = useRef<Theme | null>(null)
  const frame = useRef<Frame>({ nodes: [], labels: new Set() })
  const hoverId = useRef<string | null>(null)
  const userMoved = useRef(false)
  const dirty = useRef(true)
  const drag = useRef<{ x: number; y: number; moved: number; pan: boolean } | null>(null)
  // Fingers (or pens, or mouse buttons) currently down, for two-finger zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; x: number; y: number } | null>(null)
  const lastInput = useRef(0)
  const startedAt = useRef<number | null>(null)

  const sceneRef = useRef(scene)
  const selectedRef = useRef(selectedId)
  const pathRef = useRef<PathToKnown | null>(null)
  useEffect(() => {
    sceneRef.current = scene
    selectedRef.current = selectedId
    // The route from what the person knows to the selected skill.
    const prerequisites = (id: string) => scene.edges.filter((e) => e.to === id).map((e) => e.from)
    pathRef.current = selectedId
      ? pathToKnown(selectedId, prerequisites, (id) => scene.byId.get(id)?.have ?? false)
      : null

    // In 3D, turn the disc so the selected skill comes round to the front,
    // where it is biggest and brightest. Take the shorter way round.
    const node = selectedId ? scene.byId.get(selectedId) : undefined
    if (node && tiltedRef.current && !prefersReducedMotion()) {
      const fullTurn = Math.PI * 2
      const facing = Math.PI / 2 - Math.atan2(node.y, node.x)
      const turns = Math.round((target.current.yaw - facing) / fullTurn)
      target.current = { ...target.current, yaw: facing + turns * fullTurn }
    }
    dirty.current = true
  }, [scene, selectedId])

  /** The camera that shows the whole map for the current view mode. */
  const fitted = useCallback((yaw: number): Camera => {
    const pitch = tiltedRef.current ? TILT : 0
    return fitCamera(sceneRef.current.outerRadius, size.current.width, size.current.height, pitch, yaw)
  }, [])

  // Drawing loop.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
    theme.current = readTheme()
    const onScheme = () => {
      theme.current = readTheme()
      dirty.current = true
    }
    darkScheme.addEventListener('change', onScheme)

    let raf = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      const motion = !reducedMotion.matches
      const seconds = now / 1000

      if (theme.current && size.current.width > 0) {
        if (startedAt.current === null) startedAt.current = seconds
        const sinceStart = seconds - startedAt.current
        const opening = motion && sinceStart < revealDuration(sceneRef.current)

        // Idle spin: only in 3D, only when nothing is selected or being touched.
        const idle = seconds - lastInput.current > IDLE_AFTER
        if (motion && tiltedRef.current && !opening && idle && !drag.current && !selectedRef.current && !hoverId.current) {
          target.current = { ...target.current, yaw: target.current.yaw + IDLE_SPIN * dt }
        }

        // With motion the camera glides to its target. Without, it jumps there.
        camera.current = motion ? easeCamera(camera.current, target.current, dt) : target.current

        if (dirty.current || motion) {
          dirty.current = false
          frame.current = draw(
            ctx,
            size.current.width,
            size.current.height,
            window.devicePixelRatio || 1,
            sceneRef.current,
            camera.current,
            theme.current,
            {
              selectedId: selectedRef.current,
              hoverId: hoverId.current,
              time: seconds,
              motion,
              reveal: motion ? sinceStart : Infinity,
              path: pathRef.current,
              keepLabels: frame.current.labels,
            },
          )
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      darkScheme.removeEventListener('change', onScheme)
    }
  }, [])

  // Keep the canvas the same size as its box, at the screen's pixel density.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const observer = new ResizeObserver(() => {
      const { width, height } = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const first = size.current.width === 0
      size.current = { width, height }
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      // Until the person moves the map themselves, keep the whole thing in view.
      if (!userMoved.current) {
        target.current = fitted(target.current.yaw)
        // The very first frame starts looking straight down, then tilts into 3D
        // as the skills light up.
        if (first) camera.current = { ...fitCamera(sceneRef.current.outerRadius, width, height, 0, 0) }
      }
      dirty.current = true
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [fitted])

  const touched = () => {
    lastInput.current = performance.now() / 1000
    dirty.current = true
  }

  /** Zoom while keeping the map point under (sx, sy) where it is on screen. */
  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const t = target.current
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor))
    const k = scale / t.scale
    target.current = { ...t, scale, x: sx - (sx - t.x) * k, y: sy - (sy - t.y) * k }
    userMoved.current = true
    touched()
  }, [])

  // Wheel needs a manually added listener: React's own is "passive", which
  // would let the page scroll while you zoom the map.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const box = canvas.getBoundingClientRect()
      zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const nodeAt = (e: React.PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect()
    return pick(frame.current.nodes, e.clientX - box.left, e.clientY - box.top)
  }

  /** Distance between the two fingers, and the point half-way between them. */
  const twoFingers = (box: DOMRect) => {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return null
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      x: (a.x + b.x) / 2 - box.left,
      y: (a.y + b.y) / 2 - box.top,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      // A second finger turns the gesture into pinch-to-zoom.
      pinch.current = twoFingers(e.currentTarget.getBoundingClientRect())
      drag.current = null
    } else {
      // In the flat view a drag slides the map. In 3D it turns and tilts it,
      // and holding Shift slides it instead.
      drag.current = { x: e.clientX, y: e.clientY, moved: 0, pan: !tiltedRef.current || e.shiftKey }
    }
    touched()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const before = pinch.current
    if (before) {
      const now = twoFingers(e.currentTarget.getBoundingClientRect())
      if (!now) return
      // Fingers moving apart zoom in around the point between them. Both
      // fingers moving together slide the map.
      zoomAt(now.x, now.y, now.distance / Math.max(1, before.distance))
      const t = target.current
      target.current = { ...t, x: t.x + now.x - before.x, y: t.y + now.y - before.y }
      camera.current = target.current
      pinch.current = now
      return
    }

    const d = drag.current
    if (d) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.moved += Math.abs(dx) + Math.abs(dy)
      d.x = e.clientX
      d.y = e.clientY
      const t = target.current
      const next = d.pan
        ? { ...t, x: t.x + dx, y: t.y + dy }
        : {
            ...t,
            yaw: t.yaw - dx * 0.006,
            pitch: Math.min(MAX_PITCH, Math.max(0, t.pitch - dy * 0.005)),
          }
      // While dragging, the map follows the pointer exactly, with no glide.
      target.current = next
      camera.current = next
      if (d.moved > 4) userMoved.current = true
      touched()
      return
    }
    const id = nodeAt(e)
    if (id !== hoverId.current) {
      hoverId.current = id
      e.currentTarget.style.cursor = id ? 'pointer' : 'grab'
      dirty.current = true
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    drag.current = null
    touched()
    if (pinch.current) {
      // Lifting a finger after a pinch must not count as a tap on a skill.
      if (pointers.current.size < 2) pinch.current = null
      return
    }
    // A press that barely moved is a click, not a drag.
    if (d && d.moved <= 4) onSelect(nodeAt(e))
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    drag.current = null
    pinch.current = null
  }

  const zoomButton = (factor: number) => () =>
    zoomAt(size.current.width / 2, size.current.height / 2, factor)

  const fit = () => {
    userMoved.current = false
    target.current = fitted(target.current.yaw)
    touched()
  }

  const toggleTilt = () => {
    const next = !tilted
    tiltedRef.current = next
    setTilted(next)
    userMoved.current = false
    // Going flat also turns the map back upright, by the shortest way round.
    const yaw = next ? target.current.yaw : Math.round(target.current.yaw / (Math.PI * 2)) * Math.PI * 2
    target.current = fitted(yaw)
    touched()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const direction = ARROWS[e.key]
    if (direction) {
      e.preventDefault()
      const [dx, dy] = STEPS[direction]
      if (e.shiftKey) {
        // Shift + arrows move the camera: turn and tilt in 3D, slide when flat.
        const t = target.current
        target.current = tiltedRef.current
          ? { ...t, yaw: t.yaw - dx * 0.2, pitch: Math.min(MAX_PITCH, Math.max(0, t.pitch - dy * 0.12)) }
          : { ...t, x: t.x - dx * 60, y: t.y - dy * 60 }
        userMoved.current = true
        touched()
        return
      }
      // Plain arrows move between skills, as they are laid out on screen now.
      const current = selectedRef.current
      if (current) {
        const to = nextInDirection(frame.current.nodes, current, direction)
        if (to) onSelect(to)
      } else {
        // Nothing selected yet: start with a "learn next" skill, or failing that any skill.
        const start = sceneRef.current.nodes.find((n) => n.next) ?? sceneRef.current.nodes[0]
        if (start) onSelect(start.id)
      }
      touched()
      return
    }
    if (e.key === '+' || e.key === '=') zoomButton(1.3)()
    else if (e.key === '-' || e.key === '_') zoomButton(1 / 1.3)()
    else if (e.key === '0') fit()
    else if (e.key === 'd' || e.key === 'D') toggleTilt()
  }

  return (
    <div className="map" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="map__canvas"
        // "application" tells a screen reader to pass the arrow keys through to
        // the map instead of using them to read the page.
        role="application"
        tabIndex={0}
        aria-label="Skill map"
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => {
          hoverId.current = null
          dirty.current = true
        }}
      />
      <div className="map__controls" role="group" aria-label="Map view">
        <button type="button" onClick={zoomButton(1.3)} aria-label="Zoom in">+</button>
        <button type="button" onClick={zoomButton(1 / 1.3)} aria-label="Zoom out">−</button>
        <button type="button" onClick={fit} className="map__text-button">Fit</button>
        <button type="button" onClick={toggleTilt} className="map__text-button" aria-pressed={tilted}>
          3D
        </button>
      </div>
      <p className="map__hint">
        {tilted ? 'Drag to turn · Shift-drag to move · Scroll to zoom' : 'Drag to move · Scroll to zoom'}
      </p>
      <p className="visually-hidden" id={hintId}>
        Arrow keys move between skills. Shift and arrow keys move the view. Plus and minus zoom, 0
        fits the map, D switches between 3D and flat. The List view shows the same skills as text.
      </p>
    </div>
  )
}
