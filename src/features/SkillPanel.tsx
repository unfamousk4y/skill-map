import { demandScore, PREFERRED_WEIGHT, REQUIRED_WEIGHT } from '../domain/score.ts'
import type { Analysis, Quote, SkillFinding, Taxonomy } from '../domain/types.ts'
import type { Scene, SceneNode } from '../map/scene.ts'
import { LearnBox } from './ProgressPanel.tsx'

type Props = {
  analysis: Analysis
  scene: Scene
  taxonomy: Taxonomy
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Open the screen where postings and the resume are pasted. */
  onEdit: () => void
  /**
   * Whose map this is. "own" can be changed; the built-in "sample" and a
   * "shared" link are read-only, and a shared map has no quotes.
   */
  mode: 'own' | 'sample' | 'shared'
  /** Extra sections for the overview: progress, sharing and saved data. */
  extra?: React.ReactNode
  onLearn?: (id: string, url: string) => void
  onUnlearn?: (id: string) => void
}

type Status = { label: string; kind: 'have' | 'gap' | 'stone' }

function statusOf(node: SceneNode, finding?: SkillFinding, shared = false): Status {
  if (finding?.learned) return { label: 'Learned, with proof', kind: 'have' }
  // A shared map belongs to someone else, and says only that a skill is covered.
  if (node.have) return { label: shared ? 'Covered' : 'On your resume', kind: 'have' }
  if (node.steppingStone) return { label: 'Stepping stone', kind: 'stone' }
  return { label: 'Gap', kind: 'gap' }
}

