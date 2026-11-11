// The same information as the map, as plain tables. This is the version for
// screen readers, for anyone who finds the map hard to use, and for when you
// just want to scan a list.

import { demandScore } from '../domain/score.ts'
import type { Analysis, SkillFinding, Taxonomy } from '../domain/types.ts'

type Props = {
  analysis: Analysis
  taxonomy: Taxonomy
  selectedId: string | null
  onSelect: (id: string) => void
}

type Row = {
  id: string
  name: string
  category: string
  required: number
  preferred: number
  score: number
  note: string
}

export function ListView({ analysis, taxonomy, selectedId, onSelect }: Props) {
  const findings = new Map(analysis.findings.map((f) => [f.id, f]))
  const categoryName = new Map(taxonomy.categories.map((c) => [c.id, c.name]))
  const next = new Set(analysis.next)

  const row = (id: string, note: string): Row => {
    const skill = taxonomy.byId.get(id)
    const f: Pick<SkillFinding, 'required' | 'preferred'> = findings.get(id) ?? { required: 0, preferred: 0 }
    return {
      id,
      name: skill?.name ?? id,
      category: categoryName.get(skill?.cat ?? '') ?? '',
      required: f.required,
      preferred: f.preferred,
      score: demandScore(f),
      note,
    }
  }

  // To learn: already in a sensible order, from the ranking step.
  const toLearn = analysis.learningOrder.map((id) => {
    const asked = (findings.get(id)?.required ?? 0) + (findings.get(id)?.preferred ?? 0) > 0
    return row(id, next.has(id) ? 'Learn next' : asked ? 'Gap' : 'Stepping stone')
  })

  // Have: most asked-for first.
  const have = analysis.findings
    .filter((f) => f.have)
    .map((f) =>
      row(
        f.id,
        f.learned
          ? 'Marked as learned'
          : f.impliedBy
            ? `Implied by ${f.impliedBy.join(', ')}`
            : // A shared map has no quotes, so all it can say is that the skill is covered.
              f.resumeQuotes.length > 0
              ? 'Named on your resume'
              : 'Covered',
      ),
    )
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  if (toLearn.length === 0 && have.length === 0) {
    return (
      <div className="list">
        <p className="muted">There are no skills to list yet.</p>
      </div>
    )
  }

  const table = (caption: string, rows: Row[], numbered: boolean, noteHeading: string) => (
    <table className="list__table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {numbered && <th scope="col" className="num">Step</th>}
          <th scope="col">Skill</th>
          <th scope="col">Category</th>
          <th scope="col" className="num">Required</th>
          <th scope="col" className="num">Preferred</th>
          <th scope="col" className="num">Score</th>
          <th scope="col">{noteHeading}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, index) => (
          <tr key={r.id} className={r.id === selectedId ? 'is-selected' : undefined}>
            {numbered && <td className="num">{index + 1}</td>}
            <th scope="row">
              <button type="button" onClick={() => onSelect(r.id)} aria-current={r.id === selectedId || undefined}>
                {r.name}
              </button>
            </th>
            <td>{r.category}</td>
            <td className="num">{r.required}</td>
            <td className="num">{r.preferred}</td>
            <td className="num">{r.score}</td>
            <td className={r.note === 'Learn next' ? 'list__next' : undefined}>{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="list">
      <p className="muted">
        Required and Preferred count postings out of {analysis.postings.length}. Score is required × 1 +
        preferred × 0.5. Choose a skill to see its quotes.
      </p>
      {toLearn.length > 0 && table(`To learn, in order (${toLearn.length})`, toLearn, true, 'Kind')}
      {have.length > 0 && table(`Already covered (${have.length})`, have, false, 'How we know')}
    </div>
  )
}
