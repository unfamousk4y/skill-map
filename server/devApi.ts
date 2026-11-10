// Runs the Claude handler inside the local dev server (`npm run dev`), at
// /api/extract. This is the only place Claude is reachable from. The built
// site that gets deployed is plain files with no server code, so the public
// site cannot spend API credit.

import Anthropic from '@anthropic-ai/sdk'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { handleExtract, type Ledger, type LedgerEntry } from './extractHandler.ts'

/** Dollars. The project rule is a hard stop at $3 of the owner's API credit. */
export const BUDGET = 3

const KEY_FILE = '.dev.vars'
const LOG_FILE = path.join('evals', 'spend-log.jsonl')
/** Largest request body accepted, in bytes. A 20,000-character document is well under this. */
const MAX_BODY = 200_000

/** Reads the API key from .dev.vars each time, so adding the key needs no restart. Never logged. */
async function readKey(root: string): Promise<string | null> {
  try {
    const file = await readFile(path.join(root, KEY_FILE), 'utf8')
    const line = file.split(/\r?\n/).find((l) => l.trim().startsWith('ANTHROPIC_API_KEY='))
    const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    return value ? value : null
  } catch {
    return null // no file yet
  }
}

/** The spend log: one line of JSON per call, holding token counts and cost but never any document text. */
export function fileLedger(root: string): Ledger {
  const file = path.join(root, LOG_FILE)
  return {
    async total() {
      try {
        const lines = (await readFile(file, 'utf8')).split('\n').filter((l) => l.trim() !== '')
        return lines.reduce((sum, l) => sum + ((JSON.parse(l) as LedgerEntry).cost ?? 0), 0)
      } catch {
        return 0 // no log yet
      }
    },
    async add(entry) {
      await mkdir(path.dirname(file), { recursive: true })
      await appendFile(file, JSON.stringify(entry) + '\n', 'utf8')
    },
  }
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        resolve(null)
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  res.setHeader('content-type', response.headers.get('content-type') ?? 'application/json')
  res.end(await response.text())
}

export function devApi(): Plugin {
  return {
    name: 'skill-map-dev-api',
    // "serve" means the dev server only. The plugin does nothing during `npm run build`.
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root
      const ledger = fileLedger(root)

      // Lets the page ask whether Claude mode is available, and how much has been spent.
      server.middlewares.use('/api/status', async (_req, res) => {
        const spent = await ledger.total()
        await send(res, Response.json({ claude: (await readKey(root)) !== null, spent, budget: BUDGET }))
      })

      server.middlewares.use('/api/extract', async (req, res) => {
        const body = req.method === 'POST' ? await readBody(req) : ''
        if (body === null) {
          await send(res, Response.json({ error: 'too_long', message: 'The request was too large.' }, { status: 413 }))
          return
        }
        const key = await readKey(root)
        const request = new Request('http://localhost/api/extract', {
          method: req.method ?? 'GET',
          headers: { 'content-type': 'application/json' },
          body: req.method === 'POST' ? body : undefined,
        })
        await send(
          res,
          await handleExtract(request, {
            client: key ? new Anthropic({ apiKey: key }) : null,
            ledger,
            budget: BUDGET,
          }),
        )
      })
    },
  }
}
