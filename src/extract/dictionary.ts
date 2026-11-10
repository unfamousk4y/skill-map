// Runs the whole free pipeline on pasted text:
// find skills (matcher) -> check the quotes (verify) -> count and rank (score).
//
// The Claude pipeline in claude.ts replaces only the first step. The verify
// and score steps are exactly the same for both.

import { findMentions } from '../domain/matcher.ts'
import { buildAnalysis } from '../domain/score.ts'
import type { Analysis, Posting, Taxonomy } from '../domain/types.ts'
import { verifyMentions } from '../domain/verify.ts'

export type TextInputs = {
  label: string
  fictional: boolean
  /** One pasted job posting per entry. */
  postings: string[]
  resume: string
}

export const MAX_POSTINGS = 12
/** About 5 pages. Longer text is almost always a paste accident. */
export const MAX_CHARS = 20_000

/** A short name for a posting: its first line, or "Posting 3" if that is no use. */
export function titleFor(text: string, index: number): string {
  const first = text.split('\n').map((line) => line.trim()).find((line) => line !== '') ?? ''
  if (first === '' || first.length > 70) return `Posting ${index + 1}`
  return first
}

export type PreparedInputs = { postings: { posting: Posting; text: string }[]; resume: string }

/** Applies the size limits, drops blank postings and names the rest. Shared by both pipelines. */
export function prepare(inputs: TextInputs): PreparedInputs {
  return {
    postings: inputs.postings
      .map((text) => text.slice(0, MAX_CHARS))
      .filter((text) => text.trim() !== '')
      .slice(0, MAX_POSTINGS)
      .map((text, index) => ({ posting: { id: `p${index + 1}`, title: titleFor(text, index) }, text })),
    resume: inputs.resume.slice(0, MAX_CHARS),
  }
}

export function analyseWithDictionary(inputs: TextInputs, tax: Taxonomy): Analysis {
  let rejected = 0
  const check = (text: string) => {
    const result = verifyMentions(text, findMentions(text, tax), tax)
    rejected += result.rejected.length
    return result.kept
  }
  const prepared = prepare(inputs)
  return buildAnalysis(
    {
      label: inputs.label,
      fictional: inputs.fictional,
      method: 'dictionary',
      postings: prepared.postings.map(({ posting, text }) => ({ posting, mentions: check(text) })),
      resume: check(prepared.resume),
      rejectedMentions: rejected,
    },
    tax,
  )
}
