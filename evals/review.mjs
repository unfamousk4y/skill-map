// Writes evals/REVIEW.md: every synthetic posting next to its answer key, laid
// out for a person to check by hand. Run it again after editing synthetic.json.
//
//   node evals/review.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const set = JSON.parse(readFileSync(path.join(here, 'synthetic.json'), 'utf8'))
const taxonomy = JSON.parse(readFileSync(path.join(here, '..', 'src', 'data', 'taxonomy.json'), 'utf8'))
const nameOf = new Map(taxonomy.skills.map((s) => [s.id, s.name]))

const out = [
  '# Answer key review sheet',
  '',
  'The postings and the answer key below were written by an AI model. The accuracy numbers are only as good as this key, so a person needs to check it.',
  '',
  '**How to check one posting:** read the posting, then ask of each skill in the key "does this posting really ask the candidate for this?", and ask "is anything it asks for missing from the key?". Use these rules:',
  '',
  '- A skill counts when it is named, or clearly described without being named. Skills marked *(described)* are the second kind.',
  '- A tool counts as its parent skill when our list groups them: Tableau counts as "BI tools", Snowflake as "Data warehousing", S3 as "AWS".',
  '- A skill does not count if the posting says it is not needed, or only mentions it as something the company or another team uses.',
  '- "Preferred" means the posting presents it as a bonus, a plus, nice to have, optional or preferred. Everything else is "required".',
  '- Only skills on our list can be in the key. The full list is in `src/data/taxonomy.json`.',
  '',
  'Tick the box if the key is right. If not, write what should change on the "Change" line, then tell Claude Code which postings you changed.',
  '',
]

for (const posting of set.postings) {
  const { required, preferred, described = [] } = posting.expected
  const show = (ids) =>
    ids.length ? ids.map((id) => `${nameOf.get(id) ?? id}${described.includes(id) ? ' *(described)*' : ''}`).join(', ') : 'none'
  out.push(
    `## ${posting.id} (${posting.group})`,
    '',
    '```',
    posting.text,
    '```',
    '',
    `- Required: ${show(required)}`,
    `- Preferred: ${show(preferred)}`,
    '',
    '- [ ] The key is right',
    '- Change: ',
    '',
  )
}
writeFileSync(path.join(here, 'REVIEW.md'), out.join('\n'))
console.log(`Wrote REVIEW.md with ${set.postings.length} postings.`)
