// The parts of the side panel about your own progress: marking a skill as
// learned, saved snapshots with "what changed", the share link, and your data.

import { useId, useState } from 'react'
import { compareSnapshots, coverage, MAX_URL_LENGTH, validProofUrl } from '../domain/progress.ts'
import type { Proof, Snapshot, Taxonomy } from '../domain/types.ts'
import { MAX_SNAPSHOTS } from '../storage/saved.ts'

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Shown on a skill's detail view. A gap gets the form; a learned skill gets its proof. */
export function LearnBox({
  skillName,
  proof,
  onLearn,
  onUnlearn,
}: {
  skillName: string
  /** Set when the skill is already marked as learned. */
  proof: Proof | undefined
  onLearn: (url: string) => void
  onUnlearn: () => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  if (proof) {
    return (
      <section className="learn">
        <h3>Your proof</h3>
        <p>
          {/* noopener and noreferrer stop the opened page from reaching back into this one. */}
          <a href={proof.url} target="_blank" rel="noopener noreferrer">
            {proof.url}
          </a>
        </p>
        <p className="muted">Marked as learned on {day(proof.at)}.</p>
        <button type="button" className="quiet" onClick={onUnlearn}>
          Undo
        </button>
      </section>
    )
  }

  if (!open) {
    return (
      <section className="learn">
        <button type="button" className="quiet" onClick={() => setOpen(true)}>
          I have learned this
        </button>
      </section>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const url = validProofUrl(text)
    if (url === null) {
      setError('Enter a full web address that starts with https://')
      return
    }
    onLearn(url)
  }

  return (
    <section className="learn">
      <form onSubmit={submit} noValidate>
        <label htmlFor={`${id}-url`}>Link that shows you can use {skillName}</label>
        <p className="muted" id={`${id}-hint`}>
          A project, a repository or a certificate. It is saved in this browser and is not put in share links.
        </p>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          autoFocus
          maxLength={MAX_URL_LENGTH}
          placeholder="https://github.com/you/project"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          aria-invalid={error !== null}
        />
        {error && (
          <p className="field-error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
        <div className="learn__actions">
          <button type="submit" className="primary">
            Mark as learned
          </button>
          <button type="button" className="quiet" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}

function NameList({ title, ids, taxonomy }: { title: string; ids: string[]; taxonomy: Taxonomy }) {
  if (ids.length === 0) return null
  return (
    <li>
      <strong>{title}:</strong> {ids.map((id) => taxonomy.byId.get(id)?.name ?? id).join(', ')}
    </li>
  )
}

type Props = {
  taxonomy: Taxonomy
  /** The map as it is right now. */
  current: Snapshot
  /** Oldest first. */
  snapshots: Snapshot[]
  onSaveSnapshot: () => void
  onDeleteSnapshot: (index: number) => void
  shareUrl: string
  onExport: () => void
  onDeleteAll: () => void
  /** Set when the browser refused to save. */
  saveProblem: string | null
}

export function ProgressPanel(props: Props) {
  const { taxonomy, current, snapshots } = props
  const [compared, setCompared] = useState<number | null>(null)
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const id = useId()

  const now = coverage(current)
  // Deleting a snapshot can leave the chosen number pointing past the end.
  const chosen = compared !== null ? snapshots[compared] : undefined
  const changes = chosen ? compareSnapshots(chosen, current) : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.shareUrl)
      setCopied('yes')
    } catch {
      // Some browsers block copying. The link is on screen to copy by hand.
      setCopied('failed')
    }
  }

  return (
    <>
      <section>
        <h3>Progress</h3>
        <p className="muted">
          A snapshot records which skills are covered today, so you can see later what changed. It holds counts
          only, not your text.
        </p>
        <button
          type="button"
          className="quiet"
          onClick={props.onSaveSnapshot}
          disabled={now.asked === 0}
        >
          Save a snapshot
        </button>
        {snapshots.length >= MAX_SNAPSHOTS && (
          <p className="muted">Only the newest {MAX_SNAPSHOTS} are kept.</p>
        )}
        {snapshots.length > 0 && (
          <ul className="snapshots">
            {snapshots
              .map((snapshot, index) => ({ snapshot, index }))
              .reverse()
              .map(({ snapshot, index }) => {
                const c = coverage(snapshot)
                const open = compared === index
                return (
                  <li key={`${snapshot.at}-${index}`}>
                    <span>
                      {day(snapshot.at)}
                      <span className="muted"> · {c.covered} of {c.asked} covered</span>
                    </span>
                    <span className="snapshots__actions">
                      <button
                        type="button"
                        className="link"
                        aria-expanded={open}
                        aria-controls={`${id}-changes`}
                        onClick={() => setCompared(open ? null : index)}
                      >
                        {open ? 'Hide changes' : 'What changed'}
                      </button>
                      <button
                        type="button"
                        className="link"
                        aria-label={`Delete the snapshot from ${day(snapshot.at)}`}
                        onClick={() => {
                          setCompared(null)
                          props.onDeleteSnapshot(index)
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                )
              })}
          </ul>
        )}
        <div id={`${id}-changes`} aria-live="polite">
          {chosen && changes && (
            <div className="changes">
              <p>
                Since {day(chosen.at)}: covered{' '}
                <strong>
                  {changes.before.covered} of {changes.before.asked}
                </strong>{' '}
                then,{' '}
                <strong>
                  {changes.after.covered} of {changes.after.asked}
                </strong>{' '}
                now.
              </p>
              {changes.same ? (
                <p className="muted">Nothing has changed since this snapshot.</p>
              ) : (
                <ul>
                  <NameList title="Now covered" ids={changes.nowCovered} taxonomy={taxonomy} />
                  <NameList title="No longer covered" ids={changes.noLongerCovered} taxonomy={taxonomy} />
                  <NameList title="Newly asked for" ids={changes.newlyAsked} taxonomy={taxonomy} />
                  <NameList title="No longer asked for" ids={changes.noLongerAsked} taxonomy={taxonomy} />
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3>Share</h3>
        <p className="muted">
          The link carries this map inside it: skill names, counts and whether each is covered. It does not carry
          your resume, the postings, any quote or your proof links. Anyone with the link can open a read-only copy.
        </p>
        <label className="visually-hidden" htmlFor={`${id}-share`}>
          Share link
        </label>
        <input
          id={`${id}-share`}
          className="share__link"
          readOnly
          value={props.shareUrl}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="quiet" onClick={() => void copy()}>
          Copy link
        </button>
        <p role="status" className="muted">
          {copied === 'yes' && 'Link copied.'}
          {copied === 'failed' && 'Could not copy automatically. Select the link above and copy it.'}
        </p>
      </section>

      <section>
        <h3>Your data</h3>
        {props.saveProblem ? (
          <p className="field-error" role="alert">
            {props.saveProblem}
          </p>
        ) : (
          <p className="muted">
            Your text, snapshots and proof links are saved in this browser on this device, and nowhere else.
          </p>
        )}
        <div className="learn__actions">
          <button type="button" className="quiet" onClick={props.onExport}>
            Download a copy
          </button>
          {!confirmingDelete && (
            <button type="button" className="quiet" onClick={() => setConfirmingDelete(true)}>
              Delete everything
            </button>
          )}
        </div>
        {confirmingDelete && (
          <div className="confirm" role="group" aria-label="Confirm deleting everything">
            <p>
              This removes your postings, resume, snapshots and proof links from this browser. It cannot be undone.
            </p>
            <div className="learn__actions">
              <button type="button" className="danger" autoFocus onClick={props.onDeleteAll}>
                Yes, delete it all
              </button>
              <button type="button" className="quiet" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
