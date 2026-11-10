import { describe, expect, it } from 'vitest'
import { easeCamera, fitCamera, project, type Camera } from './camera.ts'

const flat: Camera = { yaw: 0, pitch: 0, scale: 2, x: 100, y: 50 }

describe('project', () => {
  it('looking straight down is plain 2D: scale then shift', () => {
    const p = project(flat, 10, 20)
    expect(p.sx).toBeCloseTo(120)
    expect(p.sy).toBeCloseTo(90)
    expect(p.size).toBeCloseTo(2)
  })

  it('a quarter turn of yaw moves the right-hand point to the bottom', () => {
    const p = project({ ...flat, yaw: Math.PI / 2 }, 10, 0)
    expect(p.sx).toBeCloseTo(100)
    expect(p.sy).toBeCloseTo(70)
  })

  it('when tilted, the near edge looks bigger than the far edge', () => {
    const tilted = { ...flat, pitch: 1 }
    const near = project(tilted, 0, 500)
    const far = project(tilted, 0, -500)
    expect(near.size).toBeGreaterThan(far.size)
    expect(near.depth).toBeGreaterThan(far.depth)
  })

  it('tilting squashes the disc vertically but not sideways', () => {
    const tilted = { ...flat, pitch: 1 }
    const side = project(tilted, 300, 0)
    const top = project(tilted, 0, -300)
    expect(Math.abs(side.sx - tilted.x)).toBeCloseTo(600)
    expect(Math.abs(top.sy - tilted.y)).toBeLessThan(600 * Math.cos(1))
  })

  it('lifting a point raises it on a tilted screen and does nothing visible from above except size', () => {
    const tilted = { ...flat, pitch: 1 }
    expect(project(tilted, 0, 0, 100).sy).toBeLessThan(project(tilted, 0, 0, 0).sy)
    expect(project(flat, 0, 0, 100).sy).toBeCloseTo(project(flat, 0, 0, 0).sy)
  })

  it('stays finite for a point at or behind the eye', () => {
    const p = project({ ...flat, pitch: Math.PI / 2 }, 0, 5000)
    expect(Number.isFinite(p.sx) && Number.isFinite(p.sy) && Number.isFinite(p.size)).toBe(true)
  })
})

describe('fitCamera', () => {
  it.each([
    [0, 0],
    [0.95, 0],
    [0.95, 2.1],
    [1.2, 4],
  ])('keeps the whole disc on screen at pitch %f, yaw %f', (pitch, yaw) => {
    const width = 900
    const height = 600
    const cam = fitCamera(600, width, height, pitch, yaw)
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const p = project(cam, Math.cos(a) * 600, Math.sin(a) * 600)
      expect(p.sx).toBeGreaterThanOrEqual(0)
      expect(p.sx).toBeLessThanOrEqual(width)
      expect(p.sy).toBeGreaterThanOrEqual(0)
      expect(p.sy).toBeLessThanOrEqual(height)
    }
  })

  it('does not collapse on a tiny canvas', () => {
    expect(fitCamera(600, 10, 10, 0.95, 0).scale).toBeGreaterThan(0)
  })
})

describe('easeCamera', () => {
  const target: Camera = { yaw: 1, pitch: 1, scale: 1, x: 0, y: 0 }

  it('moves toward the target without overshooting', () => {
    const next = easeCamera(flat, target, 1 / 60)
    expect(next.pitch).toBeGreaterThan(0)
    expect(next.pitch).toBeLessThan(1)
  })

  it('arrives after enough time', () => {
    expect(easeCamera(flat, target, 10).scale).toBeCloseTo(1)
  })

  it('does not move when no time has passed', () => {
    expect(easeCamera(flat, target, 0)).toEqual(flat)
  })
})
