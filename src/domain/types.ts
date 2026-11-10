// Shared data shapes. Nothing in src/domain imports React or touches the network.

export type Skill = {
  id: string
  name: string
  /** Other spellings that mean the same skill, e.g. "js" for JavaScript. */
  aliases: string[]
  /** Terms that only count with this exact capitalisation: "React", not "react to feedback". */
  cased?: string[]
  /**
   * Terms that need the exact capitalisation and another skill in the same
   * sentence, because on their own they are ordinary words: "Go", "C", "R".
   */
  listed?: string[]
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
  /** True when the resume shows the skill, or shows something that depends on it. */
  have: boolean
  /**
   * Set when the resume never names this skill but names these skills that
   * build on it. Knowing React implies knowing JavaScript.
   */
  impliedBy?: string[]
  postingQuotes: Quote[]
  resumeQuotes: Quote[]
}

export type Posting = { id: string; title: string }

/** One place a text mentions a skill, as reported by an extractor. */
export type Mention = {
  skillId: string
  /** The exact piece of the text that shows it. */
  quote: string
  /** Postings only: is the skill a must-have or a nice-to-have? */
  level: 'required' | 'preferred'
}

export type Analysis = {
  label: string
  /** True for built-in demo data, so the screen can say so. */
  fictional: boolean
  postings: Posting[]
  findings: SkillFinding[]
  /** Ids of the skills to start on now, best first. */
  next: string[]
  /** Every skill still to learn, in an order that never puts a skill before what it builds on. */
  learningOrder: string[]
  /** For each skill still to learn: the wanted skills it opens the way to. */
  unlocks: Record<string, string[]>
  /** Mentions thrown away because their quote was not found word for word in the text. */
  rejectedMentions: number
  /** Which extractor read the documents. */
  method: 'dictionary' | 'claude'
  /** Skills the documents name that are not in our list. Only the Claude extractor reports these. */
  otherSkills: string[]
  /** Things the person should know about how this result was produced, such as a document that fell back to the free matcher. */
  notes: string[]
}
