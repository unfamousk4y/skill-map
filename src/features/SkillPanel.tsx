import type { Scene, SceneNode } from '../map/scene.ts'
import type { Analysis, Quote, Taxonomy } from '../domain/types.ts'

type Props = {
  analysis: Analysis
  scene: Scene
  taxonomy: Taxonomy
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function statusOf(node: SceneNode): { label: string; kind: 'have' | 'gap' | 'stone' } {
  if (node.have) return { label: 'On your resume', kind: 'have' }
  if (node.steppingStone) return { label: 'Stepping stone', kind: 'stone' }
  return { label: 'Gap', kind: 'gap' }
}

function Swatch({ kind }: { kind: 'have' | 'gap' | 'next' | 'stone' }) {
  return <span className={`swatch swatch--${kind}`} aria-hidden="true" />
}

function SkillChip({ node, onSelect }: { node: SceneNode; onSelect: (id: string) => void }) {
  const status = statusOf(node)
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

function Overview({ analysis, scene, onSelect }: Omit<Props, 'selectedId' | 'taxonomy'>) {
  const next = analysis.next.map((id) => scene.byId.get(id)).filter((n) => n !== undefined)
  return (
    <>
      <section>
        <h2>Learn next</h2>
        <p className="muted">
          The gaps that the most postings ask for and that you are ready to start.
        </p>
        <ol className="next-list">
          {next.map((node) => (
            <li key={node.id}>
              <button type="button" onClick={() => onSelect(node.id)}>
                <span className="next-list__name">{node.name}</span>
                <span className="muted">
                  {node.demand} of {analysis.postings.length} postings
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>Reading the map</h3>
        <ul className="legend">
          <li><Swatch kind="have" /> On your resume</li>
          <li><Swatch kind="gap" /> Asked for, not on your resume</li>
          <li><Swatch kind="next" /> Best to learn next</li>
          <li><Swatch kind="stone" /> Stepping stone toward a wanted skill</li>
        </ul>
        <p className="muted">
          The number in a circle is how many postings ask for that skill, and bigger circles are
          asked for more. Rings run from foundations in the middle to advanced skills at the edge.
          Lines join a skill to what it builds on.
        </p>
      </section>
    </>
  )
}

function Detail({ analysis, scene, taxonomy, node, onSelect }: Omit<Props, 'selectedId'> & { node: SceneNode }) {
  const finding = analysis.findings.find((f) => f.id === node.id)
  const skill = taxonomy.byId.get(node.id)
  const category = taxonomy.categories.find((c) => c.id === node.cat)?.name ?? node.cat
  const status = statusOf(node)
  const buildsOn = (skill?.pre ?? []).map((id) => scene.byId.get(id)).filter((n) => n !== undefined)
  const unlocks = scene.edges
    .filter((e) => e.from === node.id)
    .map((e) => scene.byId.get(e.to))
    .filter((n) => n !== undefined)
  const hasQuotes = (finding?.postingQuotes.length ?? 0) + (finding?.resumeQuotes.length ?? 0) > 0

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

      {node.demand > 0 ? (
        <p>
          Asked for by <strong>{node.demand} of {analysis.postings.length}</strong> postings:{' '}
          {finding?.required ?? 0} required, {finding?.preferred ?? 0} preferred.
        </p>
      ) : (
        <p>No posting asks for this directly. It is on the map because other skills build on it.</p>
      )}

      <Quotes title="From the postings" quotes={finding?.postingQuotes ?? []} />
      <Quotes title="From your resume" quotes={finding?.resumeQuotes ?? []} />
      {!hasQuotes && node.demand > 0 && (
        <p className="muted">No quotes were written for this skill in the sample data.</p>
      )}

      {buildsOn.length > 0 && (
        <section>
          <h3>Builds on</h3>
          <div className="chips">
            {buildsOn.map((n) => <SkillChip key={n.id} node={n} onSelect={onSelect} />)}
          </div>
        </section>
      )}
      {unlocks.length > 0 && (
        <section>
          <h3>Leads to</h3>
          <div className="chips">
            {unlocks.map((n) => <SkillChip key={n.id} node={n} onSelect={onSelect} />)}
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
