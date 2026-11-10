import { useId, useRef, useState } from 'react'
import { MAX_CHARS, MAX_POSTINGS } from '../extract/dictionary.ts'

export type Draft = { postings: string[]; resume: string }

type Props = {
  initial: Draft
  onBuild: (draft: Draft) => void
  /** Go back to the map without changing anything. */
  onCancel: () => void
}

export function IntakeScreen({ initial, onBuild, onCancel }: Props) {
  const [postings, setPostings] = useState(initial.postings.length > 0 ? initial.postings : [''])
  const [resume, setResume] = useState(initial.resume)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const firstPosting = useRef<HTMLTextAreaElement>(null)

  const setPosting = (index: number, text: string) =>
    setPostings((list) => list.map((p, i) => (i === index ? text : p)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const filled = postings.filter((p) => p.trim() !== '')
    if (filled.length === 0) {
      setError('Paste at least one job posting to build a map.')
      firstPosting.current?.focus()
      return
    }
    setError(null)
    onBuild({ postings: filled, resume })
  }

  const tooLong = (text: string) => text.length > MAX_CHARS

  return (
    <form className="intake" onSubmit={submit} noValidate>
      <div className="intake__intro">
        <h2>Build your own map</h2>
        <p className="muted">
          Paste a few postings for jobs you want, then your resume. Your text stays in this browser:
          nothing is uploaded or saved.
        </p>
      </div>

      <fieldset className="intake__group">
        <legend>Job postings</legend>
        {postings.map((text, index) => (
          <div className="field" key={index}>
            <div className="field__head">
              <label htmlFor={`${id}-p${index}`}>Posting {index + 1}</label>
              {postings.length > 1 && (
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setPostings((list) => list.filter((_, i) => i !== index))}
                >
                  Remove<span className="visually-hidden"> posting {index + 1}</span>
                </button>
              )}
            </div>
            <textarea
              id={`${id}-p${index}`}
              ref={index === 0 ? firstPosting : undefined}
              value={text}
              rows={7}
              placeholder="Paste the full text of one posting. Put the job title on the first line."
              aria-invalid={index === 0 && error !== null}
              aria-describedby={index === 0 && error ? `${id}-error` : undefined}
              onChange={(e) => setPosting(index, e.target.value)}
            />
            {tooLong(text) && (
              <p className="field__note">
                This is very long. Only the first {MAX_CHARS.toLocaleString()} characters are read.
              </p>
            )}
          </div>
        ))}
        {postings.length < MAX_POSTINGS ? (
          <button type="button" className="quiet intake__add" onClick={() => setPostings((list) => [...list, ''])}>
            Add another posting
          </button>
        ) : (
          <p className="field__note">That is the most postings one map can hold ({MAX_POSTINGS}).</p>
        )}
      </fieldset>

      <fieldset className="intake__group">
        <legend>Your resume</legend>
        <div className="field">
          <label htmlFor={`${id}-resume`}>Resume text</label>
          <textarea
            id={`${id}-resume`}
            value={resume}
            rows={9}
            placeholder="Paste your resume as plain text. Leave it empty to see every skill as a gap."
            onChange={(e) => setResume(e.target.value)}
          />
          {tooLong(resume) && (
            <p className="field__note">
              This is very long. Only the first {MAX_CHARS.toLocaleString()} characters are read.
            </p>
          )}
        </div>
      </fieldset>

      {error && (
        <p className="intake__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}

      <div className="intake__actions">
        <button type="submit" className="primary">
          Build my map
        </button>
        <button type="button" className="quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
