# Skill Map (working title)

Paste job postings and a resume, get an explorable skill tree: what you have, what is missing, what to learn next. Software, data and AI roles only. The approved build plan is in `docs/PLAN.md`.

## Commands

```bash
npm install
npm run dev      # http://localhost:5183
npm run build    # type check, then production build
npm run lint
npm test
```

## Where things stand

Update this section as milestones land.

- **Milestone 1 (foundation and one screen): built, waiting for the visual direction to be approved.**
- The map is a 3D "galaxy disc" drawn with hand-written projection maths in `src/map/camera.ts` (no graphics library). The flat view is the same renderer with the camera looking straight down. 3D work was capped at half a day; do not add more 3D features without asking.
- Not yet watched running continuously by Claude: the opening animation and the idle spin. The preview pane only paints frames on input, so the owner needs to confirm these by eye.
- Milestones 2 to 7: not started.
- Not a git repository yet. Ask before `git init` and before every commit.

## Rules that always apply

- `src/domain` is pure: no React, no network, no browser APIs. Rules go there, with tests.
- Sample data is fictional and says so, in the file and on screen. `src/data/sampleAnalysis.ts` is hand-typed scaffolding until milestone 2 computes it.
- Every skill name and alias in `src/data/taxonomy.json` must belong to one skill only. `npm test` checks this, plus missing prerequisites and loops.
- Colours are CSS variables in `src/styles.css`. The canvas reads the same variables, so do not hard-code colours in the renderer.
- No account, no database. Resume text stays in the browser.
- Real job postings are copyrighted: they go in `evals/private/` (git-ignored), never in the repo.
- Ask before: adding a dependency not in the plan, any API call that costs money (estimate first, hard stop at $3 total), `git init`, commits, deploying.
- Checkpoints are a walkthrough of the real code at the end of each milestone. No quizzes for this project (the owner's choice, overriding the global working agreement).
