// Serves the production build from dist/ on http://localhost:5184, with the
// same response headers Cloudflare Pages will send (read from dist/_headers).
// Run `npm run build` first. This is for checking the build before deploying:
// in particular that the Content-Security-Policy does not block the app.
//
//   node server/serveDist.mjs

import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const PORT = 5184
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }

// Parse the _headers file: a path pattern on its own line, then indented "Name: value" lines.
const rules = []
for (const line of readFileSync(path.join(dist, '_headers'), 'utf8').split('\n')) {
  if (line.trim() === '' || line.trim().startsWith('#')) continue
  if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] })
  else {
    const at = line.indexOf(':')
    rules.at(-1)?.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()])
  }
}
const matches = (pattern, url) => (pattern.endsWith('*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern)

createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost').pathname
  let file = path.join(dist, path.normalize(url))
  // Stay inside dist, and fall back to the app for any path that is not a file.
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  for (const rule of rules) {
    if (matches(rule.pattern, url)) for (const [name, value] of rule.headers) response.setHeader(name, value)
  }
  response.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
  response.end(readFileSync(file))
}).listen(PORT, () => console.log(`Production build on http://localhost:${PORT}`))
