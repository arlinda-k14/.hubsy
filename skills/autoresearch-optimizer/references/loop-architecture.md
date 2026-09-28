# Loop Architecture — The Three-File Contract

Reference for the AutoResearch experiment-loop pattern (modeled on
karpathy/autoresearch, https://github.com/karpathy/autoresearch). The loop
stays controllable because a research setup is split into exactly **three
files** with strict, non-overlapping responsibilities:

| File | Purpose | Who edits it |
|------|---------|--------------|
| Evaluator (e.g. `prepare.py`) | Fixed constants, data prep, and the ground-truth metric | **Nobody** — immutable |
| Modifiable asset (e.g. `train.py`) | The artifact the agent optimizes | **The agent** (per experiment) |
| Direction file (`program.md`) | Instructions, goals, and loop rules | **The human** (and the agent for the run itself) |

In autoresearch the three files are literally `prepare.py`, `train.py`, and
`program.md`. The user-facing prompt is just: "have a look at program.md and
let's kick off a new experiment."

## Responsibilities per file

### 1. Immutable evaluator

- Holds the fixed constants (in autoresearch: time budget, sequence length,
  vocabulary size) and the one-time data/tokenizer preparation.
- Defines the **ground-truth metric**. In autoresearch this is
  `evaluate_bpb` returning **`val_bpb`** — validation bits per byte. It is
  vocabulary-size-independent, so architectural changes are compared fairly,
  and **lower is better**.
- Provides runtime utilities (dataloader, evaluation) that the asset calls.
- **Contract**: this file is read-only. The agent never edits it. Faith to
  the metric is what makes experiments comparable and trustworthy — if the
  evaluator can be gamed or changed, the loop is meaningless. "Modify the
  evaluation harness" is an explicit forbidden action in the direction file.

### 2. Agent-modifiable asset

- The single file the agent edits. In autoresearch: `train.py`, containing
  the model, optimizer, and training loop.
- Everything in scope is fair game: architecture, hyperparameters, batch
  size, optimizer, order of operations — for a prompt-based setup, wording,
  structure, examples, and constraints.
- **Contract**: the agent may edit *only* this file, may use only already-
  available dependencies, and must keep the run finishing within the fixed
  time budget. Keeping the asset to one file keeps diffs reviewable and
  scope sane.
- The asset reports its result at the end of a run in a fixed, parseable
  summary block (autoresearch prints `val_bpb`, `training_seconds`,
  `peak_vram_mb`, `total_tokens_M`, etc.).

### 3. Direction file (`program.md`)

- The human's control surface — a lightweight skill. It wires the other two
  files together and sets the rules of engagement for the agent.
- In autoresearch, `program.md` defines: the setup procedure (run tag,
  branch creation `autoresearch/<tag>`, reading in-scope files, verifying
  data shards, initializing `results.tsv`), what the agent CAN and CANNOT do
  (edit `train.py` only; never `prepare.py`; never add packages), the metric
  (lowest `val_bpb`), the experiment loop with its git workflow, output
  parsing via `grep`, result logging, timeout (`>10 min` = kill and discard),
  crash policy, and the "NEVER STOP" autonomy rule.
- **Contract**: the human iterates on the *content* of `program.md` over
  time to improve the research org; the agent executes it. The agent commits
  asset changes per experiment but does not commit the results log.

## The loop mapped onto the contract

```
                +----------------------------+
                |   program.md (direction)   |  -> agent's instructions
                +------------+---------------+
                             v
   (a) hypothesis  ->  (b) edit train.py      <-  only this file, one idea
                             |
                             v
   (c) run: uv run train.py > run.log 2>&1    <-  fixed 5-min budget
                             |
                             v
   (d) grep "^val_bpb:" run.log  ->  compare to baseline
                     |                 |
              score improved          equal or worse
                     |                 |
                keep commit        git reset (revert)
                     |                 |
                     +---> log to results.tsv (untracked) -> repeat
```

## Why three files

- **Trust**: a frozen evaluator means a better score truly reflects a better
  asset, not a rigged test.
- **Bounded scope**: one editable file keeps experiments small, diffs
  reviewable, and crashes attributable.
- **Steering without code**: the human tunes the research strategy by editing
  prose in `program.md`, never by touching the Python; the agent tunes the
  asset by code, never the rules.

## Applying the contract outside LLM training

The same three-file separation generalizes to any optimization target. For a
prompt-optimization setup:

- **Evaluator**: a deterministic scoring script (fixed eval inputs + rubric)
  that emits a numeric score.
- **Modifiable asset**: the prompt file the agent rewrites per hypothesis.
- **Direction file**: `program.md` describing the goal, allowed prompt
  edits, how to run the scorer, and the keep/revert rule.

Whatever the asset, the contract survives: evaluator immutable, one asset
editable, one prose file steering the loop.