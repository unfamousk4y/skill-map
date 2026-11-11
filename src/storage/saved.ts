// The shape of what this app keeps in the browser, and a checker for it.
//
// Anything read back from storage is checked before use. It might have been
// written by an older version of the app, or edited by hand. If it does not
// have the expected shape it is ignored, and the app starts fresh.

import { validProofUrl } from '../domain/progress.ts'
import type { Analysis, Learned, Snapshot, SnapshotSkill } from '../domain/types.ts'
import { MAX_CHARS, MAX_POSTINGS } from '../extract/dictionary.ts'

export const SAVED_VERSION = 1
export const MAX_SNAPSHOTS = 20

export type SavedState = {
  version: typeof SAVED_VERSION
  /** The pasted text, exactly as typed. */
  draft: { postings: string[]; resume: string }
  method: 'dictionary' | 'claude'
  /**
   * Kept only for a map Claude read, because reading it again would cost
   * money. A free-matcher map is rebuilt from the text each time instead.
   */
  claudeAnalysis: Analysis | null
  learned: Learned
  /** Oldest first. */
  snapshots: Snapshot[]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const isDate = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))

function parseSnapshot(value: unknown): Snapshot | null {
  if (!isObject(value) || !isDate(value.at) || !isCount(value.postings) || !isObject(value.skills)) return null
  const skills: Snapshot['skills'] = {}
  for (const [id, s] of Object.entries(value.skills)) {
    if (!isObject(s) || !isCount(s.required) || !isCount(s.preferred)) return null
    if (s.state !== 'gap' && s.state !== 'have' && s.state !== 'learned') return null
    skills[id] = { required: s.required, preferred: s.preferred, state: s.state as SnapshotSkill['state'] }
  }
  return { at: value.at, postings: value.postings, skills }
}

/** A light check: enough to know the map can be drawn from it without crashing. */
function looksLikeAnalysis(value: unknown): value is Analysis {
  if (!isObject(value)) return false
  const lists = ['postings', 'findings', 'next', 'learningOrder', 'otherSkills', 'notes'] as const
  if (!lists.every((key) => Array.isArray(value[key]))) return false
  if (!isObject(value.unlocks) || typeof value.label !== 'string') return false
  return (value.findings as unknown[]).every(
    (f) =>
      isObject(f) &&
      typeof f.id === 'string' &&
      isCount(f.required) &&
      isCount(f.preferred) &&
      typeof f.have === 'boolean' &&
      Array.isArray(f.postingQuotes) &&
      Array.isArray(f.resumeQuotes),
  )
}

export function parseSaved(value: unknown): SavedState | null {
  if (!isObject(value) || value.version !== SAVED_VERSION) return null

  const draft = value.draft
  if (!isObject(draft) || !Array.isArray(draft.postings) || draft.postings.length > MAX_POSTINGS) return null
  // Twice the paste limit: the form lets you type past the limit and warns you.
  if (!draft.postings.every((p) => isText(p, MAX_CHARS * 2)) || !isText(draft.resume, MAX_CHARS * 2)) return null

  const learned: Learned = {}
  if (!isObject(value.learned)) return null
  for (const [id, proof] of Object.entries(value.learned)) {
    if (!isObject(proof) || typeof proof.url !== 'string' || !isDate(proof.at)) return null
    // Checked again on the way in: a stored link is shown as something to click.
    const url = validProofUrl(proof.url)
    if (url === null) return null
    learned[id] = { url, at: proof.at }
  }

  if (!Array.isArray(value.snapshots)) return null
  const snapshots: Snapshot[] = []
  for (const item of value.snapshots.slice(-MAX_SNAPSHOTS)) {
    const snapshot = parseSnapshot(item)
    if (snapshot === null) return null
    snapshots.push(snapshot)
  }

  const claudeAnalysis = looksLikeAnalysis(value.claudeAnalysis) ? value.claudeAnalysis : null
  return {
    version: SAVED_VERSION,
    draft: { postings: draft.postings as string[], resume: draft.resume as string },
    // Without the saved Claude result, fall back to the free matcher rather than show nothing.
    method: value.method === 'claude' && claudeAnalysis ? 'claude' : 'dictionary',
    claudeAnalysis: value.method === 'claude' ? claudeAnalysis : null,
    learned,
    snapshots,
  }
}
