# Internal documents (read-only)

Source documents for the `research-assistant` skill. **Nothing in this directory is ever
modified by the skill** — files are opened for reading only.

## Structure

| Folder | Expected contents | Accepted formats |
|---|---|---|
| `syllabi/` | Course syllabi — at minimum the Data Science, Cloud, and Vibe Coding tracks | `.md`, `.txt`, `.csv`, `.json` |
| `placements/` | Student placement records | `.csv` (column-whitelisted, see below) |
| `employer-feedback/` | Partner employer feedback | `.md`, `.txt` |

PDFs are not supported by the indexer (no external dependencies). Export to `.md`/`.txt` first.

## Placement CSV column whitelist

`scripts/index_docs.py` keeps **only** these columns and discards every other column at index
time (names, emails, phone numbers, IDs — never indexed, never quoted):

```
program, completion_date, placement_outcome, employer_sector, role_title, months_to_placement
```

Accepted `placement_outcome` values for aggregation: `placed` / `yes` / `true` / `1` /
`employed` count as placed. Email- and phone-like strings are redacted from all indexed text
as a second line of defence.

Placement data is reported **in aggregate only** (counts, rates, medians) via
`scripts/query_index.py --placement-summary`.

## Additional repositories

There are no other indexed repositories yet. If more internal databases or document stores
should be included, add them to
`~/.hubsy/skills/research-assistant/config/sources.json` → `internal_repositories`
(the `TODO` entry is a placeholder — do not invent paths).

## Rebuilding the index

```
python3 ~/.hubsy/skills/research-assistant/scripts/index_docs.py
```
