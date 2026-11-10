import raw from '../data/taxonomy.json'
import type { Category, Skill, Taxonomy } from './types.ts'

type RawTaxonomy = { version: string; categories: Category[]; skills: Skill[] }

/** Lower-case and collapse spaces, so "Node JS" and "node  js" compare equal. */
export function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildTaxonomy(data: RawTaxonomy): Taxonomy {
  return { ...data, byId: new Map(data.skills.map((s) => [s.id, s])) }
}

/**
 * Lists everything wrong with a taxonomy. An empty list means it is safe to use.
 * The rest of the app assumes these rules hold, so the test suite runs this on
 * the real file.
 */
export function validateTaxonomy(data: RawTaxonomy): string[] {
  const problems: string[] = []
  const cats = new Set(data.categories.map((c) => c.id))
  const ids = new Set<string>()
  // Every name and alias must point at exactly one skill, or matching is ambiguous.
  const owner = new Map<string, string>()

  for (const s of data.skills) {
    if (ids.has(s.id)) problems.push(`duplicate id: ${s.id}`)
    ids.add(s.id)
    if (!cats.has(s.cat)) problems.push(`${s.id}: unknown category ${s.cat}`)
    for (const term of [s.name, ...s.aliases, ...(s.cased ?? []), ...(s.listed ?? [])]) {
      const key = normalise(term)
      const other = owner.get(key)
      if (other && other !== s.id) problems.push(`"${key}" is claimed by ${other} and ${s.id}`)
      owner.set(key, s.id)
    }
  }

  for (const s of data.skills) {
    for (const p of s.pre) {
      if (!ids.has(p)) problems.push(`${s.id}: unknown prerequisite ${p}`)
      if (p === s.id) problems.push(`${s.id}: lists itself as a prerequisite`)
    }
  }

  // A loop (A needs B, B needs A) would make "what to learn first" unanswerable.
  const byId = new Map(data.skills.map((s) => [s.id, s]))
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'visiting') {
      problems.push(`prerequisite loop: ${[...path, id].join(' -> ')}`)
      return
    }
    state.set(id, 'visiting')
    for (const p of byId.get(id)?.pre ?? []) if (byId.has(p)) visit(p, [...path, id])
    state.set(id, 'done')
  }
  for (const s of data.skills) visit(s.id, [])

  return problems
}

/**
 * How many steps of prerequisites sit under each skill: 0 for a skill with none,
 * otherwise one more than its deepest prerequisite. The map draws depth as rings.
 */
export function skillDepths(tax: Taxonomy): Map<string, number> {
  const depth = new Map<string, number>()
  const find = (id: string, seen: Set<string>): number => {
    const known = depth.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) return 0 // loop guard; validateTaxonomy reports loops
    seen.add(id)
    const pre = tax.byId.get(id)?.pre ?? []
    const d = pre.length === 0 ? 0 : 1 + Math.max(...pre.map((p) => find(p, seen)))
    depth.set(id, d)
    return d
  }
  for (const s of tax.skills) find(s.id, new Set())
  return depth
}

/** A skill's prerequisites, their prerequisites, and so on. */
export function allPrerequisites(tax: Taxonomy, id: string): Set<string> {
  const out = new Set<string>()
  const walk = (current: string): void => {
    for (const p of tax.byId.get(current)?.pre ?? []) {
      if (!out.has(p)) {
        out.add(p)
        walk(p)
      }
    }
  }
  walk(id)
  return out
}

export const rawTaxonomy: RawTaxonomy = raw
export const taxonomy: Taxonomy = buildTaxonomy(rawTaxonomy)
