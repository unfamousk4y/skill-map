# Accuracy test

This folder measures how well the two extractors find skills in job postings: the free dictionary matcher and Claude. Results are in [results.md](results.md) and every individual mistake is in [mistakes.md](mistakes.md).

There are two test sets, and they disagree. Read both before quoting anything.

## Synthetic postings (30 postings, 138 skills in the answer key, written by an AI)

| Extractor | Precision | Recall | Recall on described skills |
| --- | --- | --- | --- |
| Free matcher | 89% | 78% | 0% (0 of 28) |
| Claude, low effort | 97% | 99% | 96% (27 of 28) |
| Claude, medium effort | 97% | 99% | 92% |

Measured on 2026-11-10 with `claude-haiku-5-5`, and re-scored the same day from the saved replies after the answer key was corrected (see "Review status" below). The Claude runs cost $0.0122 in total for 60 calls.

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
- **Both report many skills the person did not list, and Claude reports about twice as many.** Almost all of them come from the "Responsibilities" part of a posting ("participate in code reviews", "hands-on experience with Kubernetes"), where the key only lists what is under "Requirements" and "Desired qualifications". **Decision, 2026-11-10: skills under Responsibilities count.** So this precision figure measures agreement with a requirements-only key, not errors, and should not be quoted as precision. The honest figures from this set are the recall numbers. A real precision figure needs each extra skill judged right or wrong by a person.
- **Some of Claude's extras are real over-reach.** It reported "LLM APIs" for a posting that asks for experience with AI coding assistants, and "System design" for the phrase "software design".
- **The skill list has gaps.** Ten of the owner's labels have no matching skill: APIs in general (3 postings), AI-assisted development tools (3), software design (3), cloud in general, databases in general, text-to-speech, GCC, prototyping and multimodal models.

Nothing was changed in response to these results. The instructions to Claude, the matcher and the skill list are the same ones that produced the synthetic numbers.

## Review status of the synthetic answer key

Hand-checked: the project owner confirmed this on 2026-11-10, after the two earlier passes below.

1. On 2026-11-10 the model that wrote the key re-read all 30 postings and changed nothing. This is weak evidence because it is the same author.
2. The same day a second reviewer, supplied by the owner and working without the skill list, proposed changes to nine postings. Two were applied, because they follow the sheet's own rule that a skill the company merely says it uses does not count:
   - **s14**: Python removed ("Python is our main language").
   - **s16**: C and Rust removed ("We write mostly in C and Rust").

   The other seven were checked against the skill list and left alone: our list groups containers under Docker, Unix under Linux, version control under Git, automated tests under Unit testing, Spring under Spring Boot, and Jest with Vitest; Oracle and Figma are not on the list. For s15 the reviewer suggested rewording the posting to name SQL; the text was left as it is, because rewriting a test posting after seeing the results is the kind of change this test avoids.

Both changes lowered the scores of both extractors (the key went from 141 to 138 skills). Three entries were flagged as judgment calls and stand as written:

- **s14**: the title is "ML Engineer Intern" but the key does not include Machine learning, because the body never asks for it. The matcher reports it and is marked wrong.
- **s15**: "summarise a dataset and say how confident you are in an estimate" is keyed as Statistics. Claude answered Data analysis instead, which is arguably also right.
- **s30**: "reading other people's code to find flaws before it ships" is keyed as Code review (preferred). It could be read as part of Application security, which is already in the key.

## Read these limits before quoting the numbers

1. **The test was written by an AI.** The 30 postings and their answer key were drafted by Claude (a larger model than the one being tested). A model grading its own family's homework is likely to score too well, because they share the same idea of what "asks for a skill" means. The owner has since hand-checked the key (see "Review status" above), which makes the key defensible. It does not remove this bias: the postings themselves are still AI-written.
2. **The postings are short and clean.** Real postings are longer and messier. Expect both extractors to do worse on them. Real postings can be added privately (below).
3. **It is a small test.** With 138 skills, one mistake moves a score by about 0.7 points, and "96% of described skills" means 27 of 28. Treat a one or two point gap as no gap.
4. **The matcher was not tuned to this test.** The numbers are from the first run. The mistakes file shows fixable gaps (for example it misses "A/B tests" because only "A/B testing" is listed). Fixing those and re-running on the same postings would make the matcher look better than it is on new text, so fixes should be judged on postings it has not seen.
5. **"Described" postings were written to be hard for a dictionary.** The 0% is by construction: those skills never appear by name. It shows what kind of skill the matcher cannot find, not how often that happens in real postings.

## What the test did show

- The matcher is reliable when a skill is named and the wording is plain (98% F1 on the "named" and "levels" groups).
- The matcher is fooled by context: it reports a skill the posting says is *not* needed, or one that only the company uses (14 wrong reports: thirteen where the context says the skill is not being asked for, and one taken from a job title).
- Claude follows the instructions about context in most cases. Its four wrong reports at low effort: two languages the team says it uses (the same trap the matcher falls into), one arguable swap, and one real error where it read "You react quickly" as the React library.
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
