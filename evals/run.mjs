// Scores the two extractors against the answer keys and writes the results.
//
//   node evals/run.mjs            free matcher only. Costs nothing.
//   node evals/run.mjs --claude   also Claude, at two effort levels. SPENDS API
//                                 CREDIT the first time (a few cents); needs
//                                 `npm run dev` running in another terminal.
//
// Every Claude reply is saved under evals/cache, keyed by the exact text, model,
// instructions and effort. Running again reuses the saved replies and costs
// nothing, unless one of those four things has changed.
//
// Test sets: evals/synthetic.json (invented postings, in the repo) and any
// evals/private/*.json you add yourself (real postings, never committed).

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const SERVER = 'http://localhost:5183'
const withClaude = process.argv.includes('--claude')
const EFFORTS = ['low', 'medium']

const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' })
const { findMentions } = await vite.ssrLoadModule('/src/domain/matcher.ts')
const { verifyMentions } = await vite.ssrLoadModule('/src/domain/verify.ts')
const { taxonomy } = await vite.ssrLoadModule('/src/domain/taxonomy.ts')
const { scorePosting, summarise, collapse } = await vite.ssrLoadModule('/src/eval/scoring.ts')
const { buildSystemPrompt, CLAUDE_MODEL } = await vite.ssrLoadModule('/src/extract/claudeFormat.ts')

const name = (id) => taxonomy.byId.get(id)?.name ?? id
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

// ---------- load the test sets ----------

const sets = [{ ...readJson(path.join(here, 'synthetic.json')), cacheDir: path.join(here, 'cache') }]
const privateDir = path.join(here, 'private')
if (existsSync(privateDir)) {
  for (const file of readdirSync(privateDir).filter((f) => f.endsWith('.json'))) {
    // Real postings are copyrighted, so their saved replies (which quote them) stay private too.
    sets.push({ ...readJson(path.join(privateDir, file)), cacheDir: path.join(privateDir, 'cache') })
  }
}

// Catch mistakes in an answer key before they turn into misleading scores.
for (const set of sets) {
  for (const posting of set.postings) {
    const { required, preferred, described = [] } = posting.expected
    for (const id of [...required, ...preferred]) {
      if (!taxonomy.byId.has(id)) throw new Error(`${set.name} ${posting.id}: "${id}" is not a skill id`)
    }
    for (const id of described) {
      if (!required.includes(id) && !preferred.includes(id)) {
        throw new Error(`${set.name} ${posting.id}: "${id}" is marked described but is not in the key`)
      }
    }
  }
}

// ---------- the two extractors ----------

const matcher = (text) => verifyMentions(text, findMentions(text, taxonomy), taxonomy).kept

const promptVersion = createHash('sha256').update(buildSystemPrompt(taxonomy)).digest('hex').slice(0, 12)
let newCalls = 0
let newCost = 0
let droppedQuotes = 0

