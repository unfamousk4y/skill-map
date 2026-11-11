// The shape of what this app keeps in the browser, and a checker for it.
//
// Anything read back from storage is checked before use. It might have been
// written by an older version of the app, or edited by hand. If it does not
// have the expected shape it is ignored, and the app starts fresh.

import { validProofUrl } from '../domain/progress.ts'
import type { DocCorrections } from '../domain/review.ts'
import type { Learned, Mention, Snapshot, SnapshotSkill } from '../domain/types.ts'
import { MAX_CHARS, MAX_POSTINGS } from '../extract/dictionary.ts'
import type { Corrections, DocumentReading, Extraction } from '../extract/extraction.ts'

export const SAVED_VERSION = 1
export const MAX_SNAPSHOTS = 20

export type SavedState = {
  version: typeof SAVED_VERSION
  /** The pasted text, exactly as typed. */
  draft: { postings: string[]; resume: string }
  method: 'dictionary' | 'claude'
  /**
   * What Claude found, kept because reading the text again would cost money.
   * Null for the free matcher, which re-reads the text each time instead.
   */
  claudeExtraction: Extraction | null
  /** What the student changed while reviewing, by document. */
  corrections: Corrections
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

const isLevel = (v: unknown): v is Mention['level'] => v === 'required' || v === 'preferred'
const isTextList = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.every((x) => isText(x, max))

function parseExtraction(value: unknown): Extraction | null {
  if (!isObject(value) || !Array.isArray(value.documents) || value.documents.length > MAX_POSTINGS + 1) return null
  if (!isCount(value.rejectedMentions) || !isTextList(value.otherSkills, 200) || !isTextList(value.notes, 1000)) return null
  const documents: DocumentReading[] = []
  for (const doc of value.documents) {
    if (!isObject(doc) || (doc.kind !== 'posting' && doc.kind !== 'resume')) return null
    if (!isText(doc.title, 200) || !isText(doc.text, MAX_CHARS) || !Array.isArray(doc.mentions)) return null
    const mentions: Mention[] = []
    for (const m of doc.mentions) {
      if (!isObject(m) || !isText(m.skillId, 60) || !isText(m.quote, MAX_CHARS) || !isLevel(m.level)) return null
      // Saved findings are shown as quotes, so each must still be in its text.
      const squash = (text: string) => text.replace(/\s+/g, ' ').trim()
      if (m.quote === '' || !squash(doc.text).includes(squash(m.quote))) return null
      mentions.push({ skillId: m.skillId, quote: m.quote, level: m.level })
    }
    documents.push({ kind: doc.kind, title: doc.title, text: doc.text, mentions })
  }
  return {
    method: 'claude',
    documents,
    rejectedMentions: value.rejectedMentions,
    otherSkills: value.otherSkills,
    notes: value.notes,
  }
}

function parseCorrections(value: unknown): Corrections | null {
  // Saved before the review step existed: no corrections.
  if (value === undefined) return {}
  if (!isObject(value)) return null
  const out: Corrections = {}
  for (const [key, c] of Object.entries(value)) {
    if (!isObject(c) || !isTextList(c.removed, 60) || !Array.isArray(c.added) || !isObject(c.levels)) return null
    const doc: DocCorrections = { removed: c.removed, added: [], levels: {} }
    for (const a of c.added) {
      if (!isObject(a) || !isText(a.skillId, 60) || !isLevel(a.level)) return null
      doc.added.push({ skillId: a.skillId, level: a.level })
    }
    for (const [id, level] of Object.entries(c.levels)) {
      if (!isLevel(level)) return null
      doc.levels[id] = level
    }
    out[key] = doc
  }
  return out
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

  const corrections = parseCorrections(value.corrections)
  if (corrections === null) return null

  const claudeExtraction = value.method === 'claude' ? parseExtraction(value.claudeExtraction) : null
  return {
    version: SAVED_VERSION,
    draft: { postings: draft.postings as string[], resume: draft.resume as string },
    // Without the saved Claude result, fall back to the free matcher rather than show nothing.
    method: claudeExtraction ? 'claude' : 'dictionary',
    claudeExtraction,
    corrections,
    learned,
    snapshots,
  }
}
