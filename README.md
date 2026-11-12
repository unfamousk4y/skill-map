# Skill Map

Paste a few job postings and your resume. Skill Map draws an explorable 3D map of the skills those jobs ask for: the ones you have are lit, the gaps are dim, and the best ones to learn next are marked. Every claim on the map can be traced to the exact line that supports it.

It covers software, data and AI roles. It runs entirely in your browser: nothing you paste is uploaded.

**Live demo:** https://skill-map-54l.pages.dev

## Why it is different from asking a chatbot

- **Every claim is checkable.** Click a skill to see the sentences from the postings that ask for it and the resume lines that show it. A piece of code, not the AI, throws away any quote that is not word for word in your text (`src/domain/verify.ts`).
- **You confirm what was found before anything is built.** A review step shows each document with the found words highlighted in place, labels each finding by how strong the evidence is, and lets you remove a wrong one or add a missed one (`src/features/ReviewScreen.tsx`).
- **The arithmetic is on screen.** A skill's demand score is `postings that require it × 1 + postings that prefer it × 0.5`, and the panel shows the numbers that went in.
- **It knows what builds on what.** A hand-curated list of 151 skills has 138 "learn this first" links. The learning order never puts a skill before something it depends on, and a skill nobody names can still rank high if wanted skills are built on it.
- **It works with no AI at all, and the difference is measured.** A dictionary matcher runs free in the browser. Claude is an optional, more accurate reader. Both were scored on the same test (below).
- **Private by design.** No account, no database, no server. Your text is saved in your browser only, and a share link carries skill names and counts, never your resume.

## How it works

```
your text ──► extract ──► check quotes ──► you review ──► count ──► rank ──► draw
              matcher      verify.ts       review.ts     score.ts   rank.ts   map/
              or Claude
```

1. **Extract.** Each posting and the resume is read for skills. The free matcher (`src/domain/matcher.ts`) looks names up in the skill list. It handles aliases ("k8s"), names that are also ordinary words ("Go", "Swift" only count with the right capital letter and context), and section headings such as "Nice to have".
2. **Check quotes.** Each finding comes with the piece of text that supports it. If that piece is not in the document word for word, the finding is dropped.
3. **You review.** Findings are labelled high (named outright), medium (the word has other meanings) or low (described but not named). The confidence score is simply the share that are named outright.
4. **Count and rank.** Postings are counted per skill. Gaps are ordered with a topological sort: an ordering where nothing comes before the thing it depends on.
5. **Draw.** The map is a "galaxy disc": one sector per category, rings running from foundations in the middle to advanced skills at the edge.

Everything in `src/domain` is plain TypeScript with no React, no network and no browser APIs, which is why it can be tested directly.

## The map renderer

The 3D view uses no graphics library. `src/map/camera.ts` projects each point by hand (rotate, tilt, then divide by distance for perspective), and `src/map/renderer.ts` draws to an ordinary 2D canvas, sorting by depth so nearer skills cover farther ones.

Measured on 2026-11-10 with the built-in speed test (`/?bench` on the dev server), on one desktop with a 165 Hz screen:

| Skills on the map | Time in our drawing code per frame | On screen |
| --- | --- | --- |
| 60 (a typical map) | 0 to 1 ms | 165 frames per second |
| 200 | 1 to 2 ms | 165 frames per second |
| 500 | 3 to 4 ms | 165 frames per second |
| 1,000 | 5 to 6 ms | 165 frames per second |

That browser's clock ticks in whole milliseconds, hence the ranges. One machine, one browser: a phone will be slower.

The map can be used without a mouse (arrow keys move between skills), and a List view gives the same information as plain tables for screen readers.

## Accuracy, measured

Both extractors were scored against answer keys. Full method, every individual mistake, and the limits are in [evals/README.md](evals/README.md).

- **Precision**: of the skills reported, the share that were right.
- **Recall**: of the skills really asked for, the share that were found.

**30 synthetic postings** (written by an AI to include hard cases; answer key hand-checked by the author):

