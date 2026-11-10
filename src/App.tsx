import { useEffect, useMemo, useState } from 'react'
import { sampleAnalysis } from './data/sampleAnalysis.ts'
import { taxonomy } from './domain/taxonomy.ts'
import { SkillPanel } from './features/SkillPanel.tsx'
import { MapCanvas } from './map/MapCanvas.tsx'
import { buildScene } from './map/scene.ts'

export function App() {
  const analysis = sampleAnalysis
  const scene = useMemo(() => buildScene(analysis, taxonomy), [analysis])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Escape closes the detail view from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const asked = scene.nodes.filter((n) => n.demand > 0)
  const covered = asked.filter((n) => n.have).length

  return (
    <div className="app">
      <header className="top">
        <div className="top__title">
          <h1>Skill Map</h1>
          <p>{analysis.label}</p>
        </div>
        <dl className="top__stats">
          <div>
            <dt>Postings</dt>
            <dd>{analysis.postings.length}</dd>
          </div>
          <div>
            <dt>Skills covered</dt>
            <dd>
              {covered}
              <span> of {asked.length}</span>
            </dd>
          </div>
        </dl>
        {analysis.fictional && <p className="badge">Fictional sample data</p>}
      </header>
      <main className="stage">
        <MapCanvas scene={scene} selectedId={selectedId} onSelect={setSelectedId} />
        <SkillPanel
          analysis={analysis}
          scene={scene}
          taxonomy={taxonomy}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
    </div>
  )
}
