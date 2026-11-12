import { useCallback, useEffect, useMemo, useState } from 'react'
import { sampleLabel, samplePostings, sampleResume } from './data/sampleTexts.ts'
import { analysisFromSnapshot, applyLearned, snapshotOf } from './domain/progress.ts'
import { decodeShare, encodeShare, SHARE_PREFIX, shareFromHash } from './domain/share.ts'
import { taxonomy } from './domain/taxonomy.ts'
import type { Analysis, Learned, Snapshot } from './domain/types.ts'
import { ClaudeUnavailable, extractWithClaude, type Progress } from './extract/claude.ts'
import { analyseWithDictionary, extractWithDictionary } from './extract/dictionary.ts'
import { analysisFromExtraction, docKey, type Corrections, type Extraction } from './extract/extraction.ts'
import { BenchScreen } from './features/BenchScreen.tsx'
import { IntakeScreen, type Draft, type Method } from './features/IntakeScreen.tsx'
import { ListView } from './features/ListView.tsx'
import { ProgressPanel } from './features/ProgressPanel.tsx'
import { ReviewScreen } from './features/ReviewScreen.tsx'
import { SkillPanel } from './features/SkillPanel.tsx'
import { MapCanvas } from './map/MapCanvas.tsx'
import { buildScene } from './map/scene.ts'
import { deleteSaved, loadSaved, writeSaved } from './storage/browserStore.ts'
import { MAX_SNAPSHOTS, SAVED_VERSION, type SavedState } from './storage/saved.ts'

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
  // The published site is static files with no server, so it does not even ask.
  if (!import.meta.env.DEV) return false
  try {
    const status = (await (await fetch('/api/status')).json()) as { claude?: unknown }
    return status.claude === true
  } catch {
    return false
  }
}

/** The person's own map: their text, and what an extractor made of it. */
type Own = {
  draft: Draft
  method: Method
  /** What the extractor found in each document, before the student's corrections. */
  extraction: Extraction
  /** Goes up with each build, so the map replays its opening animation. */
  build: number
}

/**
 * A share link puts the whole map after the "#" in the address. Read once,
 * when the page opens. "damaged" means it looked like a share link but could
 * not be read.
 */
function readShareLink(): Analysis | 'damaged' | null {
  const text = shareFromHash(window.location.hash)
  if (text === null) return null
  const snapshot = decodeShare(text, taxonomy)
  return snapshot ? analysisFromSnapshot(snapshot, 'Shared map', taxonomy) : 'damaged'
}

const OWN_LABEL = { label: 'Your postings and resume', fictional: false }

const SAVE_FAILED =
  'This browser would not save your data, so it will be gone when you close the page. Private windows often block saving.'
const DELETE_FAILED =
  "This browser would not delete the saved data. Clear this site's data in your browser settings."

