# Skill Map (working title)

Paste job postings and a resume, get an explorable skill tree: what you have, what is missing, what to learn next. Software, data and AI roles only. The approved build plan is in `docs/PLAN.md`. **Resuming work? Read `docs/HANDOFF.md` first.**

## Commands

```bash
npm install
npm run dev      # http://localhost:5183
npm run build    # type check, then production build
npm run lint
npm test
node server/serveDist.mjs   # the production build with its real headers, http://localhost:5184
```

Developer speed test: run `npm run dev` and open http://localhost:5183/?bench

## Where things stand

Update this section as milestones land.

- **Milestone 1 (foundation and 3D map screen): done and committed.**
- **Milestone 2 (the engine without AI): done and committed.** Pipeline: `matcher.ts` finds skills, `verify.ts` checks quotes, `score.ts` counts, `rank.ts` orders. `src/extract/dictionary.ts` runs them in sequence.
- **Milestone 3 (keyboard use, list view, phone layout, speed test): done and committed.** Accepted by the owner on screen; Claude only checked it by reading the page and sending key presses.
- **Milestone 4 (Claude extraction): done and committed.** Real test on 2026-11-10 with `node evals/smoke.mjs`: 8 documents for $0.0032, no quotes dropped, hostile posting ignored. On the built-in sample Claude and the free matcher agree almost exactly, because the sample names every skill outright; milestone 5 needs postings that describe skills without naming them.
- **Milestone 5 (accuracy test): done and committed.** Two test sets, which disagree: 30 synthetic postings (matcher 89% precision / 78% recall, Claude 97% / 99%, after a second reviewer's corrections to the key) and 13 real postings labelled by the owner (matcher 73% / 97%, Claude 57% / 100%). On real postings both extractors report extra skills, mostly from "Responsibilities" sections. Decision 2026-11-10: those skills count, so the real-set precision figures are not true precision (the owner's key is requirements-only); quote recall only until a person has judged the extras. The owner confirmed on 2026-11-10 that the synthetic key is hand-checked. Nothing was tuned on either set: keep it that way. Full detail and limits in `evals/README.md`.
- **Milestone 6 (progress and sharing): done and committed.** Text, snapshots and proof links are saved in IndexedDB (`src/storage`). Rules are in `src/domain/progress.ts` and `src/domain/share.ts`. Checked by Claude through the page text only; the map redrawing after "mark as learned", the Copy link button and the downloaded file were not seen.
- **Review step ("Keywords found. Are they right?"): done and committed. Accepted by the owner on screen on 2026-11-10.** After the text is read and before the map is built, `src/features/ReviewScreen.tsx` shows each document with the found words highlighted, a confidence label per finding, and lets the student remove, add or re-label skills. Rules in `src/domain/review.ts`. Both pipelines now return an `Extraction` (`src/extract/extraction.ts`) that is scored only after review. Checked by Claude through page text only, not by eye.
- **Milestone 7 (ship): written 2026-11-11, not deployed.** `README.md`, `docs/DEMO_SCRIPT.md` and `docs/RESUME_ENTRY.md` exist. The site is ready for static hosting: `public/_headers` sets a Content-Security-Policy, and the published build never calls `/api`. Check a build as it will be hosted with `npm run build` then `node server/serveDist.mjs` (http://localhost:5184). Deploying and making the repository public both wait for the owner. When numbers change, update the README, the demo script and the resume entry together. Read `docs/HANDOFF.md` first.
- Total API spend so far: $0.0363 of the $3 limit.
- Decision 2026-11-10: beta testers use the free matcher at no cost. Claude runs only on the owner's machine, for the demo video and the accuracy comparison. The deployed site is static files with no server, so it cannot spend API credit. There is no Cloudflare Function and `wrangler` is not installed (both were in the original plan).
- Decision 2026-11-10: the server uses the official `@anthropic-ai/sdk` library, not plain `fetch` as the plan first said, following Anthropic's guidance. Read the Claude API reference first and give a cost estimate before any paid call.
- Speed test: open `/?bench`. "Our code" numbers from Claude's hidden preview on 2026-11-10 (Chrome 152): 60 skills 4.7 ms, 200 skills 7.8 ms, 500 skills 16.0 ms, 1000 skills 26.7 ms per frame. The owner's visible browser on 2026-11-10: our code 0 to 1 ms at 60 skills, 1 to 2 ms at 200, 3 to 4 ms at 500, 5 to 6 ms at 1000 (that browser's clock ticks in whole milliseconds), and 6.1 ms between frames on screen at every size, which is a steady 165 frames per second on a 165 Hz screen.
- The map is a 3D "galaxy disc" drawn with hand-written projection maths in `src/map/camera.ts` (no graphics library). The flat view is the same renderer with the camera looking straight down. 3D work was capped at half a day; do not add more 3D features without asking.
- Not yet watched running continuously by Claude: the opening animation and the idle spin. The preview pane only paints frames on input, so the owner needs to confirm these by eye.
- Ask before every commit.

## Claude mode (local only)

- Create a file named `.dev.vars` in the project root containing `ANTHROPIC_API_KEY=...`. It is git-ignored. Never print, log or commit it. Claude Code must not open this file.
- `npm run dev` then serves `/api/extract` and `/api/status` from `server/devApi.ts`. The paste-in form shows a "Claude" option only when the key file exists.
- Every call is recorded in `evals/spend-log.jsonl` (token counts and cost, never document text). `server/extractHandler.ts` refuses to call Claude once the total reaches $3.
- Model `claude-haiku-5-5`, effort `low`, JSON output limited to our skill ids. Prices are in `server/pricing.ts`.
- Tests use a fake client (`server/extractHandler.test.ts`, `src/extract/claude.test.ts`) and never spend money.

## Rules that always apply

- `src/domain` is pure: no React, no network, no browser APIs. Rules go there, with tests.
- Sample data is fictional and says so, in the file and on screen. `src/data/sampleTexts.ts` is ordinary text run through the real engine: never hand-type results.
- Every quote shown to the user must pass `verifyMentions` (word for word in the source text). This applies to the Claude extractor too.
- A skill the student adds by hand during review has no quote (`manual: true`, empty quote). Never invent one for it. The map is always rebuilt in layers from the extractor's findings: corrections first, then learned marks. Neither layer overwrites the one below.
- The confidence label is a rule about the kind of evidence (named, ambiguous word, described), and the score is the share named outright. It is not a measured probability: do not describe it as one.
- Ambiguous skill names go in a skill's `cased` or `listed` list in the taxonomy, not in `aliases`. Add a test in `matcher.test.ts` for any false match you fix.
- Every skill name and alias in `src/data/taxonomy.json` must belong to one skill only. `npm test` checks this, plus missing prerequisites and loops.
- Colours are CSS variables in `src/styles.css`. The canvas reads the same variables, so do not hard-code colours in the renderer.
- No account, no database. Resume text stays in the browser.
- A share link and a snapshot hold skill ids, counts and states only. Never put pasted text, quotes or proof links in either.
- Anything read back from storage or from a link is untrusted: it goes through `parseSaved` or `decodeShare` first. Proof links must pass `validProofUrl` (http and https only) before they are shown as a link.
- Real job postings are copyrighted: they go in `evals/private/` (git-ignored), never in the repo.
- Ask before: adding a dependency not in the plan, any API call that costs money (estimate first, hard stop at $3 total), `git init`, commits, deploying.
- Checkpoints are a walkthrough of the real code at the end of each milestone. No quizzes for this project (the owner's choice, overriding the global working agreement).
