// The free extractor: finds skills in text by looking up names in the taxonomy.
// No AI. It runs in the browser in a few milliseconds.
//
// It is deliberately simple, and it is the baseline the Claude extractor gets
// measured against in milestone 5. What it cannot do: notice a skill that is
// described without being named ("you have put a model into production").

import type { Mention, Taxonomy } from './types.ts'

/** A mention plus where it sits in the text. */
export type FoundMention = Mention & { term: string; start: number; end: number }

type Term = { text: string; skillId: string; mode: 'loose' | 'cased' | 'listed' }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Turns a term into a pattern piece. A space in the term also matches a hyphen or a line break. */
const pattern = (term: string) => term.trim().split(/\s+/).map(escape).join('[\\s-]+')

// A term must not be glued to other letters or digits: "Java" is not inside
// "JavaScript". The + and # after it matter too: "C" is not "C++" or "C#".
const BEFORE = '(?<![A-Za-z0-9])'
const AFTER = '(?![A-Za-z0-9+#])'

type Matcher = { loose: RegExp; exact: RegExp; terms: Map<string, Term> }
const cache = new WeakMap<Taxonomy, Matcher>()

const key = (text: string) => text.toLowerCase().replace(/[\s-]+/g, ' ')

function matcherFor(tax: Taxonomy): Matcher {
  const known = cache.get(tax)
  if (known) return known

  const loose: Term[] = []
  const exact: Term[] = []
  for (const skill of tax.skills) {
    const special = new Set([...(skill.cased ?? []), ...(skill.listed ?? [])])
    for (const text of [skill.name, ...skill.aliases]) {
      // A name that is also listed as "cased" or "listed" is only matched the strict way.
      if (!special.has(text)) loose.push({ text, skillId: skill.id, mode: 'loose' })
    }
    for (const text of skill.cased ?? []) exact.push({ text, skillId: skill.id, mode: 'cased' })
    for (const text of skill.listed ?? []) exact.push({ text, skillId: skill.id, mode: 'listed' })
  }

  // Longest first, so "React Native" wins over "React" when both could start here.
  const longestFirst = (a: Term, b: Term) => b.text.length - a.text.length
  // Ordinary terms of 4+ letters also match with a plural "s": "microservice" / "microservices".
  const loosePiece = (t: Term) => pattern(t.text) + (t.text.length >= 4 && !/s$/i.test(t.text) ? 's?' : '')
  const build = (terms: Term[], piece: (t: Term) => string, flags: string) =>
    new RegExp(`${BEFORE}(?:${terms.sort(longestFirst).map(piece).join('|') || '(?!)'})${AFTER}`, flags)

  const terms = new Map<string, Term>()
  for (const t of loose) terms.set('loose:' + key(t.text), t)
  for (const t of exact) terms.set('exact:' + t.text, t)

  const made: Matcher = {
    loose: build(loose, loosePiece, 'gi'),
    exact: build(exact, (t) => pattern(t.text), 'g'),
    terms,
  }
  cache.set(tax, made)
  return made
}

export type Span = { start: number; end: number }

/**
 * Cuts text into sentence-sized pieces: at line breaks, and after . ! ? when
 * a new sentence starts. "Node.js is" is not cut, because no space follows the dot.
 */
