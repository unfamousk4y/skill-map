// Share links. The whole shared map travels inside the link itself, after the
// "#", so there is nothing to store on a server. Browsers do not send the part
// after "#" to the web server, so the host never sees it either.
//
// What goes in: skill ids, two counts and a state per skill. What never goes
// in: the resume, the posting text, quotes, or proof links.
//
// Format, using only characters that are safe in a link:
//
//     1.6~python.5.1.h~docker.2.2.g~react.3.0.l
//     |  |        | | |
//     |  |        | | state: g gap, h have, l learned
//     |  |        | preferred count
//     |  |        required count
//     |  number of postings
//     format version

import type { Snapshot, SnapshotSkill, Taxonomy } from './types.ts'

export const SHARE_PREFIX = '#share='
/** Longer than any real map needs. Anything bigger is rejected unread. */
export const MAX_SHARE_LENGTH = 6000
const MAX_COUNT = 99

const LETTER = { gap: 'g', have: 'h', learned: 'l' } as const
const STATE: Record<string, SnapshotSkill['state']> = { g: 'gap', h: 'have', l: 'learned' }

export function encodeShare(snapshot: Snapshot): string {
  const parts = [`1.${snapshot.postings}`]
  for (const id of Object.keys(snapshot.skills).sort()) {
    const s = snapshot.skills[id]!
    parts.push(`${id}.${s.required}.${s.preferred}.${LETTER[s.state]}`)
  }
  return parts.join('~')
}

const count = (text: string | undefined): number | null => {
  if (text === undefined || !/^\d{1,2}$/.test(text)) return null
  const n = Number(text)
  return n <= MAX_COUNT ? n : null
}

/**
 * Reads a share link's data back. Returns null for anything that is not
 * exactly what encodeShare writes: a link can be edited by anyone, so nothing
 * in it is trusted. Skills this version of the app does not know are skipped.
 */
export function decodeShare(text: string, tax: Taxonomy): Snapshot | null {
  if (text.length === 0 || text.length > MAX_SHARE_LENGTH) return null
  const [head, ...rest] = text.split('~')
  const [version, postingsText, ...extra] = (head ?? '').split('.')
  const postings = count(postingsText)
  if (version !== '1' || postings === null || extra.length > 0) return null

  const skills: Snapshot['skills'] = {}
  for (const part of rest) {
    const [id, requiredText, preferredText, letter, ...more] = part.split('.')
    const required = count(requiredText)
    const preferred = count(preferredText)
    const state = STATE[letter ?? '']
    if (!id || required === null || preferred === null || state === undefined || more.length > 0) return null
    // A posting counts once per skill, so the two counts cannot exceed the postings.
    if (required + preferred > postings) return null
    if (!tax.byId.has(id)) continue
    skills[id] = { required, preferred, state }
  }
  return { at: '', postings, skills }
}

/** Pulls the data out of a page address's "#..." part. Null when it is not a share link. */
export function shareFromHash(hash: string): string | null {
  return hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : null
}
