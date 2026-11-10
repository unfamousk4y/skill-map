import { describe, expect, it } from 'vitest'
import {
  allPrerequisites,
  buildTaxonomy,
  rawTaxonomy,
  skillDepths,
  taxonomy,
  validateTaxonomy,
} from './taxonomy.ts'

const cats = [{ id: 'x', name: 'X' }]
const skill = (id: string, pre: string[] = [], aliases: string[] = []) => ({
  id,
  name: id,
  aliases,
  cat: 'x',
  pre,
})

describe('the real taxonomy file', () => {
  it('has no problems', () => {
    expect(validateTaxonomy(rawTaxonomy)).toEqual([])
  })

  it('puts skills with no prerequisites on ring 0 and builds up from there', () => {
    const depth = skillDepths(taxonomy)
    expect(depth.get('javascript')).toBe(0)
    expect(depth.get('typescript')).toBe(1)
    // rag -> embeddings -> llm-apis -> rest-api -> http
    expect(depth.get('rag')).toBe(4)
  })

  it('follows prerequisites all the way down', () => {
    expect([...allPrerequisites(taxonomy, 'nextjs')].sort()).toEqual([
      'css',
      'html',
      'javascript',
      'react',
    ])
  })
})

describe('validateTaxonomy catches', () => {
  it('a duplicate id', () => {
    const problems = validateTaxonomy({ version: 't', categories: cats, skills: [skill('a'), skill('a')] })
    expect(problems).toContain('duplicate id: a')
  })

  it('a prerequisite that does not exist', () => {
    const problems = validateTaxonomy({ version: 't', categories: cats, skills: [skill('a', ['ghost'])] })
    expect(problems).toContain('a: unknown prerequisite ghost')
  })

  it('an unknown category', () => {
    const problems = validateTaxonomy({ version: 't', categories: [], skills: [skill('a')] })
    expect(problems).toContain('a: unknown category x')
  })

  it('an alias shared by two skills, ignoring case and spacing', () => {
    const problems = validateTaxonomy({
      version: 't',
      categories: cats,
      skills: [skill('a', [], ['Node  JS']), skill('b', [], ['node js'])],
    })
    expect(problems).toContain('"node js" is claimed by a and b')
  })

  it('a prerequisite loop', () => {
    const problems = validateTaxonomy({
      version: 't',
      categories: cats,
      skills: [skill('a', ['b']), skill('b', ['a'])],
    })
    expect(problems.some((p) => p.startsWith('prerequisite loop'))).toBe(true)
  })
})

describe('skillDepths', () => {
  it('does not hang on a loop', () => {
    const tax = buildTaxonomy({ version: 't', categories: cats, skills: [skill('a', ['b']), skill('b', ['a'])] })
    expect(skillDepths(tax).size).toBe(2)
  })
})
