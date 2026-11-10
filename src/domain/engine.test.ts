// Tests for the three steps after extraction: verify, rank, score.

import { describe, expect, it } from 'vitest'
import { rankGaps } from './rank.ts'
import { buildAnalysis, demandScore } from './score.ts'
import { buildTaxonomy, taxonomy } from './taxonomy.ts'
import type { Mention } from './types.ts'
import { verifyMentions } from './verify.ts'

const m = (skillId: string, quote: string, level: Mention['level'] = 'required'): Mention => ({
  skillId,
  quote,
  level,
})

describe('verifyMentions', () => {
  const text = 'We need strong Python skills.\nDocker is a plus.'

  it('keeps a mention whose quote is in the text', () => {
    const { kept, rejected } = verifyMentions(text, [m('python', 'We need strong Python skills.')], taxonomy)
    expect(kept).toHaveLength(1)
    expect(rejected).toEqual([])
  })

  it('rejects a quote that was made up', () => {
    const fake = m('kubernetes', 'Five years of Kubernetes required.')
    expect(verifyMentions(text, [fake], taxonomy).rejected).toEqual([{ mention: fake, reason: 'quote not in text' }])
  })

  it('rejects a quote that changes one word', () => {
    const { rejected } = verifyMentions(text, [m('python', 'We need expert Python skills.')], taxonomy)
    expect(rejected[0]!.reason).toBe('quote not in text')
  })

  it('rejects a skill that is not in the taxonomy', () => {
    const { rejected } = verifyMentions(text, [m('cobol-wizardry', 'Docker is a plus.')], taxonomy)
    expect(rejected[0]!.reason).toBe('unknown skill')
  })

  it('rejects an empty quote', () => {
    expect(verifyMentions(text, [m('python', '   ')], taxonomy).rejected[0]!.reason).toBe('empty quote')
  })

  it('forgives differences in spacing and line breaks only', () => {
    const tidy = m('python', 'We need strong  Python skills. Docker is a plus.')
    expect(verifyMentions(text, [tidy], taxonomy).kept).toHaveLength(1)
  })
})

// A small made-up taxonomy keeps the ranking tests easy to follow:
//   linux -> docker -> kubernetes        python (no prerequisites)
const cat = [{ id: 'x', name: 'X' }]
const skill = (id: string, pre: string[] = []) => ({ id, name: id, aliases: [], cat: 'x', pre })
const small = buildTaxonomy({
  version: 't',
  categories: cat,
  skills: [skill('linux'), skill('docker', ['linux']), skill('kubernetes', ['docker']), skill('python'), skill('sql')],
})

describe('rankGaps', () => {
  it('never puts a skill before something it depends on', () => {
    const { order } = rankGaps(new Map([['kubernetes', 3]]), new Set(), small)
    expect(order).toEqual(['linux', 'docker', 'kubernetes'])
  })

  it('counts what a skill unlocks, at half weight', () => {
    const { value, unlocks } = rankGaps(new Map([['kubernetes', 2], ['docker', 1]]), new Set(), small)
    expect(value.get('kubernetes')).toBe(2)
    expect(value.get('docker')).toBe(1 + 0.5 * 2)
    expect(value.get('linux')).toBe(0 + 0.5 * (2 + 1))
    expect(unlocks.get('linux')!.sort()).toEqual(['docker', 'kubernetes'])
  })

  it('only suggests starting on skills whose prerequisites are met', () => {
    const { next } = rankGaps(new Map([['kubernetes', 5], ['python', 1]]), new Set(), small)
    // Kubernetes is wanted most, but Linux has to come first.
    expect(next).toEqual(['linux', 'python'])
  })

  it('skips prerequisites the person already has', () => {
    const { order, next } = rankGaps(new Map([['kubernetes', 1]]), new Set(['linux', 'docker']), small)
    expect(order).toEqual(['kubernetes'])
    expect(next).toEqual(['kubernetes'])
  })

  it('ignores skills the person already has', () => {
    expect(rankGaps(new Map([['python', 4]]), new Set(['python']), small).order).toEqual([])
  })

  it('puts the higher value first, and breaks ties by name', () => {
    const { next } = rankGaps(new Map([['sql', 1], ['python', 1], ['linux', 2]]), new Set(), small)
    expect(next).toEqual(['linux', 'python', 'sql'])
  })

  it('returns nothing when nothing is asked for', () => {
    expect(rankGaps(new Map(), new Set(), small)).toMatchObject({ order: [], next: [] })
  })
})