function SkillMapApp() {
  // null means nothing of the person's own has been built or saved yet.
  const [own, setOwn] = useState<Own | null>(null)
  const [learned, setLearned] = useState<Learned>({})
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  /** False until saved data has been looked for. Nothing is written before then. */
  const [loaded, setLoaded] = useState(false)
  const [saveProblem, setSaveProblem] = useState<string | null>(null)
  const [shared, setShared] = useState(readShareLink)
  /** True when the person chose to look at the sample although they have their own map. */
  const [showingSample, setShowingSample] = useState(false)
  /** What the student changed when reviewing the keywords, by document. */
  const [corrections, setCorrections] = useState<Corrections>({})
  /** Set while the "keywords found, are they right?" step is on screen. */
  const [review, setReview] = useState<{ draft: Draft; method: Method; extraction: Extraction } | null>(null)
  /** Text that was read but whose review was not finished, so "back" does not lose it. */
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null)
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
  // Learned marks are laid over the saved analysis each time, never baked into it.
  // Built in layers, each time from what the extractor found: first the
  // student's corrections, then the skills marked as learned. Neither layer
  // changes the one under it, so both can be undone.
  const ownAnalysis = useMemo(
    () =>
      own
        ? applyLearned(analysisFromExtraction(own.extraction, corrections, OWN_LABEL, taxonomy), learned, taxonomy)
        : null,
    [own, corrections, learned],
  )
  const sharedAnalysis = shared !== null && shared !== 'damaged' ? shared : null
  const mode: 'own' | 'sample' | 'shared' = sharedAnalysis ? 'shared' : ownAnalysis && !showingSample ? 'own' : 'sample'
  const analysis = sharedAnalysis ?? (mode === 'own' ? ownAnalysis! : sampleAnalysis)
  const scene = useMemo(() => buildScene(analysis, taxonomy), [analysis])

  // On opening the page: bring back whatever was saved last time.
  useEffect(() => {
    let cancelled = false
    loadSaved()
      .then((saved) => {
        if (cancelled || !saved) return
        // The free matcher simply reads the text again. Claude's findings were saved.
        const extraction = saved.claudeExtraction ?? extractWithDictionary({ ...OWN_LABEL, ...saved.draft }, taxonomy)
        setOwn({ draft: saved.draft, method: saved.method, extraction, build: 1 })
        setCorrections(saved.corrections)
        setLearned(saved.learned)
        setSnapshots(saved.snapshots)
      })
      .catch(() => setSaveProblem(SAVE_FAILED))
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Save after every change. Waits for the load above, so an empty start
  // never overwrites what was saved.
  useEffect(() => {
    if (!loaded || !own) return
    const state: SavedState = {
      version: SAVED_VERSION,
      draft: own.draft,
      method: own.method,
      claudeExtraction: own.method === 'claude' ? own.extraction : null,
      corrections,
      learned,
      snapshots,
    }
    writeSaved(state)
      .then(() => setSaveProblem(null))
      .catch(() => setSaveProblem(SAVE_FAILED))
  }, [loaded, own, corrections, learned, snapshots])

  // Pasting a different share link into the same tab changes only the "#" part,
  // which does not reload the page by itself.
  useEffect(() => {
    const onHash = () => window.location.reload()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
    const inputs = { ...OWN_LABEL, ...draft }
    // Reading the text does not build the map yet: the student checks the findings first.
    const show = (extraction: Extraction) => setReview({ draft, method, extraction })
    setBuildError(null)

    if (method === 'dictionary') {
      show(extractWithDictionary(inputs, taxonomy))
      return
    }

    setProgress({ done: 0, total: 0, current: '' })
    try {
      show(await extractWithClaude(inputs, taxonomy, undefined, setProgress))
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

  /** The student is happy with the keywords: build the map from them. */
  const confirmReview = (reviewed: Corrections) => {
    if (!review) return
    const { draft, method, extraction } = review
    // Keep corrections only for documents that are still part of the map.
    const keys = new Set(extraction.documents.map(docKey))
    setCorrections(Object.fromEntries(Object.entries(reviewed).filter(([key]) => keys.has(key))))
    setOwn((previous) => ({ draft, method, extraction, build: (previous?.build ?? 0) + 1 }))
    setShowingSample(false)
    setSelectedId(null)
    setEditing(false)
    setReview(null)
    setPendingDraft(null)
  }

  /** Opens the review step again for the map on screen. Reads nothing again, so it is free. */
  const reviewAgain = () => {
    if (own) setReview({ draft: own.draft, method: own.method, extraction: own.extraction })
  }

  const toggleSample = () => {
    setShowingSample((showing) => !showing)
    setSelectedId(null)
  }

  /** Leaves a shared map for the person's own one, clearing the link from the address bar. */
  const leaveShared = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setShared(null)
    setSelectedId(null)
  }

  const learn = (id: string, url: string) =>
    setLearned((marks) => ({ ...marks, [id]: { url, at: new Date().toISOString() } }))
  const unlearn = (id: string) =>
    setLearned((marks) => Object.fromEntries(Object.entries(marks).filter(([key]) => key !== id)))

  const saveSnapshot = () =>
    setSnapshots((list) => [...list, snapshotOf(analysis, new Date().toISOString())].slice(-MAX_SNAPSHOTS))
  const deleteSnapshot = (index: number) => setSnapshots((list) => list.filter((_, i) => i !== index))

  /** Hands the person a file with everything this app has saved about them. */
  const exportData = () => {
    if (!own) return
    const data = { exported: new Date().toISOString(), draft: own.draft, method: own.method, learned, snapshots }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'skill-map-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const deleteAll = () => {
    setOwn(null)
    setCorrections({})
    setLearned({})
    setSnapshots([])
    setSelectedId(null)
    deleteSaved().catch(() => setSaveProblem(DELETE_FAILED))
  }

  if (shared === 'damaged') {
    return (
      <div className="app">
        <header className="top">
          <div className="top__title">
            <h1>Skill Map</h1>
          </div>
        </header>
        <main className="stage stage--single">
          <div className="notice">
            <h2>This share link could not be read</h2>
            <p>
              Part of it is missing or changed. Links often break when they are cut short by a message app. Ask for
              it again, and copy the whole thing.
            </p>
            <button type="button" className="primary" onClick={leaveShared}>
              Open Skill Map
            </button>
          </div>
        </main>
      </div>
    )
  }

  const shareUrl =
    window.location.origin + window.location.pathname + SHARE_PREFIX + encodeShare(snapshotOf(analysis, ''))

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
        {!editing && !review && (
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
            {mode === 'shared' && <p className="badge">Shared with you · read-only</p>}
            <div className="switch" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
                Map
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                List
              </button>
            </div>
            <div className="top__actions">
              {mode === 'shared' ? (
                <button type="button" className="primary" onClick={leaveShared}>
                  {own ? 'Back to my map' : 'Make my own map'}
                </button>
              ) : (
                <>
                  {own && (
                    <button type="button" className="quiet" onClick={toggleSample}>
                      {showingSample ? 'Back to my map' : 'Show the sample'}
                    </button>
                  )}
                  {mode === 'own' && (
                    <button type="button" className="quiet" onClick={reviewAgain}>
                      Review keywords
                    </button>
                  )}
                  <button type="button" className="primary" onClick={openEditor}>
                    {own ? 'Edit my text' : 'Use my own postings'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </header>

      {review ? (
        <main className="stage stage--single">
          <ReviewScreen
            extraction={review.extraction}
            initial={corrections}
            taxonomy={taxonomy}
            onConfirm={confirmReview}
            onBack={() => {
              // Back to the form, with the text that was just read still in it.
              setPendingDraft(review.draft)
              setReview(null)
              openEditor()
            }}
          />
        </main>
      ) : editing ? (
        <main className="stage stage--single">
          <IntakeScreen
            initial={pendingDraft ?? own?.draft ?? { postings: [''], resume: '' }}
            claudeAvailable={claudeAvailable}
            progress={progress}
            serverError={buildError}
            onBuild={build}
            onCancel={() => {
              setPendingDraft(null)
              setEditing(false)
            }}
          />
        </main>
      ) : !loaded && mode === 'sample' ? (
        // Looking for saved data takes a moment. Waiting avoids flashing the sample first.
        <main className="stage stage--single">
          <p className="muted" role="status">
            Loading…
          </p>
        </main>
      ) : (
        <main className="stage">
          {view === 'map' ? (
            // The key makes a new map, with its opening animation, for each new analysis.
            <MapCanvas
              key={mode === 'own' ? `own-${own!.build}` : mode}
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
            mode={mode}
            onLearn={learn}
            onUnlearn={unlearn}
            extra={
              mode === 'own' && (
                <ProgressPanel
                  taxonomy={taxonomy}
                  current={snapshotOf(analysis, '')}
                  snapshots={snapshots}
                  onSaveSnapshot={saveSnapshot}
                  onDeleteSnapshot={deleteSnapshot}
                  shareUrl={shareUrl}
                  onExport={exportData}
                  onDeleteAll={deleteAll}
                  saveProblem={saveProblem}
                />
              )
            }
          />
        </main>
      )}
    </div>
  )
}