export function sentences(text: string): Span[] {
  const spans: Span[] = []
  const boundary = /\n+|(?<=[.!?])\s+(?=[A-Z0-9"'([])/g
  let start = 0
  const push = (end: number) => {
    if (text.slice(start, end).trim() !== '') spans.push({ start, end })
  }
  for (const m of text.matchAll(boundary)) {
    push(m.index)
    start = m.index + m[0].length
  }
  push(text.length)
  return spans
}

const PREFERRED =
  /\b(preferred|nice[\s-]to[\s-]haves?|bonus|plus|pluses|desired|ideally|optional|good[\s-]to[\s-]have|not required|would be (?:great|nice|helpful))\b/i
const HEADING =
  /^(requirements?|qualifications?|minimum|basic|required|must[\s-]haves?|preferred|nice[\s-]to[\s-]haves?|bonus|responsibilities|what you|what we|who you|about|skills|you have|you will|you'll)/i

/**
 * A short line that introduces a section, such as "Nice to have:" or
 * "Requirements". A line that itself names a skill ("Bonus: Docker") is not a
 * heading unless it ends with a colon, so it cannot flip everything after it.
 */
function isHeading(line: string, namesASkill: boolean): boolean {
  const t = line.trim().replace(/^[#*\s-]+/, '')
  if (t.length === 0 || t.length > 60) return false
  return t.endsWith(':') || (HEADING.test(t) && !namesASkill && !/[.!?]$/.test(t))
}

const MAX_QUOTE = 220

/** The sentence around a mention, cut down around the mention if the sentence is very long. Always an exact piece of the text. */
function quoteFor(text: string, sentence: Span, start: number, end: number): string {
  let from = sentence.start
  let to = sentence.end
  if (to - from > MAX_QUOTE) {
    from = Math.max(from, start - 90)
    to = Math.min(to, end + 110)
    // Do not cut in the middle of a word.
    while (from > sentence.start && /\S/.test(text[from - 1]!)) from++
    while (to < sentence.end && /\S/.test(text[to]!)) to--
  }
  // Drop bullet marks and spaces at the start. What is left is still a piece of the text.
  return text.slice(from, to).replace(/^[\s•·▪●*-]+/, '').trim()
}

/**
 * Finds every skill named in the text.
 * For a posting, each mention is marked required or preferred from the words
 * around it and the section it sits in.
 */
export function findMentions(text: string, tax: Taxonomy): FoundMention[] {
  const { loose, exact, terms } = matcherFor(tax)
  type Hit = Span & { term: Term; matched: string }
  const hits: Hit[] = []

  for (const m of text.matchAll(loose)) {
    const matched = m[0]
    const term = terms.get('loose:' + key(matched)) ?? terms.get('loose:' + key(matched.replace(/s$/i, '')))
    if (term) hits.push({ start: m.index, end: m.index + matched.length, term, matched })
  }
  for (const m of text.matchAll(exact)) {
    const term = terms.get('exact:' + m[0].replace(/[\s-]+/g, ' '))
    if (term) hits.push({ start: m.index, end: m.index + m[0].length, term, matched: m[0] })
  }

  // Where two hits overlap, the longer one is the real one ("Node.js" over "Node").
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)
  const kept: Hit[] = []
  for (const hit of hits) {
    if (!kept.some((k) => hit.start < k.end && hit.end > k.start)) kept.push(hit)
  }
  kept.sort((a, b) => a.start - b.start)

  // Work out which section each sentence is in. A heading such as
  // "Nice to have:" makes everything under it preferred until the next heading.
  const spans = sentences(text)
  let sectionPreferred = false
  const out: FoundMention[] = []
  for (const span of spans) {
    const line = text.slice(span.start, span.end)
    // A name broken over two lines belongs to the line it starts on.
    const inside = kept.filter((h) => h.start >= span.start && h.start < span.end)
    if (isHeading(line, inside.length > 0)) sectionPreferred = PREFERRED.test(line)
    for (const hit of inside) {
      // "Go", "C", "R" and friends only count next to a skill that is not
      // itself one of these doubtful words.
      const hasSolidNeighbour = inside.some(
        (o) => o.term.mode !== 'listed' && o.term.skillId !== hit.term.skillId,
      )
      if (hit.term.mode === 'listed' && !hasSolidNeighbour) continue
      out.push({
        skillId: hit.term.skillId,
        term: hit.matched,
        start: hit.start,
        end: hit.end,
        quote: quoteFor(text, span, hit.start, hit.end),
        level: sectionPreferred || PREFERRED.test(line) ? 'preferred' : 'required',
      })
    }
  }
  return out
}
