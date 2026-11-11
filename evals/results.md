# Accuracy results

Generated 2026-11-11 by `node evals/run.mjs --claude`. Model `claude-haiku-5-5`, instructions version `fc22de2f0248`, taxonomy `0.2.0`.

- **Precision**: of the skills reported, how many were right.
- **Recall**: of the skills in the answer key, how many were found.
- **F1**: one number that is high only when precision and recall both are.
- **Described recall**: recall on skills that are described in the text without being named.
- **Level**: of the skills found correctly, how many also had required/preferred right.

## synthetic (30 postings)

| Extractor | Precision | Recall | F1 | Described recall | Level | Perfect postings | Found | Missed | Extra |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Free matcher | 89% | 78% | 83% | 0% | 100% | 13 of 30 | 108 | 30 | 14 |
| Claude, low effort | 97% | 99% | 98% | 96% | 100% | 26 of 30 | 137 | 1 | 4 |
| Claude, medium effort | 97% | 99% | 98% | 92% | 100% | 26 of 30 | 136 | 2 | 4 |

F1 by kind of posting:

| Kind | Postings | Free matcher | Claude, low effort | Claude, medium effort |
| --- | --- | --- | --- | --- |
| named | 8 | 98% | 100% | 100% |
| described | 9 | 37% | 94% | 92% |
| misleading | 6 | 69% | 97% | 100% |
| levels | 5 | 98% | 100% | 100% |
| nothing | 2 | 0 extra | 0 extra | 0 extra |

## real (13 postings)

| Extractor | Precision | Recall | F1 | Described recall | Level | Perfect postings | Found | Missed | Extra |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Free matcher | 73% | 97% | 83% | n/a | 92% | 4 of 13 | 62 | 2 | 23 |
| Claude, low effort | 57% | 100% | 73% | n/a | 98% | 2 of 13 | 64 | 0 | 48 |
| Claude, medium effort | 64% | 100% | 78% | n/a | 98% | 1 of 13 | 64 | 0 | 36 |

Claude quotes thrown away for not matching the text word for word: 0.
