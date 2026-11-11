import { describe, expect, it } from 'vitest'
import { analyseWithDictionary, extractWithDictionary } from '../extract/dictionary.ts'
import { analysisFromExtraction, docKey } from '../extract/extraction.ts'
import { applyCorrections, evidenceFor, highlight, noCorrections, reviewRows, summarise } from './review.ts'
import { taxonomy } from './taxonomy.ts'
import type { Mention } from './types.ts'

const mention = (skillId: string, quote: string, level: Mention['level'] = 'required'): Mention => ({ skillId, quote, level })

describe('evidenceFor', () => {
  it('is high when the quote names the skill, and points at the name', () => {
    const quote = 'Experience with PostgreSQL and Docker'
    const evidence = evidenceFor(mention('postgresql', quote), taxonomy)
    expect(evidence.confidence).toBe('high')
    expect(quote.slice(evidence.start, evidence.end)).toBe('PostgreSQL')
  })

  it('is high for a known alias', () => {
    expect(evidenceFor(mention('kubernetes', 'We deploy on k8s'), taxonomy).confidence).toBe('high')
  })

  it('is medium for a name that is also an ordinary word', () => {
    // "Go" only counts next to another skill, and even then it is worth a look.
    const evidence = evidenceFor(mention('go', 'Go is a bonus, as is Python'), taxonomy)
    expect(evidence.confidence).toBe('medium')
    expect(evidenceFor(mention('swift', 'Native iOS in Swift'), taxonomy).confidence).toBe('medium')
  })

  it('is low when the quote describes the skill without naming it, and covers the whole quote', () => {
    const quote = 'keep slow lookups fast by storing recent results in memory'
    const evidence = evidenceFor(mention('caching', quote), taxonomy)
    expect(evidence).toMatchObject({ confidence: 'low', start: 0, end: quote.length })
  })
})

describe('reviewRows and summarise', () => {
  const rows = reviewRows(
    [
      mention('python', 'Python and SQL', 'preferred'),
      mention('python', 'Strong Python'),
      mention('go', 'Go is a bonus, as is Python', 'preferred'),
      mention('caching', 'storing recent results in memory'),
    ],
    taxonomy,
  )

  it('gives one row per skill, with required winning', () => {
    expect(rows.map((r) => r.skillId).sort()).toEqual(['caching', 'go', 'python'])
    expect(rows.find((r) => r.skillId === 'python')!.level).toBe('required')
  })

  it('puts the least certain first', () => {
    expect(rows.map((r) => r.evidence.confidence)).toEqual(['low', 'medium', 'high'])
  })

  it('scores the share that are named outright', () => {
    expect(summarise(rows)).toEqual({ high: 1, medium: 1, low: 1, score: 33 })
    expect(summarise([]).score).toBeNull()
  })
})

describe('applyCorrections', () => {
  const found = [mention('python', 'Python'), mention('go', 'Go and Python', 'preferred')]

  it('returns the same list when nothing was changed', () => {
    expect(applyCorrections(found, undefined)).toBe(found)
    expect(applyCorrections(found, noCorrections())).toBe(found)
  })

  it('removes, re-labels and adds', () => {
    const result = applyCorrections(found, {
      removed: ['go'],
      added: [{ skillId: 'docker', level: 'preferred' }],
      levels: { python: 'preferred' },
    })
    expect(result).toEqual([
      { skillId: 'python', quote: 'Python', level: 'preferred' },
      { skillId: 'docker', quote: '', level: 'preferred', manual: true },
    ])
    expect(found[0]!.level).toBe('required') // the input is untouched
  })

  it('does not add a skill twice when the extractor already found it', () => {
    const result = applyCorrections(found, { removed: [], added: [{ skillId: 'python', level: 'required' }], levels: {} })
    expect(result.filter((m) => m.skillId === 'python')).toHaveLength(1)
  })
})