/** "A", "A and B", "A, B and C". */
function listOf(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function Swatch({ kind }: { kind: 'have' | 'gap' | 'next' | 'stone' }) {
  return <span className={`swatch swatch--${kind}`} aria-hidden="true" />
}

function SkillChip({ node, onSelect, shared }: { node: SceneNode; onSelect: (id: string) => void; shared: boolean }) {
  const status = statusOf(node, undefined, shared)
  return (
    <button type="button" className="chip" onClick={() => onSelect(node.id)}>
      <Swatch kind={node.next ? 'next' : status.kind} />
      <span>{node.name}</span>
      <span className="visually-hidden">, {status.label}</span>
    </button>
  )
}

function Quotes({ title, quotes }: { title: string; quotes: Quote[] }) {
  if (quotes.length === 0) return null
  return (
    <section>
      <h3>{title}</h3>
      <ul className="quotes">
        {quotes.map((quote) => (
          <li key={quote.source + quote.text}>
            <blockquote>{quote.text}</blockquote>
            <cite>{quote.source}</cite>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Legend({ shared }: { shared: boolean }) {
  return (
    <section>
      <h3>Reading the map</h3>
      <ul className="legend">
        <li><Swatch kind="have" /> {shared ? 'Covered' : 'On your resume, or marked as learned'}</li>
        <li><Swatch kind="gap" /> {shared ? 'Asked for, not covered' : 'Asked for, not on your resume'}</li>
        <li><Swatch kind="next" /> Best to learn next</li>
        <li><Swatch kind="stone" /> Stepping stone toward a wanted skill</li>
      </ul>
      <p className="muted">
        The number in a circle is how many postings ask for that skill, and bigger circles are
        asked for more. Rings run from foundations in the middle to advanced skills at the edge.
        Lines join a skill to what it builds on.
      </p>
    </section>
  )
}

/** How this map was produced, and anything the person should know about its reliability. */
function AboutResult({ analysis }: { analysis: Analysis }) {
  const nothingToSay =
    analysis.method === 'dictionary' && analysis.notes.length === 0 && analysis.rejectedMentions === 0
  if (nothingToSay) return null
  return (
    <section>
      <h3>About this result</h3>
      <p className="muted">
        {analysis.method === 'claude'
          ? 'Read by Claude. Every quote was checked word for word against your text.'
          : 'Read by the free matcher, which finds skills that are named outright.'}
      </p>
      {analysis.rejectedMentions > 0 && (
        <p className="muted">
          {analysis.rejectedMentions} {analysis.rejectedMentions === 1 ? 'finding was' : 'findings were'} left out
          because the quote did not match your text exactly.
        </p>
      )}
      {analysis.notes.length > 0 && (
        <ul className="notes">
          {analysis.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      {analysis.otherSkills.length > 0 && (
        <p className="muted">
          Also mentioned, but not on this tool's list yet: {analysis.otherSkills.join(', ')}.
        </p>
      )}
    </section>
  )
}

function Overview({ analysis, scene, onSelect, onEdit, mode, extra }: Omit<Props, 'selectedId' | 'taxonomy'>) {
  const next = analysis.next.map((id) => scene.byId.get(id)).filter((n) => n !== undefined)
  const asked = scene.nodes.filter((n) => n.demand > 0)

  // Nothing to draw: say why, and what to do about it.
  if (asked.length === 0) {
    return (
      <section>
        <h2>No skills found</h2>
        <p>
          {analysis.postings.length === 0
            ? 'There are no postings to read yet.'
            : 'None of the skills this tool knows were named in those postings. It covers software, data and AI roles, and it only spots skills that are named outright.'}
        </p>
        {mode !== 'shared' && (
          <button type="button" className="primary" onClick={onEdit}>
            Edit the postings
          </button>
        )}
        {extra}
      </section>
    )
  }

  return (
    <>
      <section>
        <h2>Learn next</h2>
        {next.length > 0 ? (
          <>
            <p className="muted">
              Skills you can start today, ranked by how many postings want them and what they lead to.
            </p>
            <ol className="next-list">
              {next.map((node) => {
                const unlocks = (analysis.unlocks[node.id] ?? []).map((id) => scene.byId.get(id)?.name ?? id)
                return (
                  <li key={node.id}>
                    <button type="button" onClick={() => onSelect(node.id)}>
                      <span className="next-list__name">{node.name}</span>
                      <span className="muted">
                        {node.demand > 0
                          ? `${node.demand} of ${analysis.postings.length} postings`
                          : 'Stepping stone'}
                      </span>
                      {unlocks.length > 0 && (
                        <span className="next-list__why muted">Leads to {listOf(unlocks.slice(0, 3))}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </>
        ) : (
          <p>
            {mode === 'shared'
              ? 'Every skill these postings name is covered.'
              : 'You already have every skill these postings name.'}
          </p>
        )}
      </section>
      <Legend shared={mode === 'shared'} />
      {extra}
      {mode === 'shared' ? (
        <section>
          <h3>About this map</h3>
          <p className="muted">
            Someone shared this with you. A shared map holds skills and counts only, so there are no quotes to
            show, and you cannot change it.
          </p>
        </section>
      ) : (
        <AboutResult analysis={analysis} />
      )}
    </>
  )
}

function Detail({
  analysis,
  scene,
  taxonomy,
  node,
  onSelect,
  mode,
  onLearn,
  onUnlearn,
}: Omit<Props, 'selectedId' | 'onEdit' | 'extra'> & { node: SceneNode }) {
  const finding = analysis.findings.find((f) => f.id === node.id)
  const skill = taxonomy.byId.get(node.id)
  const category = taxonomy.categories.find((c) => c.id === node.cat)?.name ?? node.cat
  const status = statusOf(node, finding, mode === 'shared')
  // Only your own map can be changed, and only a skill the resume does not already name.
  const canLearn = mode === 'own' && onLearn && onUnlearn && (finding?.learned || !node.have || finding?.impliedBy)
  const buildsOn = (skill?.pre ?? []).map((id) => scene.byId.get(id)).filter((n) => n !== undefined)
  const leadsTo = scene.edges
    .filter((e) => e.from === node.id)
    .map((e) => scene.byId.get(e.to))
    .filter((n) => n !== undefined)
  const required = finding?.required ?? 0
  const preferred = finding?.preferred ?? 0
  const position = analysis.learningOrder.indexOf(node.id)

  return (
    <>
      <header className="detail__head">
        <div>
          <p className="eyebrow">{category}</p>
          <h2>{node.name}</h2>
        </div>
        <button type="button" className="quiet" onClick={() => onSelect(null)}>
          Close
        </button>
      </header>

      <p className={`status status--${status.kind}`}>
        <Swatch kind={status.kind} /> {status.label}
        {node.next && <span className="status__next"> · Learn next</span>}
      </p>

      {finding?.impliedBy && (
        <p>
          {mode === 'shared' ? 'This is not named, but the map shows' : 'Your resume does not name this, but you have'}{' '}
          {listOf(finding.impliedBy)}, which{' '}
          {finding.impliedBy.length === 1 ? 'builds' : 'build'} on it.
        </p>
      )}

      {finding?.addedByYou && (
        <p className="muted">You added this yourself when reviewing the keywords, so not every count has a quote.</p>
      )}

      {node.demand > 0 ? (
        <>
          <p>
            Asked for by <strong>{node.demand} of {analysis.postings.length}</strong> postings.
          </p>
          {/* The arithmetic, written out so it can be checked. */}
          <p className="sum">
            <span>Demand score</span>
            <span>
              {required} required × {REQUIRED_WEIGHT} + {preferred} preferred × {PREFERRED_WEIGHT} ={' '}
              <strong>{demandScore({ required, preferred })}</strong>
            </span>
          </p>
        </>
      ) : (
        <p>No posting asks for this directly. It is on the map because other skills build on it.</p>
      )}

      {position >= 0 && (
        <p className="muted">
          Step {position + 1} of {analysis.learningOrder.length} in {mode === 'shared' ? 'the' : 'your'} learning order.
        </p>
      )}

      {canLearn && (
        // The key gives each skill its own form, so half-typed text never carries over.
        <LearnBox
          key={node.id}
          skillName={node.name}
          proof={finding?.learned}
          onLearn={(url) => onLearn(node.id, url)}
          onUnlearn={() => onUnlearn(node.id)}
        />
      )}

      <Quotes title="From the postings" quotes={finding?.postingQuotes ?? []} />
      <Quotes title="From your resume" quotes={finding?.resumeQuotes ?? []} />

      {buildsOn.length > 0 && (
        <section>
          <h3>Builds on</h3>
          <div className="chips">
            {buildsOn.map((n) => <SkillChip key={n.id} node={n} onSelect={onSelect} shared={mode === 'shared'} />)}
          </div>
        </section>
      )}
      {leadsTo.length > 0 && (
        <section>
          <h3>Leads to</h3>
          <div className="chips">
            {leadsTo.map((n) => <SkillChip key={n.id} node={n} onSelect={onSelect} shared={mode === 'shared'} />)}
          </div>
        </section>
      )}
    </>
  )
}

export function SkillPanel(props: Props) {
  const node = props.selectedId ? props.scene.byId.get(props.selectedId) : undefined
  return (
    <aside className="panel" aria-label={node ? `${node.name} details` : 'Map overview'}>
      {/* aria-live makes a screen reader announce the new skill when the selection changes */}
      <div className="panel__body" aria-live="polite">
        {node ? <Detail {...props} node={node} /> : <Overview {...props} />}
      </div>
    </aside>
  )
}
