import { describe, expect, it } from 'vitest'
import { nextInDirection } from './navigate.ts'

// Screen y grows downward, so "up" means a smaller sy.
//
//            north (0,-100)
//  west (-100,0)   mid (0,0)   east (100,0)   far-east (300,0)
//            south (0,100)             south-east (120,90)
const spots = [
  { id: 'mid', sx: 0, sy: 0 },
  { id: 'north', sx: 0, sy: -100 },
  { id: 'south', sx: 0, sy: 100 },
  { id: 'west', sx: -100, sy: 0 },
  { id: 'east', sx: 100, sy: 0 },
  { id: 'far-east', sx: 300, sy: 0 },
  { id: 'south-east', sx: 120, sy: 90 },
]

describe('nextInDirection', () => {
  it('moves to the neighbour in each direction', () => {
    expect(nextInDirection(spots, 'mid', 'up')).toBe('north')
    expect(nextInDirection(spots, 'mid', 'down')).toBe('south')
    expect(nextInDirection(spots, 'mid', 'left')).toBe('west')
    expect(nextInDirection(spots, 'mid', 'right')).toBe('east')
  })

  it('prefers the nearer of two skills in the same direction', () => {
    expect(nextInDirection(spots, 'east', 'right')).toBe('far-east')
    expect(nextInDirection(spots, 'mid', 'right')).not.toBe('far-east')
  })

  it('prefers straight ahead over closer but off to the side', () => {
    expect(nextInDirection(spots, 'south', 'right')).toBe('south-east')
    expect(nextInDirection(spots, 'mid', 'right')).toBe('east')
  })

  it('returns null at the edge of the map', () => {
    expect(nextInDirection(spots, 'north', 'up')).toBeNull()
    expect(nextInDirection(spots, 'far-east', 'right')).toBeNull()
  })

  it('returns null for an unknown starting skill or an empty map', () => {
    expect(nextInDirection(spots, 'nowhere', 'up')).toBeNull()
    expect(nextInDirection([], 'mid', 'up')).toBeNull()
  })

  it('can always get back: every skill is reachable from mid by some key presses', () => {
    const seen = new Set(['mid'])
    const queue = ['mid']
    while (queue.length > 0) {
      const at = queue.shift()!
      for (const direction of ['left', 'right', 'up', 'down'] as const) {
        const to = nextInDirection(spots, at, direction)
        if (to && !seen.has(to)) {
          seen.add(to)
          queue.push(to)
        }
      }
    }
    expect(seen.size).toBe(spots.length)
  })
})