describe('highlight', () => {
  const text = 'Backend Intern\nRequirements:\n- Python and SQL\n- Docker is a plus'
  const mentions = extractWithDictionary({ label: 't', fictional: false, postings: [text], resume: '' }, taxonomy)
    .documents[0]!.mentions

  it('gives back the text exactly when the pieces are joined', () => {
    const segments = highlight(text, mentions, taxonomy)
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })

  it('highlights just the names, not the whole line', () => {
    const marked = highlight(text, mentions, taxonomy).filter((s) => s.skillIds.length > 0)
    expect(marked.map((s) => s.text)).toEqual(['Python', 'SQL', 'Docker'])
    expect(marked.map((s) => s.skillIds)).toEqual([['python'], ['sql'], ['docker']])
  })

  it('highlights the whole quote for a described skill, across a line break', () => {
    const doc = 'You keep lookups fast by storing\nrecent results in memory.'
    const segments = highlight(doc, [mention('caching', 'storing recent results in memory')], taxonomy)
    expect(segments.find((s) => s.skillIds.includes('caching'))!.text).toBe('storing\nrecent results in memory')
    expect(segments.map((s) => s.text).join('')).toBe(doc)
  })

  it('skips a quote it cannot find, and anything added by hand', () => {
    const segments = highlight(text, [mention('rust', 'ten years of Rust'), { ...mention('go', ''), manual: true }], taxonomy)
    expect(segments).toEqual([{ text, skillIds: [] }])
  })

  it('treats text with special characters as plain text', () => {
    const doc = 'Know C++ (and [regex] *stars*) plus Python?'
    const segments = highlight(doc, [mention('python', doc)], taxonomy)
    expect(segments.map((s) => s.text).join('')).toBe(doc)
  })
})

describe('a reviewed map, end to end', () => {
  const inputs = { label: 't', fictional: false, postings: ['Requirements:\n- Python\n- Docker'], resume: 'Built things in Python.' }
  const extraction = extractWithDictionary(inputs, taxonomy)
  const [posting, resume] = extraction.documents

  it('matches the unreviewed pipeline when nothing is corrected', () => {
    expect(analysisFromExtraction(extraction, {}, inputs, taxonomy)).toEqual(analyseWithDictionary(inputs, taxonomy))
  })

  it('drops a removed skill from the map and says the review changed things', () => {
    const analysis = analysisFromExtraction(
      extraction,
      { [docKey(posting!)]: { removed: ['docker'], added: [], levels: {} } },
      inputs,
      taxonomy,
    )
    expect(analysis.findings.find((f) => f.id === 'docker')).toBeUndefined()
    expect(analysis.notes).toEqual(['Your review changed the findings: 1 removed, 0 added, 0 re-labelled.'])
  })

  it('counts a skill added to the resume as one the student has, with no invented quote', () => {
    const analysis = analysisFromExtraction(
      extraction,
      { [docKey(resume!)]: { removed: [], added: [{ skillId: 'docker', level: 'required' }], levels: {} } },
      inputs,
      taxonomy,
    )
    const docker = analysis.findings.find((f) => f.id === 'docker')!
    expect(docker).toMatchObject({ have: true, addedByYou: true, resumeQuotes: [] })
    expect(docker.impliedBy).toBeUndefined()
    expect(analysis.learningOrder).not.toContain('docker')
  })

  it('counts a skill added to a posting, with no quote', () => {
    const analysis = analysisFromExtraction(
      extraction,
      { [docKey(posting!)]: { removed: [], added: [{ skillId: 'terraform', level: 'preferred' }], levels: {} } },
      inputs,
      taxonomy,
    )
    expect(analysis.findings.find((f) => f.id === 'terraform')).toMatchObject({ preferred: 1, postingQuotes: [], addedByYou: true })
  })

  it('files corrections under the document text, so editing the text drops them', () => {
    expect(docKey(posting!)).toBe(docKey({ kind: 'posting', text: posting!.text }))
    expect(docKey(posting!)).not.toBe(docKey({ kind: 'posting', text: posting!.text + ' ' }))
    expect(docKey(posting!)).not.toBe(docKey({ kind: 'resume', text: posting!.text }))
  })
})
