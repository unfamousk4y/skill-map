import { describe, expect, it } from 'vitest'
import { analyseWithDictionary } from '../extract/dictionary.ts'
import { analysisFromSnapshot, applyLearned, compareSnapshots, coverage, snapshotOf, validProofUrl } from './progress.ts'
import { taxonomy } from './taxonomy.ts'

const run = (postings: string[], resume = '') =>
  analyseWithDictionary({ label: 't', fictional: false, postings, resume }, taxonomy)

const proof = { url: 'https://github.com/me/project', at: '2026-11-10T12:00:00.000Z' }

describe('validProofUrl', () => {
  it('accepts a normal web address and tidies it', () => {
    expect(validProofUrl('  https://github.com/me/project ')).toBe('https://github.com/me/project')
  })

  it('refuses links that could run code or are not web addresses', () => {
    expect(validProofUrl('javascript:alert(1)')).toBeNull()
    expect(validProofUrl('data:text/html,<script>1</script>')).toBeNull()
    expect(validProofUrl('file:///C:/secret.txt')).toBeNull()
    expect(validProofUrl('github.com/me')).toBeNull()
    expect(validProofUrl('')).toBeNull()
    expect(validProofUrl(`https://a.com/${'x'.repeat(600)}`)).toBeNull()
  })
})

describe('applyLearned', () => {
  const base = run(['Requirements:\n- Docker\n- Kubernetes\n- Python'], 'Built a scraper in Python.')

  it('returns the same analysis when nothing is marked', () => {
    expect(applyLearned(base, {}, taxonomy)).toBe(base)
  })

  it('turns a gap into a skill the person has, and keeps the proof', () => {
    const after = applyLearned(base, { docker: proof }, taxonomy)
    const docker = after.findings.find((f) => f.id === 'docker')!
    expect(docker.have).toBe(true)
    expect(docker.learned).toEqual(proof)
    expect(after.learningOrder).not.toContain('docker')
  })

  it('does not change the analysis it was given', () => {
    applyLearned(base, { docker: proof }, taxonomy)
    expect(base.findings.find((f) => f.id === 'docker')!.have).toBe(false)
    expect(base.learningOrder).toContain('docker')
  })

  it('counts what a learned skill builds on as known too', () => {
    // Kubernetes builds on Docker in our list.
    const after = applyLearned(base, { kubernetes: proof }, taxonomy)
    const docker = after.findings.find((f) => f.id === 'docker')!
    expect(docker.have).toBe(true)
    expect(docker.impliedBy).toEqual(['Kubernetes'])
    expect(after.learningOrder).toEqual([])
  })

  it('moves the next recommendation on once a skill is learned', () => {
    // Docker builds on Linux, so Linux is where the path starts.
    expect(base.next).toEqual(['linux'])
    const after = applyLearned(base, { docker: proof }, taxonomy)
    expect(after.next).toContain('kubernetes')
  })

  it('leaves a skill alone when the resume already names it', () => {
    const after = applyLearned(base, { python: proof }, taxonomy)
    const python = after.findings.find((f) => f.id === 'python')!
    expect(python.learned).toBeUndefined()
    expect(python.resumeQuotes).toHaveLength(1)
  })

  it('ignores an id that is not a skill', () => {
    expect(applyLearned(base, { 'not-a-skill': proof }, taxonomy)).toBe(base)
  })
})

describe('snapshots', () => {
  const before = run(['Requirements:\n- Docker\n- Python'], 'Built a scraper in Python.')
  const snapBefore = snapshotOf(before, '2026-11-01T00:00:00.000Z')

  it('holds counts and states but no text', () => {
    expect(snapBefore.skills.docker).toEqual({ required: 1, preferred: 0, state: 'gap' })
    expect(snapBefore.skills.python).toEqual({ required: 1, preferred: 0, state: 'have' })
    expect(JSON.stringify(snapBefore)).not.toContain('scraper')
  })

  it('counts coverage over asked-for skills only', () => {
    expect(coverage(snapBefore)).toEqual({ covered: 1, asked: 2 })
  })

  it('reports no change against itself', () => {
    expect(compareSnapshots(snapBefore, snapBefore).same).toBe(true)
  })

  it('spots a skill that became covered', () => {
    const after = snapshotOf(applyLearned(before, { docker: proof }, taxonomy), '2026-11-10T00:00:00.000Z')
    const changes = compareSnapshots(snapBefore, after)
    expect(after.skills.docker!.state).toBe('learned')
    expect(changes.nowCovered).toEqual(['docker'])
    expect(changes.after).toEqual({ covered: 2, asked: 2 })
    expect(changes.same).toBe(false)
  })

  it('counts a learned stepping stone as progress, though no posting names it', () => {
    // Linux is not asked for here; it is on the way to Docker.
    const after = snapshotOf(applyLearned(before, { linux: proof }, taxonomy), '2026-11-10T00:00:00.000Z')
    expect(snapBefore.skills.linux).toBeUndefined()
    expect(compareSnapshots(snapBefore, after).nowCovered).toEqual(['linux'])
  })

  it('does not call an old resume skill progress just because a new posting asks for it', () => {
    const after = snapshotOf(
      run(['Requirements:\n- Docker\n- Python\n- SQL'], 'Built a scraper in Python. Wrote SQL reports.'),
      '2026-11-10T00:00:00.000Z',
    )
    const changes = compareSnapshots(snapshotOf(run(['Requirements:\n- Docker\n- Python'], 'Built a scraper in Python. Wrote SQL reports.'), ''), after)
    expect(changes.newlyAsked).toEqual(['sql'])
    expect(changes.nowCovered).toEqual([])
  })

  it('spots skills that are newly asked for, dropped, or no longer covered', () => {
    const after = snapshotOf(run(['Requirements:\n- Docker\n- Terraform\n- Python'], ''), '2026-11-10T00:00:00.000Z')
    const dropped = snapshotOf(run(['Requirements:\n- Python'], 'Built a scraper in Python.'), '2026-11-10T00:00:00.000Z')
    expect(compareSnapshots(snapBefore, after).newlyAsked).toEqual(['terraform'])
    expect(compareSnapshots(snapBefore, after).noLongerCovered).toEqual(['python'])
    expect(compareSnapshots(snapBefore, dropped).noLongerAsked).toEqual(['docker'])
  })
})

describe('analysisFromSnapshot', () => {
  it('rebuilds a map with the same gaps and learning order, and no quotes', () => {
    const original = run(['Requirements:\n- Docker\n- Kubernetes\n- Python'], 'Built a scraper in Python.')
    const rebuilt = analysisFromSnapshot(snapshotOf(original, ''), 'Shared map', taxonomy)
    expect(rebuilt.learningOrder).toEqual(original.learningOrder)
    expect(rebuilt.next).toEqual(original.next)
    expect(rebuilt.postings).toHaveLength(1)
    expect(rebuilt.findings.every((f) => f.postingQuotes.length === 0 && f.resumeQuotes.length === 0)).toBe(true)
  })

  it('drops skills this version of the list does not have', () => {
    const rebuilt = analysisFromSnapshot(
      { at: '', postings: 1, skills: { 'gone-skill': { required: 1, preferred: 0, state: 'gap' } } },
      'Shared map',
      taxonomy,
    )
    expect(rebuilt.findings).toEqual([])
  })
})