| Extractor | Precision | Recall | Recall on skills described but not named |
| --- | --- | --- | --- |
| Free matcher | 89% | 78% | 0% (0 of 28) |
| Claude (`claude-haiku-5-5`, low effort) | 97% | 99% | 96% (27 of 28) |

**13 real internship postings** (labelled by the author before seeing any output; not in this repository, because posting text is copyrighted):

| Extractor | Recall |
| --- | --- |
| Free matcher | 97% (62 of 64) |
| Claude | 100% (64 of 64) |

What these numbers do and do not show:

- **The synthetic test flatters Claude.** The postings were written by a model from the same family, and a third of them were built so that a dictionary must fail. The 0% is by construction.
- **On real postings the two are close on recall,** because real postings mostly name their skills.
- **Precision on real postings is not reported.** Both extractors also returned skills from "Responsibilities" sections, which the answer key did not list. Whether each of those is right needs a person to judge, and that has not been done. Claude returned about twice as many of these as the matcher (48 against 23).
- **It is a small test.** One mistake moves a synthetic score by about 0.7 points.
- **Nothing was tuned on the test.** The matcher, the instructions to Claude and the skill list are the ones from the first run. Known, fixable misses are left in the mistakes file on purpose.

The whole evaluation, including every Claude call made while building, cost $0.04.

## Limits

- **Software, data and AI roles only.** A posting for another field will mostly come back empty.
- **The free matcher only finds skills that are named.** "You have put a model into production" is invisible to it. The public site uses the free matcher.
- **The skill list has gaps.** Real postings asked for things it does not have, such as "APIs" in general, AI coding assistants and "software design".
- **Claude mode runs only on a developer's machine.** The published site is static files with no server, so it cannot hold an API key or spend money.
- **No accounts.** Your data lives in one browser on one device. Clearing site data deletes it; "Download a copy" exports it first.
- **A share link is not private.** Anyone who has it can open it. It holds skill names, counts and whether each is covered, nothing else.

## Run it yourself

Built and tested on Node 26 (the version in `.node-version`).

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5183. Other commands:

```bash
npm test
```

```bash
npm run build
```

```bash
node evals/run.mjs
```

The last one re-runs the accuracy test for the free matcher at no cost.

**Optional Claude mode.** Create a file named `.dev.vars` in the project root containing `ANTHROPIC_API_KEY=...` and restart `npm run dev`. The paste-in form then offers Claude as a reader. Every call is logged with its cost, and the server refuses to call once the total reaches $3 (`server/extractHandler.ts`). The key file is git-ignored.

## What is in the box

| Folder | What it holds |
| --- | --- |
| `src/domain` | The rules: matcher, quote check, scoring, ranking, layout, review, progress, share links. Pure and tested. |
| `src/map` | Camera maths, canvas renderer, keyboard navigation, speed test. |
| `src/features` | Screens: paste-in form, review step, side panel, list view. |
| `src/extract` | The two readers behind one interface. |
| `src/storage` | Saving in the browser, and the check on what comes back out. |
| `server` | The local-only Claude endpoint, with its spend limit. |
| `evals` | Test postings, answer key, scoring script, results and every mistake. |

About 5,200 lines of TypeScript and 1,700 lines of tests (233 tests). Three runtime dependencies: React, React DOM, and, for local Claude mode only, Anthropic's SDK. The published page is one 100 kB script (gzipped) and makes no network requests after it loads.

Security notes: the published site sends a Content-Security-Policy that limits scripts, styles and network requests to the site itself (`public/_headers`). Anything read from browser storage or from a share link is treated as untrusted and checked before use. Proof links are limited to `http` and `https`.

## How it was built

Built in under a week in November 2026 with Claude Code (Claude Fable 5.2) writing the code under my direction. I set the product, the constraints and the scope, chose between the options at each decision, reviewed each milestone against the running app, labelled the real test postings and checked the answer key. The plan we worked from is in [docs/PLAN.md](docs/PLAN.md).

All sample data in the app is fictional and says so on screen.
