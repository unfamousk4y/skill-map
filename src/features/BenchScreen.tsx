// Developer page, reached by adding ?bench to the address. Not linked from the app.

import { useRef, useState } from 'react'
import { measureScene, syntheticScene, type BenchResult } from '../map/benchmark.ts'
import { readTheme } from '../map/theme.ts'

const SIZES = [60, 200, 500, 1000]
const WIDTH = 1280
const HEIGHT = 720

export function BenchScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [results, setResults] = useState<BenchResult[]>([])
  const [running, setRunning] = useState(false)

  const run = async () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setRunning(true)
    setResults([])
    const theme = readTheme()
    const done: BenchResult[] = []
    for (const count of SIZES) {
      done.push(await measureScene(ctx, WIDTH, HEIGHT, syntheticScene(count), theme))
      setResults([...done])
    }
    setRunning(false)
  }

  const ms = (value: number) => value.toFixed(1)

  return (
    <main className="bench">
      <h1>Map drawing speed</h1>
      <p className="muted">
        Draws made-up maps of different sizes at {WIDTH} × {HEIGHT} pixels with the camera turning. A real
        map has 40 to 80 skills. Numbers depend on this device and browser.
      </p>
      <ul className="muted">
        <li>
          <strong>Our code</strong> is the time the drawing code runs per frame. A 60 fps screen allows
          16.7 ms in total.
        </li>
        <li>
          <strong>On screen</strong> is the real gap between frames the browser showed. About 16.7 ms
          means a steady 60 fps. Keep this window visible while it runs.
        </li>
      </ul>
      <p>
        <button type="button" className="primary" onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run the measurement'}
        </button>
      </p>
      <p role="status">{running ? 'Measuring. This takes about 15 seconds.' : ''}</p>
      {results.length > 0 && (
        <table className="list__table">
          <caption>Milliseconds per frame</caption>
          <thead>
            <tr>
              <th scope="col" className="num">Skills</th>
              <th scope="col" className="num">Lines</th>
              <th scope="col" className="num">Our code, average</th>
              <th scope="col" className="num">Our code, slow</th>
              <th scope="col" className="num">On screen, typical</th>
              <th scope="col" className="num">On screen, slow</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.nodes}>
                <td className="num">{r.nodes}</td>
                <td className="num">{r.edges}</td>
                <td className="num">{r.script.mean.toFixed(2)}</td>
                <td className="num">{ms(r.script.p95)}</td>
                <td className="num">{r.live ? ms(r.live.median) : 'not shown'}</td>
                <td className="num">{r.live ? ms(r.live.p95) : 'not shown'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="bench__canvas" aria-hidden="true" />
    </main>
  )
}
