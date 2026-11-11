# Accuracy test

This folder measures how well the two extractors find skills in job postings: the free dictionary matcher and Claude. Results are in [results.md](results.md) and every individual mistake is in [mistakes.md](mistakes.md).

There are two test sets, and they disagree. Read both before quoting anything.

## Synthetic postings (30 postings, 141 skills in the answer key, written by an AI)

| Extractor | Precision | Recall | Recall on described skills |
| --- | --- | --- | --- |
| Free matcher | 91% | 79% | 0% (0 of 28) |
| Claude, low effort | 99% | 99% | 96% (27 of 28) |
| Claude, medium effort | 99% | 99% | 92% |

Measured on 2026-11-10 with `claude-haiku-5-5`. The Claude runs cost $0.0122 in total for 60 calls.

## Real postings (13 postings, 64 skills in the key, hand-labelled by the project owner)

| Extractor | Precision | Recall | Extra skills reported |
| --- | --- | --- | --- |
| Free matcher | 73% | 97% (62 of 64) | 23 |
| Claude, low effort | 57% | 100% (64 of 64) | 48 |
| Claude, medium effort | 64% | 100% | 36 |

Measured on 2026-11-10. The postings are real internship listings and are not in the repository. These Claude runs cost $0.0172.

**This is the more trustworthy table, and it tells a different story from the synthetic one.** A person who had not seen the extractors' output wrote this key.

What it shows:

- **Both extractors find nearly everything the person listed.** Claude missed nothing, the matcher missed 2 of 64.
- **Both report many skills the person did not list, and Claude reports about twice as many.** Almost all of them come from the "Responsibilities" part of a posting ("participate in code reviews", "hands-on experience with Kubernetes"), where the key only lists what is under "Requirements" and "Desired qualifications". Whether those count is a product decision that has not been made yet, so this precision figure measures agreement with a requirements-only key, not errors.
- **Some of Claude's extras are real over-reach.** It reported "LLM APIs" for a posting that asks for experience with AI coding assistants, and "System design" for the phrase "software design".
- **The skill list has gaps.** Ten of the owner's labels have no matching skill: APIs in general (3 postings), AI-assisted development tools (3), software design (3), cloud in general, databases in general, text-to-speech, GCC, prototyping and multimodal models.

Nothing was changed in response to these results. The instructions to Claude, the matcher and the skill list are the same ones that produced the synthetic numbers.

## Review status of the synthetic answer key

Not yet checked by a person. On 2026-11-10 the model that wrote the key re-read all 30 postings and changed nothing, which is weak evidence because it is the same author. Three entries are judgment calls a person should decide:

- **s14**: the title is "ML Engineer Intern" but the key does not include Machine learning, because the body never asks for it. The matcher reports it and is marked wrong.
- **s15**: "summarise a dataset and say how confident you are in an estimate" is keyed as Statistics. Claude answered Data analysis instead, which is arguably also right.
- **s30**: "reading other people's code to find flaws before it ships" is keyed as Code review (preferred). It could be read as part of Application security, which is already in the key.

## Read these limits before quoting the numbers

1. **The test was written by an AI.** The 30 postings and their answer key were drafted by Claude (a larger model than the one being tested). A model grading its own family's homework is likely to score too well, because they share the same idea of what "asks for a skill" means. The key is only trustworthy once a person has checked it: see [REVIEW.md](REVIEW.md).
2. **The postings are short and clean.** Real postings are longer and messier. Expect both extractors to do worse on them. Real postings can be added privately (below).
3. **It is a small test.** With 141 skills, one mistake moves a score by about 0.7 points, and "96% of described skills" means 27 of 28. Treat a one or two point gap as no gap.
4. **The matcher was not tuned to this test.** The numbers are from the first run. The mistakes file shows fixable gaps (for example it misses "A/B tests" because only "A/B testing" is listed). Fixing those and re-running on the same postings would make the matcher look better than it is on new text, so fixes should be judged on postings it has not seen.
5. **"Described" postings were written to be hard for a dictionary.** The 0% is by construction: those skills never appear by name. It shows what kind of skill the matcher cannot find, not how often that happens in real postings.

## What the test did show

- The matcher is reliable when a skill is named and the wording is plain (98% F1 on the "named" and "levels" groups).
- The matcher is fooled by context: it reports a skill the posting says is *not* needed, or one that only the company uses (11 wrong reports: ten where the context says the skill is not being asked for, and one taken from a job title).
- Claude follows the instructions about context in almost every case, and its two wrong reports include a real error: at low effort it read "You react quickly" as the React library.
- Medium effort was no better than low, so the app uses low.
- No quote from Claude failed the word-for-word check in 60 calls.

## Running it

```bash
node evals/run.mjs            # free matcher only, costs nothing
node evals/run.mjs --claude   # also Claude; needs `npm run dev` running and a key in .dev.vars
```

Claude's replies are saved in `evals/cache/`, so running again costs nothing unless the posting text, the model, the instructions or the effort level changed.

## Adding real postings (kept private)

Real postings are copyrighted, so they never go in the repository. Put them in `evals/private/`, which git ignores, as a file like this:

```json
{
  "name": "real",
  "postings": [
    {
      "id": "r01",
      "text": "Paste the full posting here, with \\n for line breaks",
      "expected": { "required": ["python", "sql"], "preferred": ["docker"], "described": [] }
    }
  ]
}
```

Use skill ids from `src/data/taxonomy.json`. The runner reports each private set as its own table, and keeps its saved replies in `evals/private/cache/`.

## How scoring works

For each posting the extractor's skills are compared with the key (`src/eval/scoring.ts`):

- **Precision**: of the skills it reported, the share that are in the key.
- **Recall**: of the skills in the key, the share it reported.
- **F1**: a single number that is high only when both are.
- **Level**: of the skills it got right, the share where required/preferred also matched.

Counts are added up across all postings before dividing, so a posting with ten skills weighs more than one with two.
