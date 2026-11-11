import { describe, expect, it } from 'vitest'
import { sampleLabel, samplePostings, sampleResume } from '../data/sampleTexts.ts'
import { analyseWithDictionary } from '../extract/dictionary.ts'
import { snapshotOf } from './progress.ts'
import { decodeShare, encodeShare, MAX_SHARE_LENGTH, shareFromHash } from './share.ts'
import { taxonomy } from './taxonomy.ts'
import type { Snapshot } from './types.ts'

const small: Snapshot = {
  at: '2026-11-10T00:00:00.000Z',
  postings: 6,
  skills: {
    python: { required: 5, preferred: 1, state: 'have' },
    docker: { required: 2, preferred: 2, state: 'gap' },
    react: { required: 3, preferred: 0, state: 'learned' },
  },
}

describe('share links', () => {
  it('writes the documented format', () => {
    expect(encodeShare(small)).toBe('1.6~docker.2.2.g~python.5.1.h~react.3.0.l')
  })

  it('reads back exactly what it wrote, apart from the date', () => {
    expect(decodeShare(encodeShare(small), taxonomy)).toEqual({ ...small, at: '' })
  })

  it('survives a round trip of the whole sample map and stays short', () => {
    const analysis = analyseWithDictionary(
      { label: sampleLabel, fictional: true, postings: samplePostings, resume: sampleResume },
      taxonomy,
    )
    const snapshot = snapshotOf(analysis, '')
    const text = encodeShare(snapshot)
    expect(decodeShare(text, taxonomy)).toEqual(snapshot)
    expect(text.length).toBeLessThan(2000)
    // Only letters, digits and three punctuation marks: safe to paste anywhere.
    expect(text).toMatch(/^[a-z0-9.~-]+$/)
  })

  it('never contains the pasted text', () => {
    const analysis = analyseWithDictionary(
      { label: 't', fictional: false, postings: ['Secret Corp\nRequirements: Python'], resume: 'Jane Doe, Python' },
      taxonomy,
    )
    const text = encodeShare(snapshotOf(analysis, ''))
    expect(text).not.toMatch(/secret|jane|doe/i)
  })

  it('skips a skill this version does not know, and keeps the rest', () => {
    expect(decodeShare('1.2~python.1.0.h~retired-skill.1.0.g', taxonomy)?.skills).toEqual({
      python: { required: 1, preferred: 0, state: 'have' },
    })
  })

  it.each([
    ['empty', ''],
    ['wrong version', '2.6~python.1.0.h'],
    ['no posting count', '1~python.1.0.h'],
    ['a count that is not a number', '1.6~python.x.0.h'],
    ['a negative count', '1.6~python.-1.0.h'],
    ['a huge count', '1.6~python.1000.0.h'],
    ['more mentions than postings', '1.2~python.2.1.h'],
    ['an unknown state', '1.6~python.1.0.z'],
    ['a missing field', '1.6~python.1.0'],
    ['an extra field', '1.6~python.1.0.h.h'],
    ['a script', '1.6~<script>alert(1)</script>'],
    ['too long', `1.6~${'python.1.0.h~'.repeat(MAX_SHARE_LENGTH)}`],
  ])('refuses a damaged link: %s', (_name, text) => {
    expect(decodeShare(text, taxonomy)).toBeNull()
  })

  it('finds the data in a page address, and ignores other addresses', () => {
    expect(shareFromHash('#share=1.6~python.1.0.h')).toBe('1.6~python.1.0.h')
    expect(shareFromHash('')).toBeNull()
    expect(shareFromHash('#somewhere-else')).toBeNull()
  })
})
