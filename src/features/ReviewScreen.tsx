// "Keywords found. Are they right?" The step between reading the text and
// building the map. The student sees each document with the found words
// highlighted in place, and can remove a wrong finding, add a missed one, or
// change required/preferred. Nothing here re-reads the text or costs anything.

import { useId, useMemo, useState } from 'react'
import {
  highlight,
  noCorrections,
  reviewRows,
  summarise,
  type Confidence,
  type DocCorrections,
  type Level,
  type ReviewRow,
} from '../domain/review.ts'
import type { Taxonomy } from '../domain/types.ts'
import { docKey, type Corrections, type Extraction } from '../extract/extraction.ts'

type Props = {
  extraction: Extraction
  /** Corrections from an earlier review of the same documents. */
  initial: Corrections
  taxonomy: Taxonomy
  onConfirm: (corrections: Corrections) => void
  /** Go back to the pasted text. */
  onBack: () => void
}

const CONFIDENCE_LABEL: Record<Confidence, string> = { high: 'High', medium: 'Medium', low: 'Low' }

function LevelPicker({ value, onChange, label }: { value: Level; onChange: (level: Level) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Level)}>
      <option value="required">Required</option>
      <option value="preferred">Preferred</option>
    </select>
  )
}

export function ReviewScreen({ extraction, initial, taxonomy, onConfirm, onBack }: Props) {
  const docs = useMemo(
    () =>
      extraction.documents.map((doc) => ({
        doc,
        key: docKey(doc),
        rows: reviewRows(doc.mentions, taxonomy),
        segments: highlight(doc.text, doc.mentions, taxonomy),
      })),
    [extraction, taxonomy],
  )
  // Keep only corrections that belong to a document that is still here.
  const [corrections, setCorrections] = useState<Corrections>(() =>
    Object.fromEntries(docs.filter((d) => initial[d.key]).map((d) => [d.key, initial[d.key]!])),
  )
  const [index, setIndex] = useState(0)
  /** The skill whose highlights are emphasised: the row under the pointer or with focus. */
  const [active, setActive] = useState<string | null>(null)
  const [adding, setAdding] = useState('')
  const [addLevel, setAddLevel] = useState<Level>('required')
  const [addError, setAddError] = useState<string | null>(null)
  const id = useId()

  // Every name and alias, lower-cased, pointing at its skill. Used by "add a missing skill".
  const lookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const skill of taxonomy.skills) {
      for (const text of [skill.name, ...skill.aliases, ...(skill.cased ?? []), ...(skill.listed ?? [])]) {
        map.set(text.toLowerCase(), skill.id)
      }
    }
    return map
  }, [taxonomy])

  const current = docs[index]
  if (!current) {
    return (
      <section className="review">
        <h2>Nothing to review</h2>
        <p className="muted">There is no text to read yet.</p>
        <button type="button" className="primary" onClick={onBack}>
          Back to my text
        </button>
      </section>
    )
  }

  const isPosting = current.doc.kind === 'posting'
  const mine: DocCorrections = corrections[current.key] ?? noCorrections()
  const removed = new Set(mine.removed)
  const name = (skillId: string) => taxonomy.byId.get(skillId)?.name ?? skillId

  const change = (update: (c: DocCorrections) => DocCorrections) =>
    setCorrections((all) => ({ ...all, [current.key]: update(all[current.key] ?? noCorrections()) }))

  const toggleRemoved = (skillId: string) =>
    change((c) => ({
      ...c,
      removed: c.removed.includes(skillId) ? c.removed.filter((r) => r !== skillId) : [...c.removed, skillId],
    }))

  const setLevel = (row: ReviewRow, level: Level) =>
    change((c) => {
      const levels = { ...c.levels }
      // Choosing what the extractor already said is not a correction.
      if (level === row.level) delete levels[row.skillId]
      else levels[row.skillId] = level
      return { ...c, levels }
    })

  const addSkill = (e: React.FormEvent) => {
    e.preventDefault()
    const skillId = lookup.get(adding.trim().toLowerCase())
    if (!skillId) {
      setAddError(
        adding.trim() === ''
          ? 'Type a skill name first.'
          : `"${adding.trim()}" is not on this tool's skill list yet. Pick the closest one from the suggestions.`,
      )
      return
    }
    if (mine.added.some((a) => a.skillId === skillId) || (current.rows.some((r) => r.skillId === skillId) && !removed.has(skillId))) {
      setAddError(`${name(skillId)} is already in the list.`)
      return
    }
    setAddError(null)
    setAdding('')
    // Found by the extractor but removed earlier: just put it back.
    if (removed.has(skillId)) toggleRemoved(skillId)
    else change((c) => ({ ...c, added: [...c.added, { skillId, level: isPosting ? addLevel : 'required' }] }))
  }

  const everyRow = docs.flatMap((d) => d.rows)
  const overall = summarise(everyRow)
  const toCheck = (rows: ReviewRow[]) => rows.filter((r) => r.evidence.confidence !== 'high').length
  const last = index === docs.length - 1

  return (
    <section className="review" aria-labelledby={`${id}-title`}>
      <header className="review__head">
        <h2 id={`${id}-title`}>Keywords found. Are they right?</h2>
        <p className="muted">
          Each highlighted word is a skill this tool picked up. Remove any that are wrong and add any it missed,
          then build your map. Your changes are kept if you come back.
        </p>
        {overall.score !== null && (
          <p className="review__score">
            <strong>Confidence {overall.score}%.</strong> {overall.high} of {everyRow.length} findings are named
            outright.
            {overall.medium + overall.low > 0
              ? ` ${overall.medium + overall.low} ${overall.medium + overall.low === 1 ? 'needs' : 'need'} a closer look, and ${overall.medium + overall.low === 1 ? 'is' : 'are'} listed first.`
              : ' Nothing stands out as doubtful.'}
          </p>
        )}
      </header>

      {docs.length > 1 && (
        <nav className="review__docs" aria-label="Documents to review">
          {docs.map((d, i) => (
            <button
              key={`${d.key}-${i}`}
              type="button"
              aria-current={i === index ? 'step' : undefined}
              onClick={() => {
                setIndex(i)
                setAddError(null)
              }}
            >
              <span className="review__doc-title">{d.doc.title}</span>
              <span className="muted">
                {d.rows.length} found{toCheck(d.rows) > 0 && ` · ${toCheck(d.rows)} to check`}
              </span>
            </button>
          ))}
        </nav>
      )}

      <div className="review__body">
        <article className="review__text" aria-label={`Text of ${current.doc.title}`}>
          <h3>{current.doc.title}</h3>
          <p className="review__source">
            {current.segments.map((segment, i) => {
              if (segment.skillIds.length === 0) return <span key={i}>{segment.text}</span>
              const gone = segment.skillIds.every((s) => removed.has(s))
              return (
                <mark
                  key={i}
                  className={[
                    gone ? 'is-removed' : '',
                    active !== null && segment.skillIds.includes(active) ? 'is-active' : '',
                  ].join(' ')}
                  title={segment.skillIds.map(name).join(', ') + (gone ? ' (removed)' : '')}
                  onMouseEnter={() => setActive(segment.skillIds[0] ?? null)}
                  onMouseLeave={() => setActive(null)}
                >
                  {segment.text}
                </mark>
              )
            })}
          </p>
        </article>

        <div className="review__skills">
          <h3>
            {isPosting ? 'Skills this posting asks for' : 'Skills your resume shows'} ({current.rows.length - removed.size + mine.added.length})
          </h3>
          {current.rows.length === 0 && mine.added.length === 0 && (
            <p className="muted">
              No skills were picked up here. If the text names some, add them below.
            </p>
          )}
          <ul>
            {current.rows.map((row) => {
              const gone = removed.has(row.skillId)
              return (
                <li
                  key={row.skillId}
                  className={gone ? 'is-removed' : undefined}
                  onMouseEnter={() => setActive(row.skillId)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(row.skillId)}
                  onBlur={() => setActive(null)}
                >
                  <div className="review__row-main">
                    <span className="review__name">{name(row.skillId)}</span>
                    <span className={`confidence confidence--${row.evidence.confidence}`}>
                      {CONFIDENCE_LABEL[row.evidence.confidence]}
                      <span className="visually-hidden"> confidence</span>
                    </span>
                  </div>
                  <p className="muted review__why">
                    {row.evidence.reason}
                    {row.evidence.confidence !== 'high' && <>: “{row.quote}”</>}
                  </p>
                  <div className="review__row-actions">
                    {isPosting && !gone && (
                      <LevelPicker
                        value={mine.levels[row.skillId] ?? row.level}
                        onChange={(level) => setLevel(row, level)}
                        label={`Is ${name(row.skillId)} required or preferred?`}
                      />
                    )}
                    <button
                      type="button"
                      className="link"
                      aria-label={`${gone ? 'Put back' : 'Remove'} ${name(row.skillId)}`}
                      onClick={() => toggleRemoved(row.skillId)}
                    >
                      {gone ? 'Put back' : 'Remove'}
                    </button>
                  </div>
                </li>
              )
            })}
            {mine.added.map((a) => (
              <li key={`added-${a.skillId}`}>
                <div className="review__row-main">
                  <span className="review__name">{name(a.skillId)}</span>
                  <span className="confidence confidence--yours">Added by you</span>
                </div>
                <div className="review__row-actions">
                  {isPosting && (
                    <LevelPicker
                      value={a.level}
                      onChange={(level) =>
                        change((c) => ({
                          ...c,
                          added: c.added.map((x) => (x.skillId === a.skillId ? { ...x, level } : x)),
                        }))
                      }
                      label={`Is ${name(a.skillId)} required or preferred?`}
                    />
                  )}
                  <button
                    type="button"
                    className="link"
                    aria-label={`Remove ${name(a.skillId)}`}
                    onClick={() => change((c) => ({ ...c, added: c.added.filter((x) => x.skillId !== a.skillId) }))}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form className="review__add" onSubmit={addSkill} noValidate>
            <label htmlFor={`${id}-add`}>Add a skill it missed</label>
            <div className="review__add-row">
              <input
                id={`${id}-add`}
                list={`${id}-skills`}
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                placeholder="Start typing, for example Docker"
                autoComplete="off"
                aria-invalid={addError !== null}
                aria-describedby={addError ? `${id}-add-error` : undefined}
              />
              {isPosting && <LevelPicker value={addLevel} onChange={setAddLevel} label="Required or preferred?" />}
              <button type="submit" className="quiet">
                Add
              </button>
            </div>
            <datalist id={`${id}-skills`}>
              {taxonomy.skills.map((skill) => (
                <option key={skill.id} value={skill.name} />
              ))}
            </datalist>
            {addError && (
              <p className="field-error" id={`${id}-add-error`} role="alert">
                {addError}
              </p>
            )}
          </form>
        </div>
      </div>

      <footer className="review__actions">
        <button type="button" className="quiet" onClick={onBack}>
          Back to my text
        </button>
        {docs.length > 1 && (
          <>
            <button type="button" className="quiet" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Previous
            </button>
            <button type="button" className="quiet" disabled={last} onClick={() => setIndex(index + 1)}>
              Next document
            </button>
            <span className="muted" role="status">
              Document {index + 1} of {docs.length}
            </span>
          </>
        )}
        <button type="button" className="primary" onClick={() => onConfirm(corrections)}>
          Looks right, build my map
        </button>
      </footer>
    </section>
  )
}
