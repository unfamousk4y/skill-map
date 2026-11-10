// Turns an analysis into the things the renderer draws: positioned nodes,
// connecting lines, category sectors and rings. No drawing happens here.

import { layoutRadial, type Sector } from '../domain/layout.ts'
import { allPrerequisites, skillDepths } from '../domain/taxonomy.ts'
import type { Analysis, SkillFinding, Taxonomy } from '../domain/types.ts'

export type SceneNode = {
  id: string
  name: string
  cat: string
  x: number
  y: number
  /** Prerequisite depth: 0 is the innermost ring. */
  ring: number
  radius: number
  /** Postings asking for it, required plus preferred. */
  demand: number
  have: boolean
  /** One of the recommended skills to learn next. */
  next: boolean
  /**
   * Not asked for and not on the resume, but something a wanted skill depends
   * on. Shown small so the path to a goal is visible.
   */
  steppingStone: boolean
}

export type SceneEdge = { from: string; to: string }

export type Scene = {
  nodes: SceneNode[]
  byId: Map<string, SceneNode>
  edges: SceneEdge[]
  sectors: (Sector & { name: string })[]
  ringRadii: number[]
  outerRadius: number
}

export function nodeRadius(demand: number, steppingStone: boolean): number {
  if (steppingStone) return 7
  // Square root keeps a skill asked for 5 times from dwarfing one asked for once.
  return 15 + 7 * Math.sqrt(demand)
}

export function buildScene(analysis: Analysis, tax: Taxonomy): Scene {
  const findings = new Map<string, SkillFinding>()
  for (const f of analysis.findings) if (tax.byId.has(f.id)) findings.set(f.id, f)

  // Include everything a found skill depends on, so no path has a hole in it.
  const ids = new Set(findings.keys())
  for (const id of findings.keys()) for (const p of allPrerequisites(tax, id)) ids.add(p)

  const depth = skillDepths(tax)
  const demandOf = (id: string) => {
    const f = findings.get(id)
    return f ? f.required + f.preferred : 0
  }

  const layout = layoutRadial(
    [...ids].map((id) => {
      const skill = tax.byId.get(id)!
      return { id, cat: skill.cat, ring: depth.get(id) ?? 0, pre: skill.pre, weight: demandOf(id) }
    }),
    tax.categories.map((c) => c.id),
  )

  const next = new Set(analysis.next)
  const nodes: SceneNode[] = [...ids].map((id) => {
    const skill = tax.byId.get(id)!
    const placed = layout.nodes.get(id)!
    const have = findings.get(id)?.have ?? false
    const demand = demandOf(id)
    const steppingStone = !have && demand === 0
    return {
      id,
      name: skill.name,
      cat: skill.cat,
      x: placed.x,
      y: placed.y,
      ring: placed.ring,
      radius: nodeRadius(demand, steppingStone),
      demand,
      have,
      next: next.has(id),
      steppingStone,
    }
  })

  const edges: SceneEdge[] = []
  for (const id of ids) for (const p of tax.byId.get(id)!.pre) if (ids.has(p)) edges.push({ from: p, to: id })

  const catName = new Map(tax.categories.map((c) => [c.id, c.name]))
  return {
    nodes,
    byId: new Map(nodes.map((n) => [n.id, n])),
    edges,
    sectors: layout.sectors.map((s) => ({ ...s, name: catName.get(s.cat) ?? s.cat })),
    ringRadii: layout.ringRadii,
    outerRadius: layout.outerRadius,
  }
}
