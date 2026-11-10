// The gate every extractor's output passes through, AI or not.
//
// A mention is only believed if its quote appears word for word in the text it
// claims to come from, and its skill is one we know. This is what stops an AI
// from inventing evidence: a made-up quote simply is not in the text.

import type { Mention, Taxonomy } from './types.ts'

export type Rejected = { mention: Mention; reason: 'unknown skill' | 'empty quote' | 'quote not in text' }

export type Verified = { kept: Mention[]; rejected: Rejected[] }

/** Collapses runs of spaces and line breaks, so a quote still matches if the AI tidied the spacing. */
const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

export function verifyMentions(text: string, mentions: Mention[], tax: Taxonomy): Verified {
  const haystack = squash(text)
  const kept: Mention[] = []
  const rejected: Rejected[] = []
  for (const mention of mentions) {
    const quote = squash(mention.quote)
    if (!tax.byId.has(mention.skillId)) rejected.push({ mention, reason: 'unknown skill' })
    else if (quote === '') rejected.push({ mention, reason: 'empty quote' })
    else if (!haystack.includes(quote)) rejected.push({ mention, reason: 'quote not in text' })
    else kept.push(mention)
  }
  return { kept, rejected }
}
