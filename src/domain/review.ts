// The student's review of what an extractor found, before the map is built.
//
// Three things live here:
// - confidence: how sure we can be of one finding, from the kind of evidence
// - corrections: what the student removed, added or re-labelled
// - highlighting: where each finding sits in the text, for showing it in place
//
// Pure rules, no screen code.

import { findMentions } from './matcher.ts'
import type { Mention, Taxonomy } from './types.ts'

export type Level = Mention['level']
export type Confidence = 'high' | 'medium' | 'low'

export type Evidence = {
  confidence: Confidence
  /** Why, in words the student can act on. */
  reason: string
  /** Which part of the quote to highlight, as positions inside the quote. */
  start: number
  end: number
}

const REASON: Record<Confidence, string> = {
  high: 'Named outright',
  medium: 'This word has other meanings',
  low: 'Not named in so many words',
}

/**
 * Rates one finding by the kind of evidence behind it. This is not a
 * probability, and it is the same rule for the free matcher and for Claude:
 *
 * - high: the quote contains the skill's name or a known alias ("PostgreSQL").
 * - medium: the name is also an ordinary word, matched by its capital letter
 *   ("Go", "Swift", "Spring"). Usually right, sometimes not.
 * - low: the quote does not name the skill at all. Only Claude produces
 *   these, when it reads a description ("store recent results in memory").
 */
export function evidenceFor(mention: Mention, tax: Taxonomy): Evidence {
  const skill = tax.byId.get(mention.skillId)
  // Look for the skill's name inside its own quote, with the matcher's rules.
  const hit = skill && findMentions(mention.quote, tax).find((m) => m.skillId === mention.skillId)
  if (!skill || !hit) {
    return { confidence: 'low', reason: REASON.low, start: 0, end: mention.quote.length }
  }
  const doubtful = new Set([...(skill.cased ?? []), ...(skill.listed ?? [])])
  const confidence: Confidence = doubtful.has(hit.term.replace(/[\s-]+/g, ' ')) ? 'medium' : 'high'
  return { confidence, reason: REASON[confidence], start: hit.start, end: hit.end }
}

/** One skill in one document, as a row the student can accept, change or remove. */
export type ReviewRow = {
  skillId: string
  level: Level
  evidence: Evidence
  /** The quote behind the best evidence. */
  quote: string
}

const RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 }

/**
 * Groups a document's mentions into one row per skill. A skill named three
 * times is one row, showing its strongest evidence. Least certain rows come
 * first, because those are the ones worth a look.
 */
export function reviewRows(mentions: Mention[], tax: Taxonomy): ReviewRow[] {
  const rows = new Map<string, ReviewRow>()
  for (const mention of mentions) {
    if (mention.manual || !tax.byId.has(mention.skillId)) continue
    const evidence = evidenceFor(mention, tax)
    const row = rows.get(mention.skillId)
    if (!row) {
      rows.set(mention.skillId, { skillId: mention.skillId, level: mention.level, evidence, quote: mention.quote })
      continue
    }
    // Required wins over preferred, the same rule the scoring uses.
    if (mention.level === 'required') row.level = 'required'
    if (RANK[evidence.confidence] < RANK[row.evidence.confidence]) {
      row.evidence = evidence
      row.quote = mention.quote
    }
  }
  const name = (id: string) => tax.byId.get(id)!.name
  return [...rows.values()].sort(
    (a, b) => RANK[b.evidence.confidence] - RANK[a.evidence.confidence] || name(a.skillId).localeCompare(name(b.skillId)),
  )
}

export type ConfidenceSummary = {
  high: number
  medium: number
  low: number
  /** Share of findings that are named outright, 0 to 100. Null when there are no findings. */
  score: number | null
}

/**
 * The confidence score is deliberately plain: the percentage of findings
 * that are named outright. It can be checked by counting.
 */
