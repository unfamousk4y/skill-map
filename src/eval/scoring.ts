// How an extractor is graded against an answer key.
//
// For each posting we compare the skills it reported with the skills a person
// decided the posting really asks for. Three questions:
//
//   Precision: of the skills it reported, how many were right?
//   Recall:    of the skills it should have found, how many did it find?
//   Level:     for the ones it got right, did it also get required/preferred right?
//
// Recall is also reported separately for skills that are described without
// being named, because that is where a dictionary lookup cannot follow.

export type Level = 'required' | 'preferred'

/** The answer key for one posting. */
export type Expected = {
  required: string[]
  preferred: string[]
  /** Which of the above are described in the text without any of their names appearing. */
  described?: string[]
}

export type Prediction = { skillId: string; level: Level }

export type PostingScore = {
  /** Reported and in the key. */
  correct: string[]
  /** In the key but not reported. */
  missed: string[]
  /** Reported but not in the key. */
  extra: string[]
  /** Correct skill, wrong required/preferred. */
  wrongLevel: string[]
  describedFound: number
  describedTotal: number
}

/** An extractor may mention a skill twice. Keep one entry per skill, and let "required" win. */
export function collapse(mentions: Prediction[]): Prediction[] {
  const byId = new Map<string, Level>()
  for (const m of mentions) {
    if (byId.get(m.skillId) !== 'required') byId.set(m.skillId, m.level)
  }
  return [...byId].map(([skillId, level]) => ({ skillId, level }))
}

export function scorePosting(expected: Expected, reported: Prediction[]): PostingScore {
  const key = new Map<string, Level>()
  for (const id of expected.preferred) key.set(id, 'preferred')
  for (const id of expected.required) key.set(id, 'required')
  const got = new Map(collapse(reported).map((p) => [p.skillId, p.level]))
  const described = expected.described ?? []
  const sorted = (ids: Iterable<string>) => [...ids].sort()

  const correct = sorted([...got.keys()].filter((id) => key.has(id)))
  return {
    correct,
    missed: sorted([...key.keys()].filter((id) => !got.has(id))),
    extra: sorted([...got.keys()].filter((id) => !key.has(id))),
    wrongLevel: correct.filter((id) => got.get(id) !== key.get(id)),
    describedFound: described.filter((id) => got.has(id)).length,
    describedTotal: described.length,
  }
}

export type Summary = {
  postings: number
  correct: number
  missed: number
  extra: number
  /** All of these are fractions from 0 to 1, or null when there was nothing to measure. */
  precision: number | null
  recall: number | null
  /** One number combining precision and recall. It is high only when both are. */
  f1: number | null
  levelAccuracy: number | null
  describedRecall: number | null
  /** Postings where every skill was found and nothing extra was reported. */
  perfectPostings: number
}

const ratio = (top: number, bottom: number) => (bottom === 0 ? null : top / bottom)

/** Adds up every posting's counts first, then divides. A posting with many skills counts for more than one with few. */
export function summarise(scores: PostingScore[]): Summary {
  const sum = (pick: (s: PostingScore) => number) => scores.reduce((total, s) => total + pick(s), 0)
  const correct = sum((s) => s.correct.length)
  const missed = sum((s) => s.missed.length)
  const extra = sum((s) => s.extra.length)
  const precision = ratio(correct, correct + extra)
  const recall = ratio(correct, correct + missed)
  return {
    postings: scores.length,
    correct,
    missed,
    extra,
    precision,
    recall,
    f1: precision === null || recall === null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall),
    levelAccuracy: ratio(correct - sum((s) => s.wrongLevel.length), correct),
    describedRecall: ratio(sum((s) => s.describedFound), sum((s) => s.describedTotal)),
    perfectPostings: scores.filter((s) => s.missed.length === 0 && s.extra.length === 0).length,
  }
}
