// Runs the whole free pipeline on pasted text:
// find skills (matcher) -> check the quotes (verify) -> count and rank (score).
//
// The Claude extractor in milestone 4 will replace only the first step. The
// verify and score steps stay exactly the same for both.

import { findMentions } from '../domain/matcher.ts'
import { buildAnalysis } from '../domain/score.ts'
import type { Analysis, Taxonomy } from '../domain/types.ts'
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

export function analyseWithDictionary(inputs: TextInputs, tax: Taxonomy): Analysis {
  let rejected = 0
  const check = (text: string) => {
    const result = verifyMentions(text, findMentions(text, tax), tax)
    rejected += result.rejected.length
    return result.kept
  }

  const postings = inputs.postings
    .map((text) => text.slice(0, MAX_CHARS))
    .filter((text) => text.trim() !== '')
    .slice(0, MAX_POSTINGS)
    .map((text, index) => ({
      posting: { id: `p${index + 1}`, title: titleFor(text, index) },
      mentions: check(text),
    }))

  return buildAnalysis(
    {
      label: inputs.label,
      fictional: inputs.fictional,
      postings,
      resume: check(inputs.resume.slice(0, MAX_CHARS)),
      rejectedMentions: rejected,
    },
    tax,
  )
}
