import { describe, expect, it } from 'vitest'
import { findMentions, sentences } from './matcher.ts'
import { taxonomy } from './taxonomy.ts'

const ids = (text: string) => [...new Set(findMentions(text, taxonomy).map((m) => m.skillId))].sort()

describe('findMentions: what counts as a skill', () => {
  it('finds names and aliases whatever the capitalisation', () => {
    expect(ids('We use PYTHON, postgres and k8s.')).toEqual(['kubernetes', 'postgresql', 'python'])
  })

  it('does not find Java inside JavaScript', () => {
    expect(ids('Strong JavaScript skills.')).toEqual(['javascript'])
  })

  it('tells C, C++ and C# apart', () => {
    expect(ids('Systems work in C, C++ and C#.')).toEqual(['c', 'cpp', 'csharp'])
  })

  it('prefers the longer name when two overlap', () => {
    expect(ids('Mobile apps in React Native.')).toEqual(['react-native'])
    expect(ids('Services in Node.js.')).toEqual(['nodejs'])
  })

  it('matches across a hyphen or a line break inside a name', () => {
    expect(ids('Solid object-oriented programming.')).toEqual(['oop'])
    expect(ids('Solid machine\nlearning background.')).toEqual(['machine-learning'])
  })

  it('accepts a simple plural', () => {
    expect(ids('Design REST APIs and data pipelines.')).toEqual(['data-pipelines', 'rest-api'])
  })

  it('ignores ordinary words that happen to be skill names', () => {
    expect(ids('You react quickly and go above and beyond.')).toEqual([])
    expect(ids('Excel at communication. Express interest early.')).toEqual([])
    expect(ids('The rest of the team is remote.')).toEqual([])
    expect(ids('Spring 2027 internship in R&D.')).toEqual([])
  })

  it('accepts those same words next to another skill', () => {
    expect(ids('Backend in Go, Python or Rust.')).toEqual(['go', 'python', 'rust'])
    expect(ids('Analysis in R and SQL.')).toEqual(['r', 'sql'])
    expect(ids('Java with Spring.')).toEqual(['java', 'spring'])
  })

  it('needs the right capitalisation for case-sensitive names', () => {
    expect(ids('Build interfaces in React.')).toEqual(['react'])
    expect(ids('Experience with RAG pipelines.')).toEqual(['rag'])
    expect(ids('A rag-tag team.')).toEqual([])
  })

  it('finds nothing in empty or unrelated text', () => {
    expect(ids('')).toEqual([])
    expect(ids('We sell handmade candles and value kindness.')).toEqual([])
  })
})

describe('findMentions: quotes', () => {
  it('quotes the sentence, as an exact piece of the text', () => {
    const text = 'About us.\n- Build services in Python.\n- Ship weekly.'
    const [mention] = findMentions(text, taxonomy)
    expect(mention!.quote).toBe('Build services in Python.')
    expect(text.includes(mention!.quote)).toBe(true)
  })

  it('shortens a very long sentence around the mention, still as an exact piece', () => {
    const text = `${'word '.repeat(80)}Python ${'word '.repeat(80)}`
    const [mention] = findMentions(text, taxonomy)
    expect(mention!.quote.length).toBeLessThanOrEqual(220)
    expect(mention!.quote).toContain('Python')
    expect(text.includes(mention!.quote)).toBe(true)
  })

  it('reports where the term sits', () => {
    const text = 'We like SQL.'
    const [mention] = findMentions(text, taxonomy)
    expect(text.slice(mention!.start, mention!.end)).toBe('SQL')
  })
})

describe('findMentions: required or preferred', () => {
  const level = (text: string, id: string) => findMentions(text, taxonomy).find((m) => m.skillId === id)?.level

  it('is required by default', () => {
    expect(level('Strong Python skills.', 'python')).toBe('required')
  })

  it('is preferred when the sentence says so', () => {
    expect(level('Familiarity with AWS is a plus.', 'aws')).toBe('preferred')
    expect(level('Bonus: Docker experience.', 'docker')).toBe('preferred')
  })

  it('is preferred under a "nice to have" heading, until the next heading', () => {
    const text = 'Requirements:\n- Python\nNice to have:\n- Docker\n- Kubernetes\nResponsibilities:\n- Maintain SQL reports'
    expect(level(text, 'python')).toBe('required')
    expect(level(text, 'docker')).toBe('preferred')
    expect(level(text, 'kubernetes')).toBe('preferred')
    expect(level(text, 'sql')).toBe('required')
  })
})

describe('sentences', () => {
  const cut = (text: string) => sentences(text).map((s) => text.slice(s.start, s.end))

  it('cuts at line breaks and sentence ends', () => {
    expect(cut('One thing. Another thing.\nThird')).toEqual(['One thing.', 'Another thing.', 'Third'])
  })

  it('does not cut inside Node.js', () => {
    expect(cut('We use Node.js for services.')).toEqual(['We use Node.js for services.'])
  })

  it('skips blank lines', () => {
    expect(cut('A\n\n\nB')).toEqual(['A', 'B'])
  })
})
