import { useEffect, useMemo, useState } from 'react'
import { sampleLabel, samplePostings, sampleResume } from './data/sampleTexts.ts'
import { taxonomy } from './domain/taxonomy.ts'
import { analyseWithDictionary } from './extract/dictionary.ts'
import { BenchScreen } from './features/BenchScreen.tsx'
import { IntakeScreen, type Draft } from './features/IntakeScreen.tsx'
import { ListView } from './features/ListView.tsx'
import { SkillPanel } from './features/SkillPanel.tsx'
import { MapCanvas } from './map/MapCanvas.tsx'
import { buildScene } from './map/scene.ts'

const sample: Draft = { postings: samplePostings, resume: sampleResume }

/** The developer speed test lives at ?bench. Everything else is the app. */
export function App() {
  return new URLSearchParams(window.location.search).has('bench') ? <BenchScreen /> : <SkillMapApp />
}

function SkillMapApp() {
  // null means "showing the built-in fictional sample".
  const [own, setOwn] = useState<Draft | null>(null)
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'map' | 'list'>('map')

  // The whole analysis is recomputed from the text. It takes a few
  // milliseconds, so there is no need to store the result anywhere.
  const analysis = useMemo(
    () =>
      analyseWithDictionary(
        own
          ? { label: 'Your postings and resume', fictional: false, ...own }
          : { label: sampleLabel, fictional: true, ...sample },
        taxonomy,
      ),
    [own],
  )
  const scene = useMemo(() => buildScene(analysis, taxonomy), [analysis])

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

  const build = (draft: Draft) => {
    setOwn(draft)
    setSelectedId(null)
    setEditing(false)
  }

  const showSample = () => {
    setOwn(null)
    setSelectedId(null)
  }

  return (
    <div className="app">
      <header className="top">
        <div className="top__title">
          <h1>Skill Map</h1>
          <p>{analysis.label}</p>
        </div>
        {!editing && (
          <>
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
            <div className="switch" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
                Map
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                List
              </button>
            </div>
            <div className="top__actions">
              {own && (
                <button type="button" className="quiet" onClick={showSample}>
                  Show the sample
                </button>
              )}
              <button type="button" className="primary" onClick={() => setEditing(true)}>
                {own ? 'Edit my text' : 'Use my own postings'}
              </button>
            </div>
          </>
        )}
      </header>

      {editing ? (
        <main className="stage stage--single">
          <IntakeScreen
            initial={own ?? { postings: [''], resume: '' }}
            onBuild={build}
            onCancel={() => setEditing(false)}
          />
        </main>
      ) : (
        <main className="stage">
          {view === 'map' ? (
            // The key makes a new map, with its opening animation, for each new analysis.
            <MapCanvas key={own ? 'own' : 'sample'} scene={scene} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <ListView analysis={analysis} taxonomy={taxonomy} selectedId={selectedId} onSelect={setSelectedId} />
          )}
          <SkillPanel
            analysis={analysis}
            scene={scene}
            taxonomy={taxonomy}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={() => setEditing(true)}
          />
        </main>
      )}
    </div>
  )
}
