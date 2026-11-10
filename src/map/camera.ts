// The 3D maths, written by hand. No graphics library.
//
// The map is a flat disc lying on a table. The camera can:
//   - spin the disc around its centre   (yaw)
//   - tilt it away from you             (pitch: 0 = looking straight down)
//   - zoom                              (scale)
//   - slide it across the screen        (x, y)
//
// "Projecting" a point means working out where it lands on the screen, and how
// big things there should look. Far things land closer together and smaller,
// which is what makes a flat picture read as 3D.

export type Camera = { yaw: number; pitch: number; scale: number; x: number; y: number }

/** How far the eye is from the centre of the disc, in map units. Smaller means a stronger 3D effect. */
export const EYE_DISTANCE = 2400

/** Below this canvas width (a phone held upright) the map drops its category names. */
export const NARROW_WIDTH = 520

export type Projected = {
  /** Screen position in pixels. */
  sx: number
  sy: number
  /** Multiply a map-unit size by this to get pixels at that spot. */
  size: number
  /** Larger means nearer to the viewer. Used to draw far things first. */
  depth: number
}

/**
 * Where the map point (x, y), lifted z above the disc, appears on screen.
 *
 * Three steps:
 * 1. Spin: rotate (x, y) around the centre by yaw.
 * 2. Tilt: lean the disc back by pitch. The bottom edge comes toward the
 *    viewer, the top edge moves away, and the disc looks squashed vertically.
 * 3. Perspective: scale by eye distance / distance to the point.
 */
export function project(cam: Camera, x: number, y: number, z = 0): Projected {
  const cosYaw = Math.cos(cam.yaw)
  const sinYaw = Math.sin(cam.yaw)
  const spunX = x * cosYaw - y * sinYaw
  const spunY = x * sinYaw + y * cosYaw

  const cosPitch = Math.cos(cam.pitch)
  const sinPitch = Math.sin(cam.pitch)
  const screenY = spunY * cosPitch - z * sinPitch
  const depth = spunY * sinPitch + z * cosPitch

  // Never divide by something tiny: a point at the eye would be infinitely big.
  const perspective = EYE_DISTANCE / Math.max(EYE_DISTANCE - depth, EYE_DISTANCE * 0.15)
  const size = perspective * cam.scale
  return { sx: spunX * size + cam.x, sy: screenY * size + cam.y, size, depth }
}

/** A camera that shows the whole disc of the given radius, centred, at this tilt. */
export function fitCamera(
  radius: number,
  width: number,
  height: number,
  pitch: number,
  yaw: number,
): Camera {
  // The nearest edge is magnified the most, so that is what has to fit.
  const nearest = EYE_DISTANCE / (EYE_DISTANCE - radius * Math.sin(pitch))
  // Category names sit beside the disc and need room. A narrow (phone) canvas
  // leaves them out, so the disc can use nearly the full width.
  const narrow = width < NARROW_WIDTH
  const roomWide = Math.max(60, width / 2 - (narrow ? 26 : 84))
  const roomTall = Math.max(60, height / 2 - (narrow ? 40 : 64))
  const fitWide = roomWide / (radius * nearest)
  const fitTall = roomTall / (radius * Math.max(Math.cos(pitch), 0.2) * nearest)
  const scale = Math.min(1.4, Math.max(0.12, Math.min(fitWide, fitTall)))
  // Tilting pushes the far half up the screen less than the near half comes
  // down, so nudge the disc up a little to keep it looking centred.
  const nudge = radius * scale * (nearest - 1) * Math.cos(pitch) * 0.5
  return { yaw, pitch, scale, x: width / 2, y: height / 2 - nudge }
}

/** Moves the camera part of the way toward a target, for smooth motion. dt is seconds since the last frame. */
export function easeCamera(current: Camera, target: Camera, dt: number, speed = 7): Camera {
  // 1 - e^(-speed * dt) gives the same smooth motion at any frame rate.
  const k = 1 - Math.exp(-speed * dt)
  const mix = (a: number, b: number) => a + (b - a) * k
  return {
    yaw: mix(current.yaw, target.yaw),
    pitch: mix(current.pitch, target.pitch),
    scale: mix(current.scale, target.scale),
    x: mix(current.x, target.x),
    y: mix(current.y, target.y),
  }
}
