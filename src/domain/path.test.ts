import { describe, expect, it } from 'vitest'
import { pathToKnown } from './path.ts'

// rag needs embeddings and prompts; both need llm; llm needs rest; rest needs http.
const pre: Record<string, string[]> = {
  rag: ['embeddings', 'prompts'],
  embeddings: ['llm'],
  prompts: ['llm'],
  llm: ['rest'],
  rest: ['http'],
  http: [],
}
const prerequisites = (id: string) => pre[id] ?? []

describe('pathToKnown', () => {
  it('stops each branch at the first skill the person already has', () => {
    const path = pathToKnown('rag', prerequisites, (id) => id === 'rest' || id === 'http')
    expect([...path.nodes].sort()).toEqual(['embeddings', 'llm', 'prompts', 'rag', 'rest'])
    expect(path.nodes.has('http')).toBe(false)
    expect([...path.edges].sort()).toEqual([
      'embeddings>rag',
      'llm>embeddings',
      'llm>prompts',
      'prompts>rag',
      'rest>llm',
    ])
  })

  it('goes all the way down when nothing is known', () => {
    const path = pathToKnown('llm', prerequisites, () => false)
    expect([...path.nodes].sort()).toEqual(['http', 'llm', 'rest'])
  })

  it('is just the skill itself when it has no prerequisites', () => {
    const path = pathToKnown('http', prerequisites, () => false)
    expect([...path.nodes]).toEqual(['http'])
    expect(path.edges.size).toBe(0)
  })

  it('does not hang on a prerequisite loop', () => {
    const loop = (id: string) => (id === 'a' ? ['b'] : ['a'])
    const path = pathToKnown('a', loop, () => false)
    expect([...path.nodes].sort()).toEqual(['a', 'b'])
  })
})
