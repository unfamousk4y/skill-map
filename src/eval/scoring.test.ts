import { describe, expect, it } from 'vitest'
import { collapse, scorePosting, summarise, type Prediction } from './scoring.ts'

const p = (skillId: string, level: Prediction['level'] = 'required'): Prediction => ({ skillId, level })

describe('collapse', () => {
  it('keeps one entry per skill and lets required win, whatever the order', () => {
    expect(collapse([p('a', 'preferred'), p('a', 'required'), p('a', 'preferred')])).toEqual([p('a', 'required')])
    expect(collapse([p('a', 'required'), p('a', 'preferred')])).toEqual([p('a', 'required')])
  })
})

describe('scorePosting', () => {
  const key = { required: ['python', 'sql'], preferred: ['docker'], described: ['docker'] }

  it('gives full marks for an exact answer', () => {
    const score = scorePosting(key, [p('python'), p('sql'), p('docker', 'preferred')])
    expect(score).toMatchObject({ correct: ['docker', 'python', 'sql'], missed: [], extra: [], wrongLevel: [] })
    expect(score).toMatchObject({ describedFound: 1, describedTotal: 1 })
  })

  it('lists what was missed and what was extra', () => {
    const score = scorePosting(key, [p('python'), p('kubernetes')])
    expect(score.correct).toEqual(['python'])
    expect(score.missed).toEqual(['docker', 'sql'])
    expect(score.extra).toEqual(['kubernetes'])
    expect(score.describedFound).toBe(0)
  })

  it('counts a right skill at the wrong level as correct, and notes the level', () => {
    const score = scorePosting(key, [p('python', 'preferred'), p('sql'), p('docker')])
    expect(score.correct).toHaveLength(3)
    expect(score.wrongLevel).toEqual(['docker', 'python'])
  })

  it('handles a posting that asks for nothing', () => {
    const empty = { required: [], preferred: [] }
    expect(scorePosting(empty, [])).toMatchObject({ correct: [], missed: [], extra: [] })
    expect(scorePosting(empty, [p('go')]).extra).toEqual(['go'])
  })

  it('treats a skill listed as both required and preferred in the key as required', () => {
    const score = scorePosting({ required: ['a'], preferred: ['a'] }, [p('a', 'required')])
    expect(score.wrongLevel).toEqual([])
  })
})

describe('summarise', () => {
  it('adds up counts across postings before dividing', () => {
    const scores = [
      scorePosting({ required: ['a', 'b', 'c', 'd'], preferred: [] }, [p('a'), p('b'), p('c'), p('d')]), // 4 right
      scorePosting({ required: ['e'], preferred: [] }, [p('x')]), // 1 missed, 1 extra
    ]
    const summary = summarise(scores)
    expect(summary).toMatchObject({ postings: 2, correct: 4, missed: 1, extra: 1, perfectPostings: 1 })
    expect(summary.precision).toBeCloseTo(4 / 5)
    expect(summary.recall).toBeCloseTo(4 / 5)
    expect(summary.f1).toBeCloseTo(4 / 5)
  })

  it('reports level accuracy among correct skills only', () => {
    const summary = summarise([scorePosting({ required: ['a', 'b'], preferred: [] }, [p('a'), p('b', 'preferred'), p('z')])])
    expect(summary.levelAccuracy).toBeCloseTo(1 / 2)
  })

  it('reports recall on described skills separately', () => {
    const summary = summarise([
      scorePosting({ required: ['a', 'b'], preferred: [], described: ['b'] }, [p('a')]),
      scorePosting({ required: ['c'], preferred: [], described: ['c'] }, [p('c')]),
    ])
    expect(summary.describedRecall).toBeCloseTo(1 / 2)
  })

  it('says "nothing to measure" instead of dividing by zero', () => {
    const summary = summarise([scorePosting({ required: [], preferred: [] }, [])])
    expect(summary).toMatchObject({ precision: null, recall: null, f1: null, levelAccuracy: null, describedRecall: null })
    expect(summary.perfectPostings).toBe(1)
    expect(summarise([]).postings).toBe(0)
  })
})
