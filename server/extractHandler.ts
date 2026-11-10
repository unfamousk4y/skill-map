// The one place that calls Claude. It takes a web Request and returns a web
// Response, so it can run inside the dev server today and be deployed as a
// serverless function later without changes.
//
// It never logs or stores the document text, and it never sees the API key:
// the caller hands it a ready-made client.

import Anthropic from '@anthropic-ai/sdk'
import {
  buildSystemPrompt,
  buildUserMessage,
  CLAUDE_MODEL,
  outputSchema,
  parseExtraction,
  type ExtractError,
  type ExtractReply,
} from '../src/extract/claudeFormat.ts'
import { taxonomy } from '../src/domain/taxonomy.ts'
import { costOf, type TokenUse } from './pricing.ts'

/** The same limit the browser applies. Checked again here because a server must not trust its callers. */
export const MAX_CHARS = 20_000

export type LedgerEntry = TokenUse & { at: string; kind: string; model: string; cost: number }

/** Where spending is recorded. A file in development; anything with these two functions works. */
export type Ledger = {
  total(): Promise<number>
  add(entry: LedgerEntry): Promise<void>
}

/** Just the one method we use, so tests can pass in a fake. */
export type ClaudeClient = {
  messages: { create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> }
}

export type Deps = {
  /** null when no API key is configured. */
  client: ClaudeClient | null
  ledger: Ledger
  /** Dollars. Once the ledger total reaches this, no more calls are made. */
  budget: number
}

const json = (status: number, body: ExtractReply | ExtractError): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fail = (status: number, error: string, message: string) => json(status, { error, message })

// Built once: the instructions and the reply shape are the same for every call.
const SYSTEM = buildSystemPrompt(taxonomy)
const SCHEMA = outputSchema(taxonomy)

export async function handleExtract(request: Request, deps: Deps): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'method', 'Send a POST request.')
  if (!deps.client) return fail(503, 'ai_off', 'Claude mode is not set up on this server.')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(400, 'bad_request', 'The request was not valid JSON.')
  }
  const { kind, text } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (kind !== 'posting' && kind !== 'resume') return fail(400, 'bad_request', 'kind must be "posting" or "resume".')
  if (typeof text !== 'string' || text.trim() === '') return fail(400, 'bad_request', 'text must not be empty.')
  if (text.length > MAX_CHARS) return fail(413, 'too_long', `text must be at most ${MAX_CHARS} characters.`)

  // The hard stop on spending. Checked before every call.
  if ((await deps.ledger.total()) >= deps.budget) {
    return fail(402, 'budget_reached', `The spending limit of $${deps.budget.toFixed(2)} has been reached.`)
  }

  let response: Anthropic.Message
  try {
    response = await deps.client.messages.create({
      model: CLAUDE_MODEL,
      // Room for the model's private reasoning plus the JSON answer.
      max_tokens: 8000,
      // cache_control lets the API reuse these instructions on later calls at a tenth of the price.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: {
        // "low" is the cheapest and fastest setting. Milestone 5 measures whether a higher one earns its cost.
        effort: 'low',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{ role: 'user', content: buildUserMessage(kind, text) }],
    })
  } catch (error) {
    // Most specific first. None of these messages include the key or the document.
    if (error instanceof Anthropic.AuthenticationError) return fail(502, 'bad_key', 'The API key was rejected.')
    if (error instanceof Anthropic.RateLimitError) return fail(429, 'rate_limited', 'Claude is busy. Try again in a minute.')
    if (error instanceof Anthropic.APIConnectionError) return fail(502, 'unreachable', 'Could not reach Claude.')
    if (error instanceof Anthropic.APIError) return fail(502, 'api_error', `Claude returned an error (${error.status}).`)
    return fail(500, 'server_error', 'Something went wrong on the server.')
  }

  // Record what it cost before doing anything else, so a later failure cannot hide a charge.
  const use: TokenUse = {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
  }
  const cost = costOf(use)
  await deps.ledger.add({ at: new Date().toISOString(), kind, model: CLAUDE_MODEL, ...use, cost })

  // Check why the model stopped before reading what it wrote.
  if (response.stop_reason === 'refusal') return json(200, { status: 'unusable', reason: 'Claude declined to read this document.', cost })
  if (response.stop_reason === 'max_tokens') return json(200, { status: 'unusable', reason: 'The answer was cut off.', cost })

  // The reply can start with a "thinking" block, so find the text by its type, not its position.
  const answer = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text')
  const extraction = answer ? parseExtraction(answer.text, taxonomy) : null
  if (!extraction) return json(200, { status: 'unusable', reason: 'The answer was not in the expected format.', cost })

  return json(200, { status: 'ok', ...extraction, cost })
}
