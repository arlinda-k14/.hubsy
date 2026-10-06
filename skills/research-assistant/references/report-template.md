# Report template

Save as `research/YYYY-MM-DD-<topic-slug>.md`.

```markdown
# Research: <topic title>

> **Run:** YYYY-MM-DD · **Focus:** <focus> · **Region:** <region> · **Program:** <all | track>
> **Depth:** <quick | deep> · **Status:** <complete | partial — reason | no live sources>

## Summary

- <bullet 1>
- <bullet 2>
- <bullet 3>
- <bullet 4>            <!-- 3 to 5 bullets -->

## Findings

### F1. <finding statement>
- **Confidence:** High | Medium | Low
- <supporting detail, cross-reference notes>
- Source: [<exact title>](URL) — <publication date>

### F2. ...
<!-- one block per finding; every claim carries an inline citation -->

## Hype and Unverified Claims

- **[VENDOR CLAIM / UNVERIFIED]** <claim> — <why it is flagged, who benefits> —
  Source: [<title>](URL)

## Implications for Creative Hub Kosovo Programs

| Finding | Affected program(s) | What it means | Suggested action |
|---------|--------------------|---------------|------------------|
| F1      | Cloud, Data Engineering | ... | ... |

## Data Gaps

- <missing topic / region / internal document — state it is missing, never estimate>
- Internal index: <matched N chunks | no matching docs | index not built>

## Sources

1. [<exact title>](URL) — <publisher> — <YYYY-MM-DD or "date not stated">
2. ...
<!-- every URL here was actually retrieved this run; mark "not retrieved" if only seen
     in a snippet and never use it to support a claim -->
```

Rules while filling the template:

- Section order is fixed; sections with no content still appear (write "None found").
- Placement data appears only as aggregates (counts, rates, medians).
- If web search failed, the header Status line says `no live sources` and Sources lists
  only internal documents.
