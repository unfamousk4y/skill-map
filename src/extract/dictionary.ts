// Runs the whole free pipeline on pasted text:
// find skills (matcher) -> check the quotes (verify) -> count and rank (score).
//
// The Claude pipeline in claude.ts replaces only the first step. The verify
// and score steps are exactly the same for both.

import { findMentions } from '../domain/matcher.ts'
import type { Analysis, Mention, Posting, Taxonomy } from '../domain/types.ts'
import { verifyMentions } from '../domain/verify.ts'
import { analysisFromExtraction, type Extraction } from './extraction.ts'

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

/** Reads every document with the free matcher. Nothing is counted yet. */
export function extractWithDictionary(inputs: TextInputs, tax: Taxonomy): Extraction {
  let rejected = 0
  const check = (text: string): Mention[] => {
    const result = verifyMentions(text, findMentions(text, tax), tax)
    rejected += result.rejected.length
    // Keep only what a mention is: the matcher's positions are not needed later.
    return result.kept.map(({ skillId, quote, level }) => ({ skillId, quote, level }))
  }
  const prepared = prepare(inputs)
  return {
    method: 'dictionary',
    documents: [
      ...prepared.postings.map(({ posting, text }) => ({
        kind: 'posting' as const,
        title: posting.title,
        text,
        mentions: check(text),
      })),
      ...(prepared.resume.trim() !== ''
        ? [{ kind: 'resume' as const, title: 'Resume', text: prepared.resume, mentions: check(prepared.resume) }]
        : []),
    ],
    rejectedMentions: rejected,
    otherSkills: [],
    notes: [],
  }
}

/** The whole free pipeline with no review step. Used for the built-in sample and in tests. */
export function analyseWithDictionary(inputs: TextInputs, tax: Taxonomy): Analysis {
  return analysisFromExtraction(extractWithDictionary(inputs, tax), {}, inputs, tax)
}
