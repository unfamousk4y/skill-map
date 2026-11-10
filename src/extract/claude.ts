// The Claude pipeline: ask the server to read each document with Claude, then
// run the same quote check and scoring as the free pipeline.
//
// Two safety nets:
// - Every quote Claude returns is checked word for word against the document.
//   An invented quote is thrown away and counted.
// - If Claude cannot read a document (declined, cut off, network trouble), that
//   one document is read by the free matcher instead, and the result says so.

import { findMentions } from '../domain/matcher.ts'
import { buildAnalysis } from '../domain/score.ts'
import type { Analysis, Mention, Taxonomy } from '../domain/types.ts'
import { verifyMentions } from '../domain/verify.ts'
import type { DocumentKind, ExtractError, ExtractReply } from './claudeFormat.ts'
import { prepare, type TextInputs } from './dictionary.ts'

/** Sends one document to the server. Swapped for a fake in tests. */
export type Post = (body: { kind: DocumentKind; text: string }) => Promise<ExtractReply | ExtractError>

/** The real thing: a request to our own server, which holds the API key. */
export const postToServer: Post = async (body) => {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await response.json()) as ExtractReply | ExtractError
}

/** Errors that mean "stop now": trying the next document would fail the same way. */
const FATAL = new Set(['ai_off', 'bad_key', 'budget_reached'])

export class ClaudeUnavailable extends Error {}

export type Progress = { done: number; total: number; current: string }

export async function analyseWithClaude(
  inputs: TextInputs,
  tax: Taxonomy,
  post: Post = postToServer,
  onProgress: (progress: Progress) => void = () => {},
): Promise<Analysis> {
  const prepared = prepare(inputs)
  const documents: { kind: DocumentKind; name: string; text: string }[] = [
    ...prepared.postings.map(({ posting, text }) => ({ kind: 'posting' as const, name: posting.title, text })),
    ...(prepared.resume.trim() !== '' ? [{ kind: 'resume' as const, name: 'Resume', text: prepared.resume }] : []),
  ]

  let rejected = 0
  const notes: string[] = []
  const otherSkills = new Set<string>()
  const results: Mention[][] = []

  // One at a time, in order. The first call stores the standing instructions
  // in the API's cache and the rest reuse them cheaply, which only works if
  // they do not all start at once.
  for (const [index, doc] of documents.entries()) {
    onProgress({ done: index, total: documents.length, current: doc.name })

    let reply: ExtractReply | ExtractError
    try {
      reply = await post({ kind: doc.kind, text: doc.text })
    } catch {
      reply = { error: 'network', message: 'The server could not be reached.' }
    }

    if ('error' in reply && FATAL.has(reply.error)) throw new ClaudeUnavailable(reply.message)

    if ('status' in reply && reply.status === 'ok') {
      const checked = verifyMentions(doc.text, reply.mentions, tax)
      rejected += checked.rejected.length
      results.push(checked.kept)
      for (const skill of reply.otherSkills) otherSkills.add(skill)
    } else {
      // Fall back to the free matcher for this one document.
      const reason = 'error' in reply ? reply.message : reply.reason
      notes.push(`${doc.name}: read by the free matcher instead. ${reason}`)
      results.push(verifyMentions(doc.text, findMentions(doc.text, tax), tax).kept)
    }
  }
  onProgress({ done: documents.length, total: documents.length, current: '' })

  return buildAnalysis(
    {
      label: inputs.label,
      fictional: inputs.fictional,
      method: 'claude',
      postings: prepared.postings.map(({ posting }, index) => ({ posting, mentions: results[index] ?? [] })),
      resume: results[prepared.postings.length] ?? [],
      rejectedMentions: rejected,
      otherSkills: [...otherSkills].sort((a, b) => a.localeCompare(b)),
      notes,
    },
    tax,
  )
}
