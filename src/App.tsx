import { useCallback, useEffect, useMemo, useState } from 'react'
import { sampleLabel, samplePostings, sampleResume } from './data/sampleTexts.ts'
import { taxonomy } from './domain/taxonomy.ts'
import type { Analysis } from './domain/types.ts'
import { analyseWithClaude, ClaudeUnavailable, type Progress } from './extract/claude.ts'
import { analyseWithDictionary } from './extract/dictionary.ts'
import { BenchScreen } from './features/BenchScreen.tsx'
import { IntakeScreen, type Draft, type Method } from './features/IntakeScreen.tsx'
import { ListView } from './features/ListView.tsx'
import { SkillPanel } from './features/SkillPanel.tsx'
import { MapCanvas } from './map/MapCanvas.tsx'
import { buildScene } from './map/scene.ts'

const sample: Draft = { postings: samplePostings, resume: sampleResume }

/** The developer speed test lives at ?bench. Everything else is the app. */
export function App() {
  return new URLSearchParams(window.location.search).has('bench') ? <BenchScreen /> : <SkillMapApp />
}

/**
 * Asks our own server whether Claude mode is set up. On the public site there
 * is no server, the request gets a web page back instead of JSON, and the
 * answer is simply "no".
 */
async function claudeIsAvailable(): Promise<boolean> {
  try {
    const status = (await (await fetch('/api/status')).json()) as { claude?: unknown }
    return status.claude === true
  } catch {
    return false
  }
}

function SkillMapApp() {
  // null means "showing the built-in fictional sample".
  const [own, setOwn] = useState<{ draft: Draft; analysis: Analysis; build: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [claudeAvailable, setClaudeAvailable] = useState(false)
  /** Set while Claude is reading documents. */
  const [progress, setProgress] = useState<Progress | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)

  // The sample is plain text run through the free matcher. It takes a few milliseconds.
  const sampleAnalysis = useMemo(
    () => analyseWithDictionary({ label: sampleLabel, fictional: true, ...sample }, taxonomy),
    [],
  )
  const analysis = own?.analysis ?? sampleAnalysis
  const scene = useMemo(() => buildScene(analysis, taxonomy), [analysis])

  // Escape closes the detail view from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openEditor = useCallback(() => {
    setEditing(true)
    setBuildError(null)
    // Checked each time the form opens, so adding an API key needs no reload.
    void claudeIsAvailable().then(setClaudeAvailable)
  }, [])

  const asked = scene.nodes.filter((n) => n.demand > 0)
  const covered = asked.filter((n) => n.have).length

  const build = async (draft: Draft, method: Method) => {
    const inputs = { label: 'Your postings and resume', fictional: false, ...draft }
    const show = (result: Analysis) => {
      setOwn((previous) => ({ draft, analysis: result, build: (previous?.build ?? 0) + 1 }))
      setSelectedId(null)
      setEditing(false)
    }
    setBuildError(null)

    if (method === 'dictionary') {
      show(analyseWithDictionary(inputs, taxonomy))
      return
    }

    setProgress({ done: 0, total: 0, current: '' })
    try {
      show(await analyseWithClaude(inputs, taxonomy, undefined, setProgress))
    } catch (error) {
      // The form stays open with the person's text untouched, so nothing is lost.
      setBuildError(
        error instanceof ClaudeUnavailable
          ? `${error.message} Your text is still here: you can build with the free matcher instead.`
          : 'Something went wrong while building the map. Your text is still here, so you can try again.',
      )
    } finally {
      setProgress(null)
    }
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
          <p>
            {analysis.label}
            {analysis.method === 'claude' && ' · read by Claude'}
          </p>
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
              <button type="button" className="primary" onClick={openEditor}>
                {own ? 'Edit my text' : 'Use my own postings'}
              </button>
            </div>
          </>
        )}
      </header>

      {editing ? (
        <main className="stage stage--single">
          <IntakeScreen
            initial={own?.draft ?? { postings: [''], resume: '' }}
            claudeAvailable={claudeAvailable}
            progress={progress}
            serverError={buildError}
            onBuild={build}
            onCancel={() => setEditing(false)}
          />
        </main>
      ) : (
        <main className="stage">
          {view === 'map' ? (
            // The key makes a new map, with its opening animation, for each new analysis.
            <MapCanvas
              key={own ? `own-${own.build}` : 'sample'}
              scene={scene}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <ListView analysis={analysis} taxonomy={taxonomy} selectedId={selectedId} onSelect={setSelectedId} />
          )}
          <SkillPanel
            analysis={analysis}
            scene={scene}
            taxonomy={taxonomy}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={openEditor}
          />
        </main>
      )}
    </div>
  )
}
