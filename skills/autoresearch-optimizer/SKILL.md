---
name: autoresearch-optimizer
description: Autonomous experiment loop that turns Hubsy into a self-improving researcher. Given a target asset or prompt and an evaluation metric, form a hypothesis, modify the asset, run the metric, and keep the change only if the score improves — or revert if it is worse. Modeled on karpathy/autoresearch, which runs autonomous overnight LLM-training research by letting an agent edit train.py against a fixed val_bpb evaluator while a program.md direction file steers the loop. Use whenever the user wants to autonomously optimize something iteratively — "experiment overnight", "autoresearch", "run experiments on this", "optimize this prompt automatically", "keep iterating until it's better", "benchmark my changes", A/B an approach, or tune a prompt/config/code asset against a numeric score. Trigger keywords: autoresearch, experiment loop, optimize iteratively, hypothesis, evaluation metric, revert if worse, program.md.
---

# AutoResearch Optimizer

You run the AutoResearch experiment loop: an autonomous, hypothesis-driven
cycle that improves a **target asset** (a prompt, config, code, or other
modifiable artifact) against a fixed **evaluation metric**, keeping only the
changes that measurably help.

The pattern is lifted from karpathy/autoresearch — an agent that edits the
training code `train.py` of a small LLM, trains for a fixed 5-minute budget,
checks `val_bpb` (validation bits per byte, lower is better), keeps the
change if the score improved, and git-resets if it did not. The loop runs
autonomously overnight, ~12 experiments/hour, logging results as it goes.

The skill generalizes that loop beyond training code: the same contract
applies to prompts, system instructions, and any settable/scoreable asset.

## The AutoResearch loop

Repeat the cycle until stopped. Never stop to ask permission once a run has
begun.

1. **(a) Form a hypothesis.** State one concrete, testable idea before
   touching anything. Write it down in the run log. A hypothesis names the
   change *and* the predicted direction of the metric ("Removing the
   jargon-avoidance clause should lower rejection rate"). One idea per
   experiment — changing two things at once makes attribution impossible.
2. **(b) Modify the target asset.** Edit only the agent-modifiable asset
   (see the 3-file contract in `references/loop-architecture.md`). Everything
   in scope is fair game: for a training repo that is architecture,
   optimizer, hyperparameters, batch size; for a prompt, that is wording,
   ordering, examples, and constraints. Never touch the immutable evaluator
   or the data pipeline.
3. **(c) Run the evaluation metric.** Execute the fixed evaluator and record
   the raw score. The first run of any session must always be the **baseline**
   (run the asset unchanged) so every later delta is meaningful.
4. **(d) Keep or revert.** If the score improved (direction depends on the
   metric: lower `val_bpb`/loss/latency/error-rate is better; higher
   accuracy/relevance/reward is better), **advance** and keep the change. If
   it is equal or worse, **revert** to the previous state. Log the outcome
   either way.

### Loop mechanics

- **Isolation**: work on a dedicated branch (autoresearch's convention is
  `autoresearch/<tag>`, e.g. `autoresearch/mar5`) so each experiment is a
  clean git commit you can advance or reset.
- **Commit per experiment**: after modifying the asset, git commit, then run
  the evaluator against that commit. Keep = keep the commit; revert = `git
  reset` back to the start of the experiment.
- **Fixed budget**: keep run duration constant across experiments so results
  are comparable (autoresearch uses a 5-minute wall-clock budget regardless
  of the change).
- **Crash handling**: a crash is an outcome, not a mystery. Read the trace,
  fix dumb errors (typo, missing import) and re-run; if the idea itself is
  broken, log `crash` and move on.
- **Never stop**: once the loop begins, do not pause to ask the user whether
  you should continue. If you run out of ideas, re-read the in-scope files,
  combine near-misses, and try more radical variants. The loop ends only
  when the user interrupts.

## Logging results

Keep a run log (autoresearch uses a tab-separated `results.tsv`) with one row
per experiment:

```
commit  score  memory  status       description
a1b2c3d 0.9979 0.0     baseline     unchanged code, establish baseline
b2c3d4e 0.9932 0.0     keep         raise LR 0.03 -> 0.04
c3d4e5f 1.0050 0.0     discard      switch to GeLU activation
d4e5f6g 0.0000 0.0     crash        double model width (OOM)
```

- `status`: `keep`, `discard`, or `crash`.
- Crashes log score `0.000000` so the row is unambiguous.
- Commit the asset changes, not the log file, so the history stays replayable.

## Scoring disciplines

- **Baseline first**: never evaluate a change against nothing. The first row
  of any session is the baseline.
- **One variable at a time**: splitting a bundle of edits into separate
  experiments isolates causal credit.
- **Fixed budget, fixed data**: a metric is only comparable if the run cost
  and evaluation set are identical across experiments.
- **Simplicity criterion**: all else being equal, simpler is better. A tiny
  gain bought with ugly complexity is not worth it; a tiny gain earned by
  deleting code definitely is. Weigh complexity cost against improvement
  magnitude before keeping.

## Applying to prompts

The same loop applies when the target asset is a prompt or system
instructions:

1. Hypothesis: "Adding an explicit output-schema line should raise JSON
   parse rate."
2. Edit the prompt in the agent-modifiable asset file.
3. Run a deterministic scorer over a fixed eval set (same inputs, same
   rubric) and record the score.
4. Keep if improved, revert (restore previous prompt text) if worse. Log the
   delta.

## The three-file contract

AutoResearch works because three concerns are separated into three files —
an **immutable evaluator**, an **agent-modifiable asset**, and a **direction
file**. Where each lives, what it may touch, and how the loop reads them is
specified in `references/loop-architecture.md`. Read that file before
setting up a new research repo.