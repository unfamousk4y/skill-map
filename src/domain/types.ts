// Shared data shapes. Nothing in src/domain imports React or touches the network.

export type Skill = {
  id: string
  name: string
  /** Other spellings that mean the same skill, e.g. "js" for JavaScript. */
  aliases: string[]
  cat: string
  /** Ids of skills you should know first. */
  pre: string[]
}

export type Category = { id: string; name: string }

export type Taxonomy = {
  version: string
  categories: Category[]
  skills: Skill[]
  byId: Map<string, Skill>
}

/** An exact piece of text and where it came from. */
export type Quote = { source: string; text: string }

/** What the analysis found out about one skill. */
export type SkillFinding = {
  id: string
  /** Number of postings that list the skill as required. */
  required: number
  /** Number of postings that list it as preferred or a bonus. */
  preferred: number
  /** True when the resume shows the skill. */
  have: boolean
  postingQuotes: Quote[]
  resumeQuotes: Quote[]
}

export type Posting = { id: string; company: string; title: string }

export type Analysis = {
  label: string
  /** True for built-in demo data, so the screen can say so. */
  fictional: boolean
  postings: Posting[]
  findings: SkillFinding[]
  /** Ids of the gaps to learn next, best first. */
  next: string[]
}
