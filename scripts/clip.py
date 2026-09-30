#!/usr/bin/env python3
"""ViralClipAI — transcript-driven short-form clip blueprint generator and cutter.

Implements the five-part system prompt in .agent/skills/clipper.md:

  Role          Short-form video strategist for TikTok / Shorts / Reels.
  Job           Find the top 3 viral-worthy segments, timestamp them, score them,
                caption them, and propose a visual hook for each.
  Output        Exactly the structure defined in Part 3 of the skill file.
  Constraints   15-60s hard length band, no fabricated dialogue, timestamps snapped
                to real transcript cue boundaries only.
  Refusal       One exact sentence, emitted verbatim on unusable input.

Scoring rubric (composite, 0.0-1.0, all signals weighted against the Part 2 brief):

  hook        .28   curiosity gap, direct address, number-lead, contrarian openers
  emotion     .18   stakes language, first-person regret, superlatives, contrast
  tactical    .18   imperative verbs, named frameworks, step/avoid/instead-of cues
  surprise    .14   statistics, "nobody/actually/turns out", named mistakes
  open        .08   window starts on a real sentence boundary
  close       .10   window ends on a real sentence boundary
  complete    .04   at least one full sentence inside the window

The composite is then shaped by a retention length curve (peaks near 32s, falls off
toward both hard bounds) and squashed to 1-100 with an absolute exponent so a weak
transcript scores weak. Selection is greedy by score with a 2s no-overlap buffer, so
the three clips never overlap.

Usage
  python3 scripts/clip.py <youtube-url> [options]
  python3 scripts/clip.py --transcript talk.txt --format json
  python3 scripts/clip.py <youtube-url> --vertical --platform reels

Options
  --url U              YouTube URL or bare video id.
  --transcript PATH    Timestamped transcript file (.txt/.srt/.vtt) instead of a URL.
  --out DIR            Output directory (default: clips/).
  --video PATH         Cut a local video file instead of downloading one.
  --no-cut             Produce blueprints only, skip download and ffmpeg.
  --vertical           Crop each clip to 9:16 for Shorts / Reels / TikTok.
  --platform NAME      shorts | reels | tiktok — picks the platform hashtag.
  --format FMT         text (Part 3 verbatim) | json | md  (default: text).
  --ffmpeg PATH        Override the ffmpeg binary (default: ~/bin/ffmpeg).
  --keep-source        Keep the downloaded source video after cutting.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from collections import Counter

CLIP_MIN = 15
CLIP_MAX = 60
CLIP_COUNT = 3
CLIP_TARGET = 32
SENTENCE_GAP = 0.45
OVERLAP_BUFFER = 2.0

REFUSAL = (
    "Unable to process request: Please provide a valid video URL with an available "
    "transcript or paste a text transcript to generate clip blueprints."
)

HOOK_MARKERS = {
    "nobody tells you": 3.0, "nobody talks about": 3.0, "nobody ever": 2.6,
    "the truth about": 3.0, "the reality is": 2.6, "the real reason": 3.0,
    "the biggest mistake": 3.0, "the worst mistake": 2.8, "the only mistake": 2.8,
    "what nobody": 2.8, "here's why": 2.4, "here's what": 2.2, "here is why": 2.4,
    "let me tell you": 2.2, "i was wrong": 2.8, "i got it wrong": 2.8,
    "the secret": 2.6, "the trick": 2.0, "the difference between": 2.0,
    "turns out": 2.4, "counterintuitive": 2.8, "surprising": 2.4,
    "most people": 2.0, "almost everyone": 2.2, "everyone thinks": 2.4,
    "the problem is": 2.0, "the issue is": 2.0, "the hard part": 2.0,
    "what changed": 2.2, "what i learned": 2.4, "the moment": 1.8,
    "this is why": 2.6, "which is why": 2.2, "that's why": 2.0,
    "stop doing": 2.8, "stop saying": 2.4, "never do": 2.4, "don't": 1.0,
    "you need to": 1.6, "you have to": 1.4, "imagine": 1.6, "picture this": 2.0,
    "think about": 1.2, "the question is": 1.8, "ask yourself": 1.8,
    "i learned": 1.8, "i realized": 1.8, "i didn't realize": 2.2,
    "for years": 1.4, "at first": 1.0, "and then": 1.0, "but here's": 2.4,
    "watch what": 2.0, "look at": 1.2, "listen": 0.8, "attention": 1.4,
}

EMOTION_MARKERS = {
    "i failed": 2.8, "we failed": 2.6, "it broke": 2.2, "everything changed": 2.8,
    "changed everything": 3.0, "changed my life": 3.0, "ruined": 2.4,
    "scared": 2.4, "afraid": 2.2, "terrified": 2.6, "exhausted": 2.0,
    "burned out": 2.6, "burnt out": 2.6, "losing": 2.0, "lost everything": 3.0,
    "the worst": 2.2, "the best": 1.8, "huge": 1.6, "massive": 1.6,
    "brutal": 2.2, "painful": 2.4, "honest": 1.6, "truth": 1.8,
    "my fault": 2.4, "the hard way": 2.2, "cost me": 2.4, "almost lost": 2.6,
    "never forget": 2.2, "still think about": 2.0, "kept me up": 2.2,
}

TACTICAL_MARKERS = {
    "the first step": 2.8, "step one": 2.6, "first thing": 2.0,
    "the process": 1.8, "the framework": 2.2, "the system": 1.6,
    "the checklist": 2.4, "the rule": 2.0, "in order to": 1.4,
    "instead of": 2.0, "rather than": 1.6, "you should": 1.4,
    "make sure": 1.8, "start with": 1.8, "focus on": 1.6, "avoid": 1.6,
    "measure": 1.8, "track": 1.6, "test": 1.4, "double down": 2.0,
    "what i do": 2.0, "what worked": 2.0, "the trick is": 2.4,
    "three things": 2.4, "two things": 2.0, "one thing": 1.8,
    "the habit": 2.0, "every day": 1.6, "consistency": 1.8, "practice": 1.4,
}

SURPRISE_MARKERS = {
    "turns out": 2.6, "actually": 1.6, "surprising": 2.4, "counterintuitive": 2.8,
    "nobody": 1.8, "no one": 1.6, "secret": 2.2, "hidden": 2.0,
    "mistake": 2.0, "mistakes": 1.8, "wrong": 1.8, "overlooked": 2.2,
    "i was wrong": 2.8, "surprise": 2.0, "myth": 2.4, "false": 1.8,
}

FILLER = {"um", "uh", "erm", "hmm", "mm", "uhh", "umm", "like", "basically", "literally"}

NON_SPEECH = {
    "music", "applause", "laughter", "laughing", "laughs", "singing", "sing",
    "cheering", "cheers", "instrumental", "background", "silence", "chorus",
    "intro", "outro", "oh", "ooh", "ah", "hey", "whoa", "subscribe",
}

SMALL_WORDS = {
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "of", "on",
    "or", "the", "to", "up", "with", "that", "this", "than", "then", "so", "if",
}

DANGLE = {
    "a", "an", "and", "or", "but", "so", "because", "that", "which", "who", "when",
    "if", "the", "to", "of", "in", "on", "at", "for", "with", "from", "by", "as",
    "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did",
    "don", "dont", "not", "no", "very", "just", "also", "too", "than", "then",
    "up", "out", "off", "over", "about", "into", "onto", "my", "your", "our",
    "his", "her", "its", "it", "you", "i", "we", "they", "he", "she", "me",
    "us", "them", "this", "these", "those", "there", "here", "have", "has",
    "had", "will", "would", "can", "could", "should", "must", "may", "might",
}

ANNOTATION = re.compile(r"[\u266a\u266b\u266c\U0001f3b5\U0001f3b6]|\[[^\]]*\]")

STOPWORDS = {
    "a", "about", "after", "all", "also", "am", "an", "and", "any", "are", "as", "at",
    "be", "been", "being", "but", "by", "can", "could", "did", "do", "does", "doing",
    "done", "down", "each", "even", "every", "for", "from", "get", "got", "had", "has",
    "have", "he", "her", "here", "hers", "him", "his", "how", "i", "if", "in", "into",
    "is", "it", "its", "just", "know", "let", "like", "me", "more", "most", "my", "no",
    "not", "now", "of", "on", "one", "only", "or", "other", "our", "out", "over", "own",
    "put", "said", "same", "she", "should", "so", "some", "still", "such", "than", "that",
    "the", "their", "them", "then", "there", "these", "they", "thing", "things", "this",
    "those", "through", "to", "too", "up", "very", "was", "we", "well", "were", "what",
    "when", "where", "which", "while", "who", "why", "will", "with", "would", "you",
    "your", "you're", "yours", "going", "gonna", "want", "need", "right", "okay", "yeah",
}

PLATFORM_TAGS = {
    "shorts": "#shorts",
    "reels": "#reels",
    "tiktok": "#tiktok",
    "default": "#shorts",
}

WEIGHTS = {
    "hook": 0.28,
    "emotion": 0.18,
    "tactical": 0.18,
    "surprise": 0.14,
    "open": 0.08,
    "close": 0.10,
    "complete": 0.04,
}

SENTENCE_END = re.compile(r"[.!?…][\"')\]]*$")
LEAD_NUM = re.compile(r"^\s*\d")


def normalise(text):
    stripped = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in stripped if not unicodedata.combining(ch))


def lower(text):
    return normalise(text).lower()


def clean(text):
    return re.sub(r"\s+", " ", normalise(text)).strip()


def speech(text):
    return clean(ANNOTATION.sub(" ", text))


def titlecase(text, max_words=6):
    words = [w for w in re.findall(r"[A-Za-z0-9\u2019']+", text) if w]
    if not words:
        return ""
    words = words[:max_words]
    out = []
    for index, word in enumerate(words):
        low = word.lower().replace("'", "\u2019")
        if index == 0 or index == len(words) - 1 or low not in SMALL_WORDS:
            out.append(low[:1].upper() + low[1:])
        else:
            out.append(low)
    return " ".join(out)


def hhmmss(seconds):
    seconds = max(0.0, float(seconds))
    total = int(round(seconds))
    return "%02d:%02d:%02d" % (total // 3600, (total % 3600) // 60, total % 60)


def slugify(text, fallback="video"):
    slug = re.sub(r"[^a-z0-9]+", "-", lower(text)).strip("-")
    return "-".join([p for p in slug.split("-") if p][:6]) or fallback


def parse_video_id(value):
    if not value:
        return None
    value = value.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        return value
    match = re.search(r"(?:v=|/v/|youtu\.be/|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{11})", value)
    if match:
        return match.group(1)
    match = re.fullmatch(r"([A-Za-z0-9_-]{11})", value)
    return match.group(1) if match else None


def cue_end(cue):
    return cue["start"] + max(cue.get("duration", 0.0), 0.0)


def window_text(cues, start, end):
    return clean(" ".join(c["text"] for c in cues[start:end]))


def is_boundary(cues, index):
    if index <= 0:
        return True
    gap = cues[index]["start"] - cue_end(cues[index - 1])
    if gap >= SENTENCE_GAP:
        return True
    return bool(SENTENCE_END.search(cues[index - 1]["text"].strip()))


MARKER_CACHE = {}


def marker_re(phrase):
    compiled = MARKER_CACHE.get(phrase)
    if compiled is None:
        compiled = re.compile(r"(?<![a-z'])" + re.escape(phrase) + r"(?![a-z'])")
        MARKER_CACHE[phrase] = compiled
    return compiled


def count_markers(text, markers):
    hay = lower(text)
    hits = 0.0
    matched = []
    for phrase, weight in markers.items():
        occurrences = len(marker_re(phrase).findall(hay))
        if occurrences:
            hits += weight * min(occurrences, 3)
            matched.append(phrase)
    return hits, matched


def count_numbers(text):
    return len(re.findall(r"\b\d+(?:[.,]\d+)?\s*(?:%|percent|x|k|m|bn|million|billion)?\b", lower(text)))


def build_cues(entries):
    cues = []
    for text, start, duration in entries:
        text = speech(text)
        if not text:
            continue
        cues.append({"text": text, "start": float(start), "duration": max(float(duration), 0.0)})
    return cues


def fetch_transcript_from_url(url, stderr):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        stderr.write("youtube-transcript-api is not installed. Run: python3 -m pip install --user youtube-transcript-api\n")
        return None, None

    video_id = parse_video_id(url)
    if not video_id:
        stderr.write("Could not parse a YouTube video id from: %s\n" % url)
        return None, None

    api = YouTubeTranscriptApi()
    transcript = None
    for attempt in (api.fetch,):
        try:
            transcript = attempt(video_id)
            break
        except TypeError:
            try:
                transcript = api.get_transcript(video_id)
                break
            except Exception as exc:
                stderr.write("Transcript request failed: %s\n" % exc)
                return None, video_id
        except Exception as exc:
            stderr.write("Transcript request failed: %s\n" % exc)
            return None, video_id

    if transcript is None:
        return None, video_id

    snippets = getattr(transcript, "snippets", None)
    if snippets is None:
        snippets = list(transcript)

    entries = []
    for snippet in snippets:
        start = getattr(snippet, "start", None)
        if start is None and isinstance(snippet, dict):
            start = snippet.get("start", 0.0)
        duration = getattr(snippet, "duration", None)
        if duration is None and isinstance(snippet, dict):
            duration = snippet.get("duration", 0.0)
        text = getattr(snippet, "text", None)
        if text is None and isinstance(snippet, dict):
            text = snippet.get("text", "")
        entries.append((text or "", float(start or 0.0), float(duration or 0.0)))

    title = fetch_title(video_id, stderr)
    return build_cues(entries), (video_id, title)


def fetch_title(video_id, stderr):
    binary = resolve_binary("yt-dlp")
    if not binary:
        return None
    try:
        out = subprocess.run(
            [binary, "--skip-download", "--no-warnings", "--print", "%(title)s", "https://www.youtube.com/watch?v=%s" % video_id],
            capture_output=True, text=True, timeout=90, env=child_env(),
        )
        title = clean(out.stdout.splitlines()[0]) if out.stdout.strip() else ""
        return title or None
    except Exception as exc:
        stderr.write("Title lookup failed: %s\n" % exc)
        return None


def parse_transcript_file(path, stderr):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            raw = handle.read()
    except Exception as exc:
        stderr.write("Could not read transcript file: %s\n" % exc)
        return None

    raw = re.sub(r"^WEBVTT.*$", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"^\d+\s*$", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"^(NOTE|STYLE|REGION).*$", "", raw, flags=re.MULTILINE)
    lines = raw.splitlines()

    stamp = re.compile(
        r"(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})"
    )
    short_stamp = re.compile(r"\[(\d{1,2}):(\d{2})\]")
    line_stamp = re.compile(r"^\s*\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?[\s:-]*(.*)$")
    yt_stamp = re.compile(r"^\s*\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*$")
    yt_span = re.compile(
        r"^\s*\[?(?:(\d{1,2})\s*(?:hours?|h)\s*[,]?\s*)?"
        r"(?:(\d{1,2})\s*(?:minutes?|m)\s*[,]?\s*)?"
        r"(?:(\d{1,2})\s*)?(?:seconds?|secs?|s)\]?\s*$",
        re.IGNORECASE,
    )

    cues = []
    i = 0
    while i < len(lines):
        line = lines[i]
        match = stamp.search(line)
        if match:
            start = int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3))
            end = int(match.group(5)) * 3600 + int(match.group(6)) * 60 + int(match.group(7))
            i += 1
            text_parts = []
            while i < len(lines) and lines[i].strip() and not stamp.search(lines[i]):
                text_parts.append(lines[i])
                i += 1
            text = speech(" ".join(text_parts))
            if text:
                cues.append({"text": text, "start": float(start), "duration": max(float(end - start), 0.0)})
            continue
        inline = short_stamp.findall(line)
        if inline:
            for occurrence in re.finditer(r"\[(\d{1,2}):(\d{2})\]", line):
                text = speech(line[occurrence.end():])
                if text:
                    start = int(occurrence.group(1)) * 60 + int(occurrence.group(2))
                    cues.append({"text": text, "start": float(start), "duration": 0.0})
            i += 1
            continue
        yt_match = yt_stamp.match(line)
        if yt_match and i + 1 < len(lines) and yt_span.match(lines[i + 1]):
            if yt_match.group(3) is None:
                start = int(yt_match.group(1)) * 60 + int(yt_match.group(2))
            else:
                start = int(yt_match.group(1)) * 3600 + int(yt_match.group(2)) * 60 + int(yt_match.group(3))
            i += 2
            text_parts = []
            while i < len(lines) and lines[i].strip() and not yt_stamp.match(lines[i]) and not yt_span.match(lines[i]):
                text_parts.append(lines[i])
                i += 1
            text = speech(" ".join(text_parts))
            if text:
                cues.append({"text": text, "start": float(start), "duration": 0.0})
            continue
        prefixed = line_stamp.match(line)
        if prefixed and prefixed.group(4) is not None and prefixed.group(1) and prefixed.group(2):
            start = int(prefixed.group(1)) * 3600 + int(prefixed.group(2)) * 60 + int(prefixed.group(3) or 0)
            text = speech(prefixed.group(4))
            if text:
                cues.append({"text": text, "start": float(start), "duration": 0.0})
        i += 1

    if not cues:
        stderr.write("No usable timestamps found in %s. ViralClipAI needs [MM:SS] or SRT/VTT timings.\n" % path)
        return None

    cues = dedupe_cues(cues, stderr)

    for index in range(1, len(cues)):
        if cues[index]["duration"] == 0.0:
            cues[index]["duration"] = max(cues[index + 1]["start"] - cues[index]["start"] if index + 1 < len(cues) else 2.0, 0.6)
    return cues


def dedupe_cues(cues, stderr):
    if len(cues) < 2:
        return cues

    ordered = sorted(range(len(cues)), key=lambda idx: cues[idx]["start"])
    kept = []
    seen = set()
    for index in ordered:
        cue = cues[index]
        if cue["start"] < 0:
            continue
        key = (round(cue["start"], 2), normalise(cue["text"]).lower())
        if key in seen:
            continue
        seen.add(key)
        kept.append(cue)

    # A transcript pasted more than once restarts its timestamps partway through.
    # Keep only the first full-length pass so scoring does not double-count.
    dropped = 0
    if len(kept) > 1:
        span = kept[-1]["start"] - kept[0]["start"]
        if span > 0:
            midpoint = kept[0]["start"] + span / 2.0
            halfway = [cue for cue in kept if cue["start"] <= midpoint]
            if len(halfway) >= len(kept) / 2.0 and len(halfway) > 1:
                if kept[len(halfway)]["start"] < kept[0]["start"] + span / 4.0:
                    dropped = len(kept) - len(halfway)
                    stderr.write("Transcript looked repeated; kept first pass and dropped %d duplicate cues.\n" % dropped)
                    kept = halfway

    if dropped:
        for cue in kept:
            cue["start"] = max(cue["start"] - kept[0]["start"], 0.0)
    return kept


def length_preference(duration):
    span = max(duration - CLIP_MIN, 0.0)
    peak = (CLIP_TARGET - CLIP_MIN)
    ratio = abs(span - peak) / max(peak, 1.0)
    return max(0.35, 1.0 - 0.62 * ratio)


def score_window(cues, start, end):
    text = window_text(cues, start, end)
    lower_text = lower(text)
    words = [w for w in re.findall(r"[a-z0-9']+", lower_text)]
    if len(words) < 12:
        return None

    duration = cue_end(cues[end - 1]) - cues[start]["start"]
    if duration < CLIP_MIN or duration > CLIP_MAX:
        return None

    seconds = max(duration, 1.0)
    per_minute = lambda value: min(1.0, (value / seconds) * 60.0 / 6.0)

    hook_hits, hook_phrases = count_markers(text, HOOK_MARKERS)
    emotion_hits, emotion_phrases = count_markers(text, EMOTION_MARKERS)
    tactical_hits, tactical_phrases = count_markers(text, TACTICAL_MARKERS)
    surprise_hits, surprise_phrases = count_markers(text, SURPRISE_MARKERS)
    if LEAD_NUM.match(cues[start]["text"]):
        hook_hits += 2.0
    hook_hits += min(count_numbers(text), 4) * 0.9
    surprise_hits += min(count_numbers(text), 3) * 0.5

    filler = sum(1 for w in words if w in FILLER)
    filler_penalty = min(0.35, (filler / max(len(words), 1)) * 1.8)
    density = len(words) / seconds
    density_penalty = 0.0
    if density < 1.2:
        density_penalty += (1.2 - density) * 0.22
    if density > 4.2:
        density_penalty += (density - 4.2) * 0.12

    sentences = [s for s in re.split(r"(?<=[.!?…])\s+", text) if len(s.split()) >= 3]
    complete = 1.0 if sentences else 0.35
    opening = 1.0 if is_boundary(cues, start) else 0.35
    closing = 1.0 if (SENTENCE_END.search(cues[end - 1]["text"].strip()) or
                      (end < len(cues) and cues[end]["start"] - cue_end(cues[end - 1]) >= SENTENCE_GAP)) else 0.45

    composite = (
        WEIGHTS["hook"] * per_minute(hook_hits) +
        WEIGHTS["emotion"] * per_minute(emotion_hits) +
        WEIGHTS["tactical"] * per_minute(tactical_hits) +
        WEIGHTS["surprise"] * per_minute(surprise_hits) +
        WEIGHTS["open"] * opening +
        WEIGHTS["close"] * closing +
        WEIGHTS["complete"] * complete
    )
    composite *= length_preference(duration)
    composite -= filler_penalty + density_penalty
    composite = max(0.0, min(1.0, composite))

    score = 1 + int(round(99 * (composite ** 0.6)))
    return {
        "start_index": start,
        "end_index": end,
        "start": cues[start]["start"],
        "end": cue_end(cues[end - 1]),
        "duration": round(duration, 2),
        "score": max(1, min(100, score)),
        "composite": round(composite, 4),
        "text": text,
        "words": words,
        "signals": {
            "hook": round(per_minute(hook_hits), 3),
            "emotion": round(per_minute(emotion_hits), 3),
            "tactical": round(per_minute(tactical_hits), 3),
            "surprise": round(per_minute(surprise_hits), 3),
            "density": round(density, 2),
        },
        "phrases": {
            "hook": sorted(hook_phrases, key=lambda p: -HOOK_MARKERS[p])[:4],
            "emotion": sorted(emotion_phrases, key=lambda p: -EMOTION_MARKERS[p])[:3],
            "tactical": sorted(tactical_phrases, key=lambda p: -TACTICAL_MARKERS[p])[:3],
            "surprise": sorted(surprise_phrases, key=lambda p: -SURPRISE_MARKERS[p])[:3],
        },
    }


def candidates(cues, stderr):
    found = []
    total = len(cues)
    for start in range(total):
        for end in range(start + 1, total):
            duration = cue_end(cues[end - 1]) - cues[start]["start"]
            if duration < CLIP_MIN:
                continue
            if duration > CLIP_MAX:
                break
            scored = score_window(cues, start, end)
            if scored:
                found.append(scored)
        if total > 400 and start % 200 == 199:
            stderr.write("scanned %d/%d cue positions...\n" % (start, total))
    return found


MIN_SEPARATION = 90.0


def select_clips(found, stderr):
    found.sort(key=lambda item: (-item["score"], item["start"]))
    for separation in (MIN_SEPARATION, MIN_SEPARATION / 2.0, 20.0, OVERLAP_BUFFER):
        chosen = []
        for item in found:
            if len(chosen) >= CLIP_COUNT:
                break
            if any(overlaps(item, picked, separation) for picked in chosen):
                continue
            chosen.append(item)
        if len(chosen) >= CLIP_COUNT or separation <= OVERLAP_BUFFER:
            if len(chosen) < CLIP_COUNT:
                stderr.write("Only %d clip(s) could be spaced apart without repeating the same passage.\n" % len(chosen))
            chosen.sort(key=lambda item: item["start"])
            return chosen
    return chosen


def overlaps(item, picked, separation):
    if item["start"] < picked["end"] + separation and picked["start"] < item["end"] + separation:
        return True
    return False


def keywords(text, limit=8, boost=None, min_count=1):
    counts = Counter()
    for word in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text):
        key = lower(word)
        if key in STOPWORDS or key in FILLER or key in NON_SPEECH or len(key) < 3:
            continue
        counts[word.strip("'-")] += 1
    boost_keys = set(lower(word) for word in (boost or []))
    ranked = sorted(
        counts.items(),
        key=lambda pair: (-(pair[1] + (2.5 if lower(pair[0]) in boost_keys else 0.0)), pair[0].lower()),
    )
    return [word for word, count in ranked[:limit] if count >= min_count]


def bare(word):
    return lower(word).replace("'", "").replace("\u2019", "")


def is_content(word):
    return len(re.sub(r"[^a-z]", "", bare(word))) >= 3 and bare(word) not in DANGLE


def trim_span(words, floor=3):
    changed = True
    while changed and len(words) > floor:
        changed = False
        if bare(words[-1]) in DANGLE or bare(words[-1]) in STOPWORDS or bare(words[-1]) in FILLER:
            words = words[:-1]
            changed = True
        elif bare(words[0]) in DANGLE or bare(words[0]) in STOPWORDS or bare(words[0]) in FILLER or len(words[0]) < 2:
            words = words[1:]
            changed = True
    return words


def hook_excerpt(window, max_words=7):
    words = window["words"]
    scored = []
    lexicon = dict(HOOK_MARKERS)
    lexicon.update(SURPRISE_MARKERS)
    for size in range(3, min(max_words, len(words)) + 1):
        for offset in range(0, len(words) - size + 1):
            span = words[offset:offset + size]
            if not any(is_content(w) for w in span):
                continue
            joined = " ".join(span)
            weight = 0.0
            matched = []
            for phrase, value in lexicon.items():
                if marker_re(phrase).search(joined):
                    weight += value
                    matched.append(phrase)
            if not matched:
                continue
            for phrase in matched:
                anchor = joined.find(phrase.split()[0])
                if anchor >= 0 and 0 <= offset + anchor <= 2:
                    weight += 0.8
            position_bonus = 1.0 if offset < 12 else 0.35
            scored.append((weight * position_bonus, -offset, span))
    if not scored:
        for size in (6, 5, 4, 3):
            seed = trim_span(list(words[:size]))
            if len(seed) >= 3:
                return " ".join(seed).upper().replace("'", "\u2019")
        return " ".join(words[:4]).upper().replace("'", "\u2019")
    scored.sort(key=lambda item: (-item[0], -item[1]))
    trimmed = trim_span(list(scored[0][2]))
    if len(trimmed) < 3:
        trimmed = list(scored[0][2])
    return " ".join(trimmed).upper().replace("'", "\u2019")


TITLE_NOISE = {
    "official", "video", "remaster", "hd", "full", "audio", "lyrics", "lyric",
    "clip", "trailer", "episode", "part", "new", "best", "top", "watch",
}


def build_hashtags(window, global_words, platform, title_words):
    tags = []
    seen = set()
    for word in list(title_words) + list(global_words) + keywords(window["text"], 8):
        key = lower(word)
        cleaned = re.sub(r"[^A-Za-z0-9]", "", word)
        if key in seen or key in STOPWORDS or key in NON_SPEECH or key in TITLE_NOISE:
            continue
        if len(cleaned) < 4 or cleaned.isdigit():
            continue
        seen.add(key)
        tags.append("#" + cleaned)
        if len(tags) == 4:
            break
    tags.append(PLATFORM_TAGS.get(platform, PLATFORM_TAGS["default"]))
    return tags[:5]


def sentence_from(text, max_words=26, anchor=None):
    sentences = [s.strip() for s in re.split(r"(?<=[.!?…])\s+", text) if s.strip()]
    complete = [s for s in sentences if 4 <= len(s.split()) <= max_words]
    if anchor:
        for sentence in complete:
            if marker_re(anchor).search(lower(sentence)):
                return clean(sentence).rstrip(",;:- ")
    if complete:
        return clean(complete[-1]).rstrip(",;:- ")

    words = text.split()
    if anchor:
        for size in range(len(anchor), 1, -1):
            for offset in range(0, len(words) - size + 1):
                if " ".join(words[offset:offset + size]).lower() == anchor.lower():
                    start = max(0, offset - max(0, (max_words - size) // 3))
                    span = words[start:start + max_words]
                    if span and span[0].lower() in DANGLE:
                        span = span[1:]
                    return clean(" ".join(span)).rstrip(",;:- ")
    if len(words) > max_words:
        return clean(" ".join(words[:max_words])).rstrip(",;:- ") + "…"
    return clean(" ".join(words)).rstrip(",;:- ")


STRONG = 2.0


def strongest_phrase(phrases, lexicon):
    for phrase in phrases:
        if lexicon.get(phrase, 0.0) >= STRONG:
            return phrase
    return None


def justify(window):
    duration = int(round(window["duration"]))
    hook = strongest_phrase(window["phrases"]["hook"], HOOK_MARKERS) or \
        strongest_phrase(window["phrases"]["surprise"], SURPRISE_MARKERS)
    tactical = strongest_phrase(window["phrases"]["tactical"], TACTICAL_MARKERS)
    emotion = strongest_phrase(window["phrases"]["emotion"], EMOTION_MARKERS)
    if hook:
        return "It sets up \u201c%s\u201d and holds %ds without a dead stretch, so the payoff lands before the scroll." % (hook, duration)
    if tactical:
        return "It is a concrete \u201c%s\u201d with an actual instruction in it, not just a claim, and it lands inside %ds." % (tactical, duration)
    if emotion:
        return "\u201c%s\u201d carries the window and the stakes stay personal, which is what earns the %ds watch-through." % (emotion.title(), duration)
    return "A %ds window that runs one thought start to finish \u2014 modest hook density, but nothing to trim." % duration


def build_blueprints(cues, chosen, title, platform, source_label):
    whole = " ".join(cue["text"] for cue in cues)
    topic_words = keywords(title or "", 6)
    global_words = keywords(whole, 10, boost=topic_words, min_count=2)
    blueprints = []
    for index, window in enumerate(chosen, start=1):
        hooks = hook_excerpt(window)
        words = [w for w in hooks.split() if w]
        if len(words) > 6:
            words = words[:6]
        while len(words) < 3:
            words = words + [w for w in window["words"] if w not in words][:1]
        clip_name = titlecase(" ".join(words))
        tags = build_hashtags(window, global_words, platform, topic_words)
        anchor = strongest_phrase(window["phrases"]["hook"], HOOK_MARKERS) or \
            strongest_phrase(window["phrases"]["tactical"], TACTICAL_MARKERS) or \
            strongest_phrase(window["phrases"]["emotion"], EMOTION_MARKERS)
        body = sentence_from(window["text"], 22, anchor)
        caption = "%s\n\nWorth the full listen? %s" % (body, " ".join(tags))
        blueprints.append({
            "clip": index,
            "clip_title": clip_name,
            "start_time": hhmmss(window["start"]),
            "end_time": hhmmss(window["end"]),
            "start_seconds": round(window["start"], 2),
            "end_seconds": round(window["end"], 2),
            "duration": int(round(window["duration"])),
            "viral_score": window["score"],
            "viral_justification": justify(window),
            "visual_hook_text": hooks,
            "social_caption": caption,
            "hashtags": tags,
            "signals": window["signals"],
            "transcript_excerpt": sentence_from(window["text"], 40, anchor),
        })
    return {
        "agent": "ViralClipAI",
        "skill": ".agent/skills/clipper.md",
        "video_title": title or sentence_from(" ".join(cue["text"] for cue in cues), 10),
        "source": source_label,
        "selected_clips_count": len(blueprints),
        "transcript_cues": len(cues),
        "clips": blueprints,
    }


def render_text(blueprint):
    lines = []
    lines.append("Video Title / Topic: %s" % blueprint["video_title"])
    lines.append("Selected Clips Count: %d clip%s" % (
        blueprint["selected_clips_count"], "" if blueprint["selected_clips_count"] == 1 else "s"))
    lines.append("")
    for item in blueprint["clips"]:
        lines.append("Clip %d" % item["clip"])
        lines.append("- Clip Title: %s" % item["clip_title"])
        lines.append("- Start Time: %s" % item["start_time"])
        lines.append("- End Time: %s" % item["end_time"])
        lines.append("- Duration: %d seconds" % item["duration"])
        lines.append("- Viral Score: %d/100 — %s" % (item["viral_score"], item["viral_justification"]))
        lines.append("- Visual Hook Text: %s" % item["visual_hook_text"])
        lines.append("- Social Caption: %s" % item["social_caption"].replace("\n\n", " "))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_markdown(blueprint):
    lines = ["# ViralClipAI — %s" % blueprint["video_title"], ""]
    lines.append("Source: %s" % blueprint["source"])
    lines.append("Selected Clips Count: %d" % blueprint["selected_clips_count"])
    lines.append("")
    for item in blueprint["clips"]:
        lines.append("## Clip %d — %s" % (item["clip"], item["clip_title"]))
        lines.append("")
        lines.append("- **Start Time:** %s" % item["start_time"])
        lines.append("- **End Time:** %s" % item["end_time"])
        lines.append("- **Duration:** %d seconds" % item["duration"])
        lines.append("- **Viral Score:** %d/100 — %s" % (item["viral_score"], item["viral_justification"]))
        lines.append("- **Visual Hook Text:** %s" % item["visual_hook_text"])
        lines.append("- **Social Caption:** %s %s" % (item["social_caption"].replace("\n\n", " "), " ".join(item["hashtags"])))
        lines.append("")
        lines.append("> %s" % item["transcript_excerpt"])
        lines.append("")
    return "\n".join(lines) + "\n"


def child_env():
    env = os.environ.copy()
    binary = resolve_binary("ffmpeg")
    if binary:
        env["PATH"] = os.path.dirname(binary) + os.pathsep + env.get("PATH", "")
    return env


def resolve_binary(name):
    if name == "ffmpeg":
        override = os.environ.get("FFMPEG_BINARY")
        if override and os.path.isfile(override) and os.access(override, os.X_OK):
            return override
    candidate = os.path.expanduser(os.path.join("~", "bin", name))
    if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
        return candidate
    return shutil.which(name)


def probe_duration(binary, path):
    try:
        out = subprocess.run([binary, "-i", path], capture_output=True, text=True, env=child_env())
    except Exception:
        return None
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", out.stderr or "")
    if not match:
        return None
    return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + float(match.group(3))


def download_video(url, destination, stderr):
    binary = resolve_binary("yt-dlp")
    if not binary:
        stderr.write("yt-dlp not found. Install it or pass --video with a local file.\n")
        return None
    os.makedirs(destination, exist_ok=True)
    target = os.path.join(destination, "source.%(ext)s")
    command = [
        binary, "--no-playlist", "--no-warnings", "--newline",
        "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4", "-o", target, url,
    ]
    stderr.write("Downloading source video...\n")
    try:
        result = subprocess.run(command, capture_output=True, text=True, env=child_env(), timeout=3600)
    except Exception as exc:
        stderr.write("Download failed: %s\n" % exc)
        return None
    if result.returncode != 0:
        stderr.write((result.stderr or "")[-600:] + "\n")
        return None
    for name in sorted(os.listdir(destination)):
        if name.startswith("source.") and name.endswith(".mp4"):
            return os.path.join(destination, name)
    for name in sorted(os.listdir(destination)):
        if name.startswith("source."):
            return os.path.join(destination, name)
    return None


def cut_clip(ffmpeg, source, item, output, vertical, stderr):
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
               "-ss", "%.3f" % item["start_seconds"],
               "-i", source,
               "-t", "%.3f" % (item["end_seconds"] - item["start_seconds"])]
    if vertical:
        width = int(round(1920 * 9 / 16.0 / 2)) * 2
        command += ["-vf", "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=%d:1920,setsar=1" % width]
    command += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                "-avoid_negative_ts", "make_zero", output]
    try:
        result = subprocess.run(command, capture_output=True, text=True, env=child_env())
    except Exception as exc:
        stderr.write("ffmpeg failed for %s: %s\n" % (output, exc))
        return False
    if result.returncode != 0 or not os.path.isfile(output):
        stderr.write((result.stderr or "ffmpeg error")[-600:] + "\n")
        return False
    return True


def write_outputs(blueprint, out_dir, fmt, stdout, stderr):
    if fmt == "json":
        stdout.write(json.dumps(blueprint, indent=2, ensure_ascii=False) + "\n")
        return
    if fmt == "md":
        stdout.write(render_markdown(blueprint))
    else:
        stdout.write(render_text(blueprint))

    if out_dir:
        if not os.path.isdir(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "blueprints.json"), "w", encoding="utf-8") as handle:
            handle.write(json.dumps(blueprint, indent=2, ensure_ascii=False) + "\n")
        with open(os.path.join(out_dir, "blueprints.md"), "w", encoding="utf-8") as handle:
            handle.write(render_markdown(blueprint))
        stderr.write("Blueprints written to %s\n" % out_dir)


def refuse(stderr, reason=None):
    if reason:
        stderr.write("Refusing: %s\n" % reason)
    sys.stdout.write(REFUSAL + "\n")
    sys.stdout.flush()
    return 2


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True, description="ViralClipAI clip blueprint generator and cutter.")
    parser.add_argument("url", nargs="?", help="YouTube URL or video id")
    parser.add_argument("--url", dest="url_flag")
    parser.add_argument("--transcript")
    parser.add_argument("--out", default="clips")
    parser.add_argument("--video")
    parser.add_argument("--no-cut", action="store_true")
    parser.add_argument("--vertical", action="store_true")
    parser.add_argument("--platform", default="shorts", choices=["shorts", "reels", "tiktok"])
    parser.add_argument("--format", dest="fmt", default="text", choices=["text", "json", "md"])
    parser.add_argument("--ffmpeg", dest="ffmpeg_flag")
    parser.add_argument("--keep-source", action="store_true")
    args = parser.parse_args(argv)

    stderr = sys.stderr
    url = args.url_flag or args.url
    source_label = url or args.transcript or ""

    if not url and not args.transcript:
        return refuse(stderr, "no video URL and no transcript path given")

    if args.ffmpeg_flag:
        os.environ["FFMPEG_BINARY"] = os.path.abspath(os.path.expanduser(args.ffmpeg_flag))

    if args.transcript:
        cues = parse_transcript_file(args.transcript, stderr)
        video_id = None
        title = None
    else:
        cues, fetched = fetch_transcript_from_url(url, stderr)
        video_id = fetched[0] if fetched else None
        title = fetched[1] if fetched else None
        if video_id:
            source_label = "https://www.youtube.com/watch?v=%s" % video_id

    if not cues or len(cues) < 3:
        return refuse(stderr, "transcript missing, empty, or unreadable")

    spoken = cue_end(cues[-1]) - cues[0]["start"]
    if spoken < CLIP_MIN * 1.2:
        return refuse(stderr, "transcript holds no usable dialogue")

    found = candidates(cues, stderr)
    if not found:
        return refuse(stderr, "no window between %d and %d seconds could be scored" % (CLIP_MIN, CLIP_MAX))

    chosen = select_clips(found, stderr)
    if not chosen:
        return refuse(stderr, "no three non-overlapping windows qualified")

    blueprint = build_blueprints(cues, chosen, title, args.platform, source_label)
    if blueprint["selected_clips_count"] < CLIP_COUNT:
        stderr.write("Only %d window(s) satisfied the %d-%ds rules in this transcript.\n"
                     % (blueprint["selected_clips_count"], CLIP_MIN, CLIP_MAX))

    out_dir = os.path.abspath(os.path.expanduser(args.out)) if args.out else ""
    run_dir = os.path.join(out_dir, slugify(blueprint["video_title"])) if out_dir else ""
    write_outputs(blueprint, run_dir, args.fmt, sys.stdout, stderr)

    if args.no_cut:
        return 0

    ffmpeg = resolve_binary("ffmpeg")
    if not ffmpeg:
        stderr.write("ffmpeg not found. Run scripts/clip.py with --no-cut, or set FFMPEG_BINARY.\n")
        return 3

    source = args.video
    temp_dir = None
    if not source:
        if not url:
            stderr.write("Cannot download without a URL; skipping the cut step.\n")
            return 0
        temp_dir = tempfile.mkdtemp(prefix="viralclipai-")
        source = download_video(url, temp_dir, stderr)
        if not source:
            if temp_dir:
                shutil.rmtree(temp_dir, ignore_errors=True)
            return 3

    if run_dir and not os.path.isdir(run_dir):
        os.makedirs(run_dir, exist_ok=True)

    for item in blueprint["clips"]:
        output = os.path.join(run_dir, "clip-%d.mp4" % item["clip"])
        if not cut_clip(ffmpeg, source, item, output, args.vertical, stderr):
            stderr.write("Clip %d was not written.\n" % item["clip"])
            continue
        actual = probe_duration(ffmpeg, output)
        if actual is None:
            stderr.write("Clip %d written (duration unverified).\n" % item["clip"])
        elif abs(actual - item["duration"]) > 1.0:
            stderr.write("Clip %d duration drift: planned %ds, rendered %.1fs.\n"
                         % (item["clip"], item["duration"], actual))
        else:
            stderr.write("Clip %d written: %s (%.1fs, %s)\n" % (
                item["clip"], output, actual, "9:16" if args.vertical else "source aspect"))

    if temp_dir and not args.keep_source:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.stderr.write("\nInterrupted.\n")
        sys.exit(130)
