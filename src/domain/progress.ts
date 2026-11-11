// Progress over time: skills marked as learned, snapshots, and what changed
// between two snapshots. Pure rules, no browser storage here.

import { rankGaps } from './rank.ts'
import { demandScore } from './score.ts'
import { allPrerequisites } from './taxonomy.ts'
import type { Analysis, Learned, SkillFinding, Snapshot, Taxonomy } from './types.ts'

export const MAX_URL_LENGTH = 500

/**
 * Checks a proof link. Returns the tidied link, or null if it is not a web
 * address. Only http and https are allowed: a link starting "javascript:"
 * would run code when clicked, so it must never reach the page.
 */
export function validProofUrl(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed.length > MAX_URL_LENGTH) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.href
}

/** Works out the learning order again from the findings as they now stand. */
function rerank(analysis: Analysis, findings: SkillFinding[], tax: Taxonomy): Analysis {
  const have = new Set(findings.filter((f) => f.have).map((f) => f.id))
  const demand = new Map(findings.map((f) => [f.id, demandScore(f)]))
  const ranking = rankGaps(demand, have, tax)
  return {
    ...analysis,
    findings: [...findings].sort((a, b) => a.id.localeCompare(b.id)),
    next: ranking.next,
    learningOrder: ranking.order,
    unlocks: Object.fromEntries([...ranking.unlocks].filter(([, list]) => list.length > 0)),
  }
}

/**
 * Returns a new analysis in which every skill marked as learned counts as
 * one the person has, and the learning order is worked out again. The
 * analysis passed in is not changed.
 *
 * A learned skill implies what it builds on, the same rule the resume gets.
 */
export function applyLearned(analysis: Analysis, learned: Learned, tax: Taxonomy): Analysis {
  const ids = Object.keys(learned).filter((id) => tax.byId.has(id))
  if (ids.length === 0) return analysis

  const findings = new Map(analysis.findings.map((f) => [f.id, { ...f }]))
  const finding = (id: string): SkillFinding => {
    let f = findings.get(id)
    if (!f) {
      f = { id, required: 0, preferred: 0, have: false, postingQuotes: [], resumeQuotes: [] }
      findings.set(id, f)
    }
    return f
  }

  for (const id of ids) {
    const f = finding(id)
    // Already on the resume: the resume is the stronger evidence, leave it be.
    if (f.have && !f.impliedBy) continue
    f.have = true
    f.learned = learned[id]
    delete f.impliedBy
  }
  for (const id of ids) {
    if (!findings.get(id)?.learned) continue
    for (const pre of allPrerequisites(tax, id)) {
      const f = finding(pre)
      // Already known first-hand (resume or learned): nothing to imply.
      if (f.learned || (f.have && !f.impliedBy)) continue
      f.have = true
      const name = tax.byId.get(id)!.name
      f.impliedBy = [...new Set([...(f.impliedBy ?? []), name])].sort()
    }
  }
  return rerank(analysis, [...findings.values()], tax)
}

/** Boils an analysis down to counts and states. No text, no quotes. */
export function snapshotOf(analysis: Analysis, at: string): Snapshot {
  const skills: Snapshot['skills'] = {}
  for (const f of analysis.findings) {
    skills[f.id] = {
      required: f.required,
      preferred: f.preferred,
      state: f.learned ? 'learned' : f.have ? 'have' : 'gap',
    }
  }
  return { at, postings: analysis.postings.length, skills }
}

/** Of the skills postings ask for, how many the person has. */
export function coverage(snapshot: Snapshot): { covered: number; asked: number } {
  const asked = Object.values(snapshot.skills).filter((s) => s.required + s.preferred > 0)
  return { covered: asked.filter((s) => s.state !== 'gap').length, asked: asked.length }
}

export type Changes = {
  before: { covered: number; asked: number }
  after: { covered: number; asked: number }
  /** Missing before, covered now. Includes stepping stones marked as learned. */
  nowCovered: string[]
  /** Still asked for, covered before, missing now (a resume line was removed, say). */
  noLongerCovered: string[]
  /** Not asked for before, asked for now. */
  newlyAsked: string[]
  /** Asked for before, not asked for now. */
  noLongerAsked: string[]
  /** True when none of the four lists has anything in it. */
  same: boolean
}

/** Compares two snapshots skill by skill. Lists are sorted by skill id. */
export function compareSnapshots(before: Snapshot, after: Snapshot): Changes {
  const asked = (s: Snapshot, id: string) => {
    const skill = s.skills[id]
    return skill !== undefined && skill.required + skill.preferred > 0
  }
  const covered = (s: Snapshot, id: string) => (s.skills[id]?.state ?? 'gap') !== 'gap'

  const changes: Changes = {
    before: coverage(before),
    after: coverage(after),
    nowCovered: [],
    noLongerCovered: [],
    newlyAsked: [],
    noLongerAsked: [],
    same: false,
  }
  const ids = [...new Set([...Object.keys(before.skills), ...Object.keys(after.skills)])].sort()
  for (const id of ids) {
    const was = asked(before, id)
    const is = asked(after, id)
    if (!was && is) changes.newlyAsked.push(id)
    else if (was && !is) changes.noLongerAsked.push(id)

    // A skill that was not on the earlier map at all only counts as progress
    // if it was marked as learned since (a stepping stone, say). Otherwise a
    // newly pasted posting would make old resume skills look like new wins.
    const comparable = before.skills[id] !== undefined || after.skills[id]?.state === 'learned'
    if (comparable && !covered(before, id) && covered(after, id)) changes.nowCovered.push(id)
    if (is && covered(before, id) && !covered(after, id)) changes.noLongerCovered.push(id)
  }
  changes.same =
    changes.nowCovered.length + changes.noLongerCovered.length + changes.newlyAsked.length + changes.noLongerAsked.length === 0
  return changes
}

/**
 * Rebuilds a read-only analysis from a snapshot, for a shared link. There are
 * no quotes, because a snapshot never holds any.
 */
export function analysisFromSnapshot(snapshot: Snapshot, label: string, tax: Taxonomy): Analysis {
  const findings: SkillFinding[] = Object.entries(snapshot.skills)
    .filter(([id]) => tax.byId.has(id))
    .map(([id, s]) => ({
      id,
      required: s.required,
      preferred: s.preferred,
      have: s.state !== 'gap',
      postingQuotes: [],
      resumeQuotes: [],
    }))
  const postings = Array.from({ length: snapshot.postings }, (_, i) => ({ id: `p${i + 1}`, title: `Posting ${i + 1}` }))
  const empty: Analysis = {
    label,
    fictional: false,
    postings,
    findings: [],
    next: [],
    learningOrder: [],
    unlocks: {},
    rejectedMentions: 0,
    method: 'dictionary',
    otherSkills: [],
    notes: [],
  }
  return rerank(empty, findings, tax)
}