async function claude(text, effort, cacheDir) {
  const key = createHash('sha256').update([CLAUDE_MODEL, promptVersion, effort, text].join('\n')).digest('hex').slice(0, 24)
  const file = path.join(cacheDir, `${key}.json`)
  let reply
  if (existsSync(file)) {
    reply = readJson(file)
  } else {
    const response = await fetch(`${SERVER}/api/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'posting', text, effort }),
    })
    reply = await response.json()
    if (reply.error) throw new Error(`Server said: ${reply.message}`)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(file, JSON.stringify({ model: CLAUDE_MODEL, promptVersion, effort, ...reply }, null, 2))
    newCalls++
    newCost += reply.cost ?? 0
  }
  if (reply.status !== 'ok') return { mentions: [], failed: reply.reason }
  // Exactly what the app does: a quote that is not in the text is thrown away.
  const checked = verifyMentions(text, reply.mentions, taxonomy)
  droppedQuotes += checked.rejected.length
  return { mentions: checked.kept }
}

if (withClaude) {
  const status = await (await fetch(`${SERVER}/api/status`).catch(() => null))?.json().catch(() => null)
  if (!status?.claude) {
    console.error('Claude mode is off. Start `npm run dev` with a key in .dev.vars, or run without --claude.')
    await vite.close()
    process.exit(1)
  }
}

// ---------- run ----------

const extractors = ['matcher', ...(withClaude ? EFFORTS.map((e) => `claude-${e}`) : [])]
const results = []
for (const set of sets) {
  const scores = Object.fromEntries(extractors.map((e) => [e, []]))
  for (const posting of set.postings) {
    const predictions = { matcher: matcher(posting.text) }
    for (const effort of withClaude ? EFFORTS : []) {
      const reply = await claude(posting.text, effort, set.cacheDir)
      predictions[`claude-${effort}`] = reply.mentions
      if (reply.failed) console.log(`  ${posting.id} claude-${effort}: not read (${reply.failed})`)
    }
    for (const extractor of extractors) {
      scores[extractor].push({
        id: posting.id,
        group: posting.group ?? 'all',
        title: posting.text.split('\n')[0],
        ...scorePosting(posting.expected, collapse(predictions[extractor])),
      })
    }
  }
  results.push({ set: set.name, postings: set.postings.length, scores })
  process.stdout.write(`${set.name}: ${set.postings.length} postings scored\n`)
}

// ---------- write the results ----------

const pct = (value) => (value === null ? 'n/a' : `${Math.round(value * 100)}%`)
const label = { matcher: 'Free matcher', 'claude-low': 'Claude, low effort', 'claude-medium': 'Claude, medium effort' }
const lines = [
  '# Accuracy results',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)} by \`node evals/run.mjs${withClaude ? ' --claude' : ''}\`. Model \`${CLAUDE_MODEL}\`, instructions version \`${promptVersion}\`, taxonomy \`${taxonomy.version}\`.`,
  '',
  '- **Precision**: of the skills reported, how many were right.',
  '- **Recall**: of the skills in the answer key, how many were found.',
  '- **F1**: one number that is high only when precision and recall both are.',
  '- **Described recall**: recall on skills that are described in the text without being named.',
  '- **Level**: of the skills found correctly, how many also had required/preferred right.',
  '',
]
const summaryJson = {}
for (const result of results) {
  lines.push(`## ${result.set} (${result.postings} postings)`, '')
  lines.push('| Extractor | Precision | Recall | F1 | Described recall | Level | Perfect postings | Found | Missed | Extra |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  summaryJson[result.set] = {}
  for (const extractor of extractors) {
    const s = summarise(result.scores[extractor])
    summaryJson[result.set][extractor] = s
    lines.push(
      `| ${label[extractor]} | ${pct(s.precision)} | ${pct(s.recall)} | ${pct(s.f1)} | ${pct(s.describedRecall)} | ${pct(s.levelAccuracy)} | ${s.perfectPostings} of ${s.postings} | ${s.correct} | ${s.missed} | ${s.extra} |`,
    )
  }
  lines.push('')

  const groups = [...new Set(result.scores.matcher.map((s) => s.group))]
  if (groups.length > 1) {
    lines.push('F1 by kind of posting:', '')
    lines.push(`| Kind | Postings | ${extractors.map((e) => label[e]).join(' | ')} |`)
    lines.push(`| --- | --- | ${extractors.map(() => '---').join(' | ')} |`)
    for (const group of groups) {
      const cells = extractors.map((e) => {
        const s = summarise(result.scores[e].filter((x) => x.group === group))
        // A group that asks for nothing has no F1. Show how many stray skills were reported instead.
        return s.f1 === null ? `${s.extra} extra` : pct(s.f1)
      })
      lines.push(`| ${group} | ${result.scores.matcher.filter((x) => x.group === group).length} | ${cells.join(' | ')} |`)
    }
    lines.push('')
  }
}
if (withClaude) lines.push(`Claude quotes thrown away for not matching the text word for word: ${droppedQuotes}.`, '')
writeFileSync(path.join(here, 'results.md'), lines.join('\n'))
writeFileSync(path.join(here, 'results.json'), JSON.stringify(summaryJson, null, 2))

// Every mistake, posting by posting. The synthetic set's file goes in the repo.
// Each private set gets its own file inside evals/private, which git ignores,
// because it names real postings.
for (const [index, result] of results.entries()) {
  const file = index === 0 ? path.join(here, 'mistakes.md') : path.join(privateDir, `mistakes-${result.set}.md`)
  writeFileSync(file, mistakesReport(result).join('\n'))
}

function mistakesReport(result) {
  const detail = [`# Every mistake, posting by posting (${result.set} set)`, '']
  for (const score of result.scores.matcher) {
    const rows = extractors
      .map((e) => {
        const s = result.scores[e].find((x) => x.id === score.id)
      const parts = [
        s.missed.length ? `missed ${s.missed.map(name).join(', ')}` : '',
        s.extra.length ? `extra ${s.extra.map(name).join(', ')}` : '',
        s.wrongLevel.length ? `wrong level ${s.wrongLevel.map(name).join(', ')}` : '',
      ].filter(Boolean)
        return parts.length ? `- ${label[e]}: ${parts.join('; ')}` : ''
      })
      .filter(Boolean)
    if (rows.length) detail.push(`## ${score.id} ${score.title}`, '', ...rows, '')
  }
  return detail
}

console.log(lines.slice(11).join('\n'))
if (withClaude) console.log(`New Claude calls this run: ${newCalls}, costing $${newCost.toFixed(4)}. Saved replies reused: the rest.`)
await vite.close()
