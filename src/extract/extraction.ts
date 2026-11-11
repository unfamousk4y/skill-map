// What an extractor hands over before anything is counted: each document,
// with the skills found in it. The student reviews this, and only then is it
// scored into a map.
//
//   extract (matcher or Claude)  ->  Extraction  ->  student's corrections  ->  Analysis

import { applyCorrections, isUntouched, type DocCorrections } from '../domain/review.ts'
import { buildAnalysis } from '../domain/score.ts'
import type { Analysis, Mention, Taxonomy } from '../domain/types.ts'

export type DocumentReading = {
  kind: 'posting' | 'resume'
  title: string
  text: string
  /** Checked word for word against the text already. */
  mentions: Mention[]
}

export type Extraction = {
  method: 'dictionary' | 'claude'
  /** Postings first, in order, then the resume if there is one. */
  documents: DocumentReading[]
  /** Findings thrown away because their quote was not in the text. */
  rejectedMentions: number
  otherSkills: string[]
  notes: string[]
}

/** The student's changes, by document key. */
export type Corrections = Record<string, DocCorrections>

/**
 * A short fingerprint of a document. Corrections are filed under it, so they
 * stay attached to a posting when others are added or removed around it, and
 * are dropped when its text changes.
 */
export function docKey(doc: Pick<DocumentReading, 'kind' | 'text'>): string {
  let hash = 5381
  for (let i = 0; i < doc.text.length; i++) hash = ((hash * 33) ^ doc.text.charCodeAt(i)) >>> 0
  return `${doc.kind}-${doc.text.length}-${hash.toString(36)}`
}

/** Counts and ranks a reviewed extraction into the analysis the map shows. */
export function analysisFromExtraction(
  extraction: Extraction,
  corrections: Corrections,
  about: { label: string; fictional: boolean },
  tax: Taxonomy,
): Analysis {
  const corrected = (doc: DocumentReading) => applyCorrections(doc.mentions, corrections[docKey(doc)])
  const postings = extraction.documents.filter((d) => d.kind === 'posting')
  const resume = extraction.documents.find((d) => d.kind === 'resume')

  // Say on the map that a person has been over the findings, and how much they changed.
  const touched = extraction.documents.map((d) => corrections[docKey(d)]).filter((c) => !isUntouched(c))
  const removed = touched.reduce((n, c) => n + c!.removed.length, 0)
  const added = touched.reduce((n, c) => n + c!.added.length, 0)
  const relabelled = touched.reduce((n, c) => n + Object.keys(c!.levels).length, 0)
  const notes = [...extraction.notes]
  if (touched.length > 0) {
    notes.push(`Your review changed the findings: ${removed} removed, ${added} added, ${relabelled} re-labelled.`)
  }

  return buildAnalysis(
    {
      ...about,
      method: extraction.method,
      postings: postings.map((doc, index) => ({
        posting: { id: `p${index + 1}`, title: doc.title },
        mentions: corrected(doc),
      })),
      resume: resume ? corrected(resume) : [],
      rejectedMentions: extraction.rejectedMentions,
      otherSkills: extraction.otherSkills,
      notes,
    },
    tax,
  )
}
