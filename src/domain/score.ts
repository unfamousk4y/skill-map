// Turns verified mentions into the analysis the map shows.
//
// The arithmetic is deliberately simple, and the screen shows it:
//
//     demand score = postings that require it x 1  +  postings that prefer it x 0.5
//
// A posting counts once per skill however many times it names it, and if it
// calls the skill both required and preferred, required wins.

import { rankGaps } from './rank.ts'
import { allPrerequisites } from './taxonomy.ts'
import type { Analysis, Mention, Posting, Quote, SkillFinding, Taxonomy } from './types.ts'

export const REQUIRED_WEIGHT = 1
export const PREFERRED_WEIGHT = 0.5

export function demandScore(finding: Pick<SkillFinding, 'required' | 'preferred'>): number {
  return finding.required * REQUIRED_WEIGHT + finding.preferred * PREFERRED_WEIGHT
}

export type AnalysisInput = {
  label: string
  fictional: boolean
  postings: { posting: Posting; mentions: Mention[] }[]
  resume: Mention[]
  rejectedMentions?: number
  method?: 'dictionary' | 'claude'
  otherSkills?: string[]
  notes?: string[]
}

const MAX_RESUME_QUOTES = 3

export function buildAnalysis(input: AnalysisInput, tax: Taxonomy): Analysis {
  const findings = new Map<string, SkillFinding>()
  const finding = (id: string): SkillFinding => {
    let f = findings.get(id)
    if (!f) {
      f = { id, required: 0, preferred: 0, have: false, postingQuotes: [], resumeQuotes: [] }
      findings.set(id, f)
    }
    return f
  }

  for (const { posting, mentions } of input.postings) {
    // Group this posting's mentions by skill, so the posting counts once.
    const bySkill = new Map<string, Mention[]>()
    for (const m of mentions) {
      if (!tax.byId.has(m.skillId)) continue
      bySkill.set(m.skillId, [...(bySkill.get(m.skillId) ?? []), m])
    }
    for (const [id, group] of bySkill) {
      const f = finding(id)
      const required = group.find((m) => m.level === 'required')
      if (required) f.required++
      else f.preferred++
      // One quote per posting: the one that decided its level.
      f.postingQuotes.push({ source: posting.title, text: (required ?? group[0]!).quote })
    }
  }

  for (const m of input.resume) {
    if (!tax.byId.has(m.skillId)) continue
    const f = finding(m.skillId)
    f.have = true
    const quote: Quote = { source: 'Resume', text: m.quote }
    if (f.resumeQuotes.length < MAX_RESUME_QUOTES && !f.resumeQuotes.some((q) => q.text === quote.text)) {
      f.resumeQuotes.push(quote)
    }
  }

  // Showing a skill implies the things it is built on. A resume that says
  // "React" rarely bothers to say "HTML".
  const shown = [...findings.values()].filter((f) => f.have).map((f) => f.id)
  for (const id of shown) {
    for (const pre of allPrerequisites(tax, id)) {
      const f = finding(pre)
      if (f.resumeQuotes.length > 0) continue // named directly: no need to imply it
      f.have = true
      const name = tax.byId.get(id)!.name
      f.impliedBy = [...(f.impliedBy ?? []), name].sort()
    }
  }

  const have = new Set([...findings.values()].filter((f) => f.have).map((f) => f.id))
  const demand = new Map([...findings.values()].map((f) => [f.id, demandScore(f)]))
  const ranking = rankGaps(demand, have, tax)

  // Keep what postings ask for or the person has. Sorted so the result does
  // not depend on the order mentions happened to arrive in.
  const kept = [...findings.values()]
    .filter((f) => f.have || f.required + f.preferred > 0)
    .sort((a, b) => a.id.localeCompare(b.id))

  return {
    label: input.label,
    fictional: input.fictional,
    postings: input.postings.map((p) => p.posting),
    findings: kept,
    next: ranking.next,
    learningOrder: ranking.order,
    unlocks: Object.fromEntries([...ranking.unlocks].filter(([, list]) => list.length > 0)),
    rejectedMentions: input.rejectedMentions ?? 0,
    method: input.method ?? 'dictionary',
    otherSkills: input.otherSkills ?? [],
    notes: input.notes ?? [],
  }
}
