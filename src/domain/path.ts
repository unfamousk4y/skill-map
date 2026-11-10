// "How do I get from what I know to this skill?"
//
// Walks backwards from a skill through its prerequisites. Each branch stops as
// soon as it reaches a skill the person already has, because that is where
// they would start from.

export type PathToKnown = {
  /** Every skill on the way, including the target and the known skills it starts from. */
  nodes: Set<string>
  /** Each step, written "prerequisite>skill". */
  edges: Set<string>
}

export const edgeKey = (from: string, to: string) => `${from}>${to}`

export function pathToKnown(
  target: string,
  /** Prerequisites of each skill that is on the map. */
  prerequisites: (id: string) => string[],
  have: (id: string) => boolean,
): PathToKnown {
  const nodes = new Set<string>([target])
  const edges = new Set<string>()
  const queue = [target]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const pre of prerequisites(current)) {
      edges.add(edgeKey(pre, current))
      if (nodes.has(pre)) continue // already handled; also protects against loops
      nodes.add(pre)
      if (!have(pre)) queue.push(pre)
    }
  }
  return { nodes, edges }
}
