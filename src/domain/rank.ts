// Decides what to learn, and in what order.
//
// Every skill still to learn gets a value:
//
//     value = its own demand score + half the demand score of everything it leads to
//
// So a skill nobody asks for by name can still rank high if wanted skills are
// built on it (Linux, on the way to Docker and Kubernetes).
//
// The order is then built so that no skill ever comes before something it
// depends on. This is a "topological sort": repeatedly pick, from the skills
// whose prerequisites are all dealt with, the one with the highest value.

import { allPrerequisites } from './taxonomy.ts'
import type { Taxonomy } from './types.ts'

/** How much a skill that only unlocks other skills is worth, compared with being asked for directly. */
export const UNLOCK_WEIGHT = 0.5

export type Ranking = {
  /** Everything still to learn, in a workable order. */
  order: string[]
  /** Up to three skills that can be started today, best first. */
  next: string[]
  value: Map<string, number>
  /** For each skill to learn, the wanted skills that depend on it, directly or not. */
  unlocks: Map<string, string[]>
}

export function rankGaps(
  /** Demand score of each skill that postings ask for. */
  demand: Map<string, number>,
  have: Set<string>,
  tax: Taxonomy,
  nextCount = 3,
): Ranking {
  const gaps = [...demand.keys()].filter((id) => !have.has(id) && (demand.get(id) ?? 0) > 0 && tax.byId.has(id))

  // Everything that has to be learned: the gaps, plus whatever they depend on
  // that the person does not have yet.
  const needed = new Set(gaps)
  const missingBelow = new Map<string, string[]>()
  for (const gap of gaps) {
    const missing = [...allPrerequisites(tax, gap)].filter((p) => !have.has(p))
    missingBelow.set(gap, missing)
    for (const p of missing) needed.add(p)
  }

  // Turn "gap depends on p" round into "p unlocks gap".
  const unlocks = new Map<string, string[]>([...needed].map((id) => [id, []]))
  for (const [gap, missing] of missingBelow) for (const p of missing) unlocks.get(p)!.push(gap)

  const own = (id: string) => demand.get(id) ?? 0
  const value = new Map<string, number>()
  for (const id of needed) {
    const unlocked = unlocks.get(id)!.reduce((sum, gap) => sum + own(gap), 0)
    value.set(id, own(id) + UNLOCK_WEIGHT * unlocked)
  }

  const best = (a: string, b: string) =>
    (value.get(b) ?? 0) - (value.get(a) ?? 0) || own(b) - own(a) || a.localeCompare(b)

  // How many still-to-learn prerequisites each skill is waiting on.
  const waitingOn = new Map<string, number>()
  for (const id of needed) {
    waitingOn.set(id, (tax.byId.get(id)?.pre ?? []).filter((p) => needed.has(p)).length)
  }

  const ready = [...needed].filter((id) => waitingOn.get(id) === 0).sort(best)
  const next = ready.slice(0, nextCount)

  const order: string[] = []
  const available = [...ready]
  while (available.length > 0) {
    const id = available.shift()!
    order.push(id)
    // Learning this one may free up the skills that were waiting on it.
    for (const other of needed) {
      if (!tax.byId.get(other)?.pre.includes(id)) continue
      const left = (waitingOn.get(other) ?? 0) - 1
      waitingOn.set(other, left)
      if (left === 0) {
        available.push(other)
        available.sort(best)
      }
    }
  }

  return { order, next, value, unlocks }
}
