import { describe, expect, it } from 'vitest'
import { MAX_SNAPSHOTS, parseSaved, type SavedState } from './saved.ts'

const good: SavedState = {
  version: 1,
  draft: { postings: ['Requirements: Python'], resume: 'Python' },
  method: 'dictionary',
  claudeExtraction: null,
  corrections: { 'posting-20-abc': { removed: ['go'], added: [{ skillId: 'docker', level: 'preferred' }], levels: { python: 'preferred' } } },
  learned: { docker: { url: 'https://github.com/me/project', at: '2026-11-10T12:00:00.000Z' } },
  snapshots: [
    { at: '2026-11-10T12:00:00.000Z', postings: 1, skills: { python: { required: 1, preferred: 0, state: 'have' } } },
  ],
}

// What actually comes back from storage is a plain copy, so test with one.
const copy = (change: (draft: Record<string, unknown>) => void = () => {}) => {
  const value = JSON.parse(JSON.stringify(good)) as Record<string, unknown>
  change(value)
  return value
}

describe('parseSaved', () => {
  it('accepts what the app writes', () => {
    expect(parseSaved(copy())).toEqual(good)
  })

  it('treats nothing saved as nothing saved', () => {
    expect(parseSaved(undefined)).toBeNull()
    expect(parseSaved(null)).toBeNull()
  })

  it.each([
    ['a different version', (v: Record<string, unknown>) => (v.version = 2)],
    ['no draft', (v: Record<string, unknown>) => delete v.draft],
    ['postings that are not text', (v: Record<string, unknown>) => (v.draft = { postings: [1], resume: '' })],
    ['too many postings', (v: Record<string, unknown>) => (v.draft = { postings: Array(50).fill('x'), resume: '' })],
    ['a proof link that would run code', (v: Record<string, unknown>) => (v.learned = { docker: { url: 'javascript:alert(1)', at: '2026-11-10' } })],
    ['a proof with a bad date', (v: Record<string, unknown>) => (v.learned = { docker: { url: 'https://a.com', at: 'yesterday-ish' } })],
    ['a snapshot with a bad state', (v: Record<string, unknown>) => (v.snapshots = [{ at: '2026-11-10', postings: 1, skills: { python: { required: 1, preferred: 0, state: 'maybe' } } }])],
    ['a snapshot with a negative count', (v: Record<string, unknown>) => (v.snapshots = [{ at: '2026-11-10', postings: 1, skills: { python: { required: -1, preferred: 0, state: 'gap' } } }])],
  ])('ignores saved data with %s', (_name, change) => {
    expect(parseSaved(copy(change))).toBeNull()
  })

  it('keeps only the newest snapshots when there are too many', () => {
    const many = Array.from({ length: MAX_SNAPSHOTS + 5 }, (_, i) => ({
      at: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      postings: 1,
      skills: {},
    }))
    const parsed = parseSaved(copy((v) => (v.snapshots = many)))!
    expect(parsed.snapshots).toHaveLength(MAX_SNAPSHOTS)
    expect(parsed.snapshots[0]!.at).toBe('2026-10-06T00:00:00.000Z')
  })

  it('falls back to the free matcher when a Claude map was saved without its result', () => {
    const parsed = parseSaved(copy((v) => (v.method = 'claude')))!
    expect(parsed.method).toBe('dictionary')
    expect(parsed.claudeExtraction).toBeNull()
  })

  const claudeSave = (quote: string) =>
    copy((v) => {
      v.method = 'claude'
      v.claudeExtraction = {
        method: 'claude',
        documents: [
          { kind: 'posting', title: 'A job', text: 'Requirements: Python', mentions: [{ skillId: 'python', quote, level: 'required' }] },
        ],
        rejectedMentions: 0,
        otherSkills: [],
        notes: [],
      }
    })

  it('keeps what Claude found, so the text is not read (and paid for) again', () => {
    const parsed = parseSaved(claudeSave('Requirements: Python'))!
    expect(parsed.method).toBe('claude')
    expect(parsed.claudeExtraction!.documents[0]!.mentions).toHaveLength(1)
  })

  it('drops a saved Claude result whose quote is not in its text', () => {
    const parsed = parseSaved(claudeSave('Ten years of Rust'))!
    expect(parsed.method).toBe('dictionary')
    expect(parsed.claudeExtraction).toBeNull()
  })

  it('reads data saved before the review step existed', () => {
    expect(parseSaved(copy((v) => delete v.corrections))!.corrections).toEqual({})
  })

  it('ignores saved data with a correction to a level that does not exist', () => {
    expect(parseSaved(copy((v) => (v.corrections = { k: { removed: [], added: [], levels: { python: 'maybe' } } })))).toBeNull()
  })
})
