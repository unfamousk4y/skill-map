# Skill Map (working title)

Paste job postings and a resume, get an explorable skill tree: what you have, what is missing, what to learn next. Software, data and AI roles only. The approved build plan is in `docs/PLAN.md`. **Resuming work? Read `docs/HANDOFF.md` first.**

## Commands

```bash
npm install
npm run dev      # http://localhost:5183
npm run build    # type check, then production build
npm run lint
npm test
```

Developer speed test: run `npm run dev` and open http://localhost:5183/?bench

## Where things stand

Update this section as milestones land.

- **Milestone 1 (foundation and 3D map screen): done and committed.**
- **Milestone 2 (the engine without AI): done and committed.** Pipeline: `matcher.ts` finds skills, `verify.ts` checks quotes, `score.ts` counts, `rank.ts` orders. `src/extract/dictionary.ts` runs them in sequence.
- **Milestone 3 (keyboard use, list view, phone layout, speed test): done and committed.** Accepted by the owner on screen; Claude only checked it by reading the page and sending key presses.
- **Milestone 4 (Claude extraction): done and committed.** Real test on 2026-11-10 with `node evals/smoke.mjs`: 8 documents for $0.0032, no quotes dropped, hostile posting ignored. On the built-in sample Claude and the free matcher agree almost exactly, because the sample names every skill outright; milestone 5 needs postings that describe skills without naming them.
- **Milestone 5 (accuracy test): done and committed.** Two test sets, which disagree: 30 synthetic postings (matcher 91% precision / 79% recall, Claude 99% / 99%) and 13 real postings labelled by the owner (matcher 73% / 97%, Claude 57% / 100%). On real postings both extractors report extra skills, mostly from "Responsibilities" sections. The synthetic key has not been hand-checked. Nothing was tuned on either set: keep it that way. Full detail and limits in `evals/README.md`.
- **Milestones 6 (progress and sharing) and 7 (ship): not started.** Read `docs/HANDOFF.md` first: it has the current state, the open questions for the owner, and what is next.
- Total API spend so far: $0.0325 of the $3 limit.
- Decision 2026-11-10: beta testers use the free matcher at no cost. Claude runs only on the owner's machine, for the demo video and the accuracy comparison. The deployed site is static files with no server, so it cannot spend API credit. There is no Cloudflare Function and `wrangler` is not installed (both were in the original plan).
- Decision 2026-11-10: the server uses the official `@anthropic-ai/sdk` library, not plain `fetch` as the plan first said, following Anthropic's guidance. Read the Claude API reference first and give a cost estimate before any paid call.
- Speed test: open `/?bench`. "Our code" numbers from Claude's hidden preview on 2026-11-10 (Chrome 152): 60 skills 4.7 ms, 200 skills 7.8 ms, 500 skills 16.0 ms, 1000 skills 26.7 ms per frame. The owner's visible browser on 2026-11-10: our code 0 to 1 ms at 60 skills, 1 to 2 ms at 200, 3 to 4 ms at 500, 5 to 6 ms at 1000 (that browser's clock ticks in whole milliseconds), and 6.1 ms between frames on screen at every size, which is a steady 165 frames per second on a 165 Hz screen.
- The map is a 3D "galaxy disc" drawn with hand-written projection maths in `src/map/camera.ts` (no graphics library). The flat view is the same renderer with the camera looking straight down. 3D work was capped at half a day; do not add more 3D features without asking.
- Not yet watched running continuously by Claude: the opening animation and the idle spin. The preview pane only paints frames on input, so the owner needs to confirm these by eye.
- Pasted text is held in memory only and is lost on reload. Saving it in the browser is milestone 6.
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
- Ambiguous skill names go in a skill's `cased` or `listed` list in the taxonomy, not in `aliases`. Add a test in `matcher.test.ts` for any false match you fix.
- Every skill name and alias in `src/data/taxonomy.json` must belong to one skill only. `npm test` checks this, plus missing prerequisites and loops.
- Colours are CSS variables in `src/styles.css`. The canvas reads the same variables, so do not hard-code colours in the renderer.
- No account, no database. Resume text stays in the browser.
- Real job postings are copyrighted: they go in `evals/private/` (git-ignored), never in the repo.
- Ask before: adding a dependency not in the plan, any API call that costs money (estimate first, hard stop at $3 total), `git init`, commits, deploying.
- Checkpoints are a walkthrough of the real code at the end of each milestone. No quizzes for this project (the owner's choice, overriding the global working agreement).
