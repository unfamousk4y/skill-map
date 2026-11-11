import { useId, useRef, useState } from 'react'
import type { Progress } from '../extract/claude.ts'
import { MAX_CHARS, MAX_POSTINGS } from '../extract/dictionary.ts'

export type Draft = { postings: string[]; resume: string }
export type Method = 'dictionary' | 'claude'

type Props = {
  initial: Draft
  /** True only where a server with an API key is running (the owner's own machine). */
  claudeAvailable: boolean
  /** Set while Claude is reading. The form is locked until it finishes. */
  progress: Progress | null
  /** A problem reported by the server on the last attempt. */
  serverError: string | null
  onBuild: (draft: Draft, method: Method) => void
  /** Go back to the map without changing anything. */
  onCancel: () => void
}

export function IntakeScreen({ initial, claudeAvailable, progress, serverError, onBuild, onCancel }: Props) {
  const [postings, setPostings] = useState(initial.postings.length > 0 ? initial.postings : [''])
  const [resume, setResume] = useState(initial.resume)
  const [method, setMethod] = useState<Method>('dictionary')
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const firstPosting = useRef<HTMLTextAreaElement>(null)
  const busy = progress !== null
  // If Claude stops being available (say the key file was removed), fall back quietly.
  const chosen: Method = claudeAvailable ? method : 'dictionary'

  const setPosting = (index: number, text: string) =>
    setPostings((list) => list.map((p, i) => (i === index ? text : p)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const filled = postings.filter((p) => p.trim() !== '')
    if (filled.length === 0) {
      setError('Paste at least one job posting to build a map.')
      firstPosting.current?.focus()
      return
    }
    setError(null)
    onBuild({ postings: filled, resume }, chosen)
  }

  const tooLong = (text: string) => text.length > MAX_CHARS
  const shown = error ?? serverError

  return (
    <form className="intake" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="intake__intro">
        <h2>Build your own map</h2>
        <p className="muted">
          Paste a few postings for jobs you want, then your resume.{' '}
          {chosen === 'dictionary'
            ? 'Your text is saved in this browser only, so it is still here next time. Nothing is uploaded, and you can delete it from the map screen.'
            : 'With Claude, your text is sent to Anthropic to be read. The result is saved in this browser only.'}
        </p>
      </div>

      <fieldset className="intake__group" disabled={busy}>
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
              aria-describedby={index === 0 && shown ? `${id}-error` : undefined}
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

      <fieldset className="intake__group" disabled={busy}>
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

      {/* Only offered where a server with an API key is running. Visitors to the public site never see it. */}
      {claudeAvailable && (
        <fieldset className="intake__group" disabled={busy}>
          <legend>How to read the text</legend>
          <label className="choice">
            <input
              type="radio"
              name={`${id}-method`}
              checked={method === 'dictionary'}
              onChange={() => setMethod('dictionary')}
            />
            <span>
              <strong>Free matcher</strong>
              <span className="muted">Instant, in your browser. Finds skills that are named.</span>
            </span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name={`${id}-method`}
              checked={method === 'claude'}
              onChange={() => setMethod('claude')}
            />
            <span>
              <strong>Claude</strong>
              <span className="muted">
                Also finds skills that are described without being named. Takes a few seconds per
                document and uses this computer's API credit.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      {shown && (
        <p className="intake__error" id={`${id}-error`} role="alert">
          {shown}
        </p>
      )}

      {/* role="status" makes a screen reader announce progress without stealing focus. */}
      <div role="status" className="intake__progress">
        {busy && (
          <>
            <p>
              {progress.total > 0
                ? `Claude is reading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}${progress.current ? `: ${progress.current}` : ''}`
                : 'Starting…'}
            </p>
            <progress value={progress.done} max={Math.max(1, progress.total)} />
          </>
        )}
      </div>

      <div className="intake__actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Building…' : 'Build my map'}
        </button>
        <button type="button" className="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}