describe('buildAnalysis', () => {
  const posting = (id: string, mentions: Mention[]) => ({ posting: { id, title: `Posting ${id}` }, mentions })
  const build = (postings: ReturnType<typeof posting>[], resume: Mention[] = []) =>
    buildAnalysis({ label: 'test', fictional: true, postings, resume }, taxonomy)
  const find = (analysis: ReturnType<typeof build>, id: string) => analysis.findings.find((f) => f.id === id)

  it('counts a posting once per skill, however often it names it', () => {
    const a = build([posting('1', [m('python', 'a'), m('python', 'b'), m('python', 'c')])])
    expect(find(a, 'python')).toMatchObject({ required: 1, preferred: 0 })
    expect(find(a, 'python')!.postingQuotes).toHaveLength(1)
  })

  it('lets required win when a posting says both', () => {
    const a = build([posting('1', [m('docker', 'nice', 'preferred'), m('docker', 'must', 'required')])])
    expect(find(a, 'docker')).toMatchObject({ required: 1, preferred: 0 })
    expect(find(a, 'docker')!.postingQuotes[0]!.text).toBe('must')
  })

  it('adds up across postings', () => {
    const a = build([
      posting('1', [m('docker', 'a')]),
      posting('2', [m('docker', 'b', 'preferred')]),
      posting('3', [m('docker', 'c', 'preferred')]),
    ])
    expect(find(a, 'docker')).toMatchObject({ required: 1, preferred: 2 })
    expect(demandScore(find(a, 'docker')!)).toBe(2)
  })

  it('marks resume skills as had, with the quote', () => {
    const a = build([posting('1', [m('python', 'a')])], [m('python', 'Built X in Python')])
    expect(find(a, 'python')).toMatchObject({ have: true })
    expect(find(a, 'python')!.resumeQuotes).toEqual([{ source: 'Resume', text: 'Built X in Python' }])
    expect(a.next).toEqual([])
  })

  it('treats the prerequisites of a shown skill as had, and says why', () => {
    const a = build([posting('1', [m('javascript', 'a')])], [m('react', 'Built a React app')])
    expect(find(a, 'javascript')).toMatchObject({ have: true, impliedBy: ['React'] })
    expect(find(a, 'react')!.impliedBy).toBeUndefined()
  })

  it('suggests a stepping stone first when the wanted skill is not reachable yet', () => {
    const a = build([posting('1', [m('kubernetes', 'a')])])
    expect(a.learningOrder).toEqual(['linux', 'docker', 'kubernetes'])
    expect(a.next).toEqual(['linux'])
    expect(a.unlocks.linux).toEqual(['kubernetes'])
  })

  it('ignores mentions of unknown skills', () => {
    const a = build([posting('1', [m('not-a-skill', 'a')])], [m('also-not', 'b')])
    expect(a.findings).toEqual([])
  })

  it('gives an empty, valid analysis for no input', () => {
    expect(build([])).toMatchObject({ findings: [], next: [], learningOrder: [], postings: [] })
  })

  it('does not depend on the order mentions arrive in', () => {
    const one = build([posting('1', [m('python', 'a'), m('docker', 'b')])])
    const two = build([posting('1', [m('docker', 'b'), m('python', 'a')])])
    expect(two).toEqual(one)
  })
})