export function summarise(rows: Pick<ReviewRow, 'evidence'>[]): ConfidenceSummary {
  const count = (c: Confidence) => rows.filter((r) => r.evidence.confidence === c).length
  const high = count('high')
  return {
    high,
    medium: count('medium'),
    low: count('low'),
    score: rows.length === 0 ? null : Math.round((high / rows.length) * 100),
  }
}

// ---------- corrections ----------

/** What the student changed in one document. */
export type DocCorrections = {
  /** Skills the extractor found that the student says are wrong. */
  removed: string[]
  /** Skills the extractor missed. There is no quote: the student is the evidence. */
  added: { skillId: string; level: Level }[]
  /** Required/preferred labels the student changed, by skill id. */
  levels: Record<string, Level>
}

export const noCorrections = (): DocCorrections => ({ removed: [], added: [], levels: {} })

export const isUntouched = (c: DocCorrections | undefined): boolean =>
  !c || (c.removed.length === 0 && c.added.length === 0 && Object.keys(c.levels).length === 0)

/** Applies the student's changes to what the extractor found. The input is not changed. */
export function applyCorrections(mentions: Mention[], corrections: DocCorrections | undefined): Mention[] {
  if (isUntouched(corrections)) return mentions
  const c = corrections!
  const removed = new Set(c.removed)
  const kept = mentions
    .filter((m) => !removed.has(m.skillId))
    .map((m) => (c.levels[m.skillId] ? { ...m, level: c.levels[m.skillId]! } : m))
  const present = new Set(kept.map((m) => m.skillId))
  const added: Mention[] = c.added
    .filter((a) => !present.has(a.skillId))
    .map((a) => ({ skillId: a.skillId, quote: '', level: a.level, manual: true }))
  return [...kept, ...added]
}

// ---------- highlighting ----------

/** A run of text. skillIds is empty for ordinary text. */
export type Segment = { text: string; skillIds: string[] }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Finds a quote in the text. The quote check allows spacing to differ (a line
 * break in the text, a single space in the quote), so this does too.
 */
function locate(text: string, quote: string): { start: number; end: number } | null {
  const words = quote.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const match = new RegExp(words.map(escape).join('\\s+')).exec(text)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}

/**
 * Cuts a document into runs of plain and highlighted text. For a named skill
 * only the name is highlighted; for a described one, the whole quote.
 * Joining every segment's text gives back the document exactly.
 */
export function highlight(text: string, mentions: Mention[], tax: Taxonomy): Segment[] {
  type Range = { start: number; end: number; skillIds: string[] }
  const ranges: Range[] = []
  for (const mention of mentions) {
    if (mention.manual || !tax.byId.has(mention.skillId)) continue
    const found = locate(text, mention.quote)
    if (!found) continue
    const evidence = evidenceFor(mention, tax)
    // The positions inside the quote only line up if the spacing is identical.
    const sameSpacing = text.slice(found.start, found.end) === mention.quote
    ranges.push(
      sameSpacing
        ? { start: found.start + evidence.start, end: found.start + evidence.end, skillIds: [mention.skillId] }
        : { ...found, skillIds: [mention.skillId] },
    )
  }

  // Shortest first: a precise highlight beats a whole-sentence one that overlaps it.
  ranges.sort((a, b) => a.end - a.start - (b.end - b.start) || a.start - b.start)
  const kept: Range[] = []
  for (const range of ranges) {
    const same = kept.find((k) => k.start === range.start && k.end === range.end)
    if (same) {
      for (const id of range.skillIds) if (!same.skillIds.includes(id)) same.skillIds.push(id)
    } else if (!kept.some((k) => range.start < k.end && range.end > k.start)) {
      kept.push(range)
    }
  }
  kept.sort((a, b) => a.start - b.start)

  const segments: Segment[] = []
  let at = 0
  for (const range of kept) {
    if (range.start > at) segments.push({ text: text.slice(at, range.start), skillIds: [] })
    segments.push({ text: text.slice(range.start, range.end), skillIds: range.skillIds })
    at = range.end
  }
  if (at < text.length) segments.push({ text: text.slice(at), skillIds: [] })
  return segments
}
