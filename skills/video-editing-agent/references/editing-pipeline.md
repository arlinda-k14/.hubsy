# Video Editing Pipeline — Reference

Architecture, ffmpeg rendering rules, and sub-agent animation generation
for Hubsy's video-editing agent, adapted from browser-use/video-use.

## Transcript-based editing architecture

The editor never watches the video. It reads two derived layers:

**Layer 1 — Audio transcript (always loaded).** One Scribe call per
source yields word-level timestamps, speaker diarization, and audio
events (`(laughs)`, `(applause)`, `(sighs)`). Transcripts are cached per
source and never re-transcribed unless the source file changes.

- `transcribe.py <video>` — single-file Scribe call, optional
  `--num-speakers N`.
- `transcribe_batch.py <videos_dir>` — 4-worker parallel transcription
  for multi-take material.
- `pack_transcripts.py` — folds every `transcripts/<name>.json` into one
  `takes_packed.md`. Each take becomes phrase-level lines prefixed with
  `[start-end]` ranges; phrases break on silence ≥ 0.5s or a speaker
  change. This is the editor's primary reading view — word-boundary
  precision from text at ~1/10 the tokens of raw JSON.

**Layer 2 — Visual composite (on demand).** `timeline_view.py <video>
<start> <end>` renders a filmstrip + waveform + word-labels PNG. It is a
drill-down tool for decision points, not a scan tool: ambiguous pauses,
retake comparisons, cut-point sanity checks, and grade reads.

**The cut-decision artifact is the EDL.** `edl.json` carries the source
map (`sources`), the chosen `ranges` (each with source, start/end,
optional beat label, quoted words, and a reason), the `grade` preset,
`overlays`, `subtitles`, and `total_duration_s`. The editor sub-agent
emits exactly this JSON array with no prose.

## ffmpeg rendering rules

`render.py <edl.json> -o <out>` runs the compose step. The rules below
are production correctness, not taste — each one fixes a silent failure
mode. Deviating breaks the output.

1. **Subtitles applied LAST in the filter chain**, after every overlay.
   Otherwise overlays physically hide the captions.
2. **Per-segment extract → lossless `-c copy` concat**, never a
   single-pass filtergraph for the whole edit. A single pass
   double-encodes every segment once overlays and grades are added.
   Grades apply per segment during extraction, not post-concat.
3. **30ms audio fades at every segment boundary**:
   `afade=t=in:st=0:d=0.03,afade=t=out:st={dur-0.03}:d=0.03`. Otherwise
   you hear an audible pop at each cut.
4. **Overlays use `setpts=PTS-STARTPTS+T/TB`** to shift the overlay's
   frame zero to its window start. Without it you see the middle of the
   animation during the overlay's window.
5. **Master SRT uses output-timeline offsets**:
   `output_time = word.start - segment_start + segment_offset`.
   Otherwise captions misalign after segments are concatenated.
6. **Never cut inside a word** — snap every cut edge to a word boundary
   from the Scribe transcript.
7. **Pad every cut edge** to the 30-200ms working window. Scribe
   timestamps drift 50-100ms; padding absorbs it.
8. **Word-level verbatim ASR only.** Never SRT/phrase mode (that loses
   sub-second gap data) and never normalized fillers (that loses the
   editorial signal for cutting them).
9. **Cache transcripts per source**; re-transcription is forbidden for
   unchanged sources.
10. **Verify duration with `ffprobe`** against the EDL expectation after
    every render.

Also from the render path: use `--preview` for a fast 720p pass,
`--build-subtitles` to generate `master.srt` inline, and `render.py`
defaults to scaling any source to 1080p (override with `--filter` or a
custom extract command). Master audio is mixed to PCM then normalized
with two-pass loudnorm (-14 LUFS, true peak ≤ -1 dBTP).

**Anti-patterns that fail even when they look fine:**

- Hierarchical pre-computed codec formats with usability/shot layers —
  over-engineering; derive from the transcript at decision time.
- Hand-tuned moment-scoring functions — the LLM picks better than any
  heuristic you write.
- Whisper SRT/phrase output or local CPU Whisper — loses gap data and
  normalizes fillers.
- Burning subtitles into the base before compositing overlays.
- Single-pass filtergraph when overlays exist.
- Linear easing — always cubic.
- Unverified web fonts (falls back silently to a system face).
- Stock SFX on every transition — tie effects to visible events.
- Hard audio cuts at segment boundaries.
- Sequential sub-agents for multiple animations — always parallel.

## Sub-agent animation generation

Each animation slot is one dedicated sub-agent spawned via the `Agent`
tool so the whole set renders in parallel (wall time ≈ the slowest one).
Sub-agents have no parent context, so every prompt is self-contained and
ends with instructions to pick the most obvious interpretation and
proceed rather than ask questions.

**Per-slot workflow.** Create `edit/animations/slot_<id>/`, build inside
it, output a `render.mp4` (or `render.webm` when alpha is required), and
point the EDL overlay `file` at the real rendered path.

**Engine choice is per slot — never a default:**

- **HyperFrames** (`npx --yes hyperframes ...`) — HTML/CSS/GSAP
  compositions: product UI motion, kinetic typography, website-to-video
  captures, transparent WebM overlays. Author and verify like a web
  composition (lint, validate, draft render).
- **Remotion** — React/CSS compositions when component state or an
  existing React ecosystem fits.
- **Manim** — formal diagrams, state machines, equation derivations
  (reuse the vendored manim skill's references).
- **PIL + PNG sequence + ffmpeg** — simple overlay cards: counters,
  typewriter text, single bar reveals, progressive draws. Fast to
  iterate, any aesthetic.

**Every sub-agent prompt must include:** a one-sentence goal; the
absolute output path; the exact technical spec (resolution, fps, codec,
pix_fmt, CRF, duration); palette as concrete values (RGB tuples or hex);
the font path with index; a frame-by-frame timeline with easing; an
anti-list ("no chrome, no extras"); a code-pattern reference (copy
helpers inline, never import across slots); a deliverable checklist
(script, render, verify via ffprobe, report). One sub-agent = one file,
so parallel agents never overwrite each other.

**Animation timing and motion rules:**

- Sync-to-narration: floor ~3s, typically 5-7s for simple cards,
  8-14s for complex diagrams (readable at 1×). Beat-synced accents in
  music/fast montage: 0.5-2s is fine.
- Hold the final frame ≥ 1s before the cut (universal).
- Over voiceover: total duration ≥ narration length + 1s.
- Never parallel-reveal independent elements — the eye cannot track two
  arrivals at once.
- Payoff timing: start the overlay `reveal_duration` before the payoff
  word's timestamp so the landing frame coincides with the spoken word.
- Easing is always cubic — `ease_out_cubic` for single reveals (slow
  landing), `ease_in_out_cubic` for continuous draws.
- Typing-text anchors center on the FULL string's width, not the
  partial string — otherwise the text slides left while revealing.
- Fonts fail silently: in web compositions, await then assert
  `document.fonts.check(...)`; in PIL pass an explicit font path, never
  the default.

**Example palette (one aesthetic among infinite):** near-black `(10, 10,
10)` background, orange `#FF5A00` accent, dim-gray `(110, 110, 110)`
labels, Menlo Bold, ≤ 2 accent colors, ~40% empty space. If the user
handed you a style guide, follow it; otherwise propose a palette in the
strategy phase and wait for confirmation.