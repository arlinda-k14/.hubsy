#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PILLARS = [
    ("career-outcomes", 0.30),
    ("skill-preview", 0.25),
    ("behind-the-scenes", 0.20),
    ("ai-trends", 0.15),
    ("enrollment", 0.10),
]

ACADEMIES = [
    "digital-marketing",
    "data-eng",
    "data-science",
    "fullstack",
    "product",
    "hr",
    "vibe-coding",
    "none",
]

HOOKS = {
    "career-outcomes": [
        "One skill that got our grad the interview",
        "Where last month's portfolio projects work now",
        "Hiring partner asked for this in every data interview",
        "From career switcher to junior role in weeks",
        "The project employers actually open",
    ],
    "skill-preview": [
        "This tool in 60 seconds, no jargon",
        "What this module builds with you in week one",
        "A real exercise from our academy, simplified",
        "Stop guessing: how this stack fits together",
        "Try this prompt on your next marketing task",
    ],
    "behind-the-scenes": [
        "Inside one live session this week",
        "How an instructor preps a lab",
        "Campus Tuesday: what hybrid really looks like",
        "Student critique night, unfiltered",
        "Building day on the Prishtina campus",
    ],
    "ai-trends": [
        "The AI education shift, without the hype",
        "What employers mean when they say AI-ready",
        "One public trend worth stealing for your team",
        "Where AI agents fit in real workflows",
        "Read this before buying another course",
    ],
    "enrollment": [
        "Intake window: how applications actually work",
        "Installments explained in plain numbers",
        "Meet the coordinator for your academy",
        "What you need before you apply (hint: less than you think)",
        "Seats, dates, and the 60-second apply flow",
    ],
}

CHANNEL_TIMES = {
    "instagram": "12:30",
    "linkedin": "09:00",
    "tiktok": "19:30",
    "youtube": "17:00",
    "blog": "10:00",
}

FORMAT_BY_CHANNEL = {
    "instagram": "carousel",
    "linkedin": "text",
    "tiktok": "video",
    "youtube": "video",
    "blog": "article",
}


def pillar_cycle(n: int) -> list[str]:
    total_weight = sum(w for _, w in PILLARS)
    raw = [max(1, round(n * w / total_weight)) for _, w in PILLARS]
    while sum(raw) < n:
        raw[0] += 1
    cycle = []
    for (name, _), count in zip(PILLARS, raw):
        cycle.extend([name] * count)
    return cycle[:n]


def build(research_path, slug, weeks, channels, language):
    today = date.today()
    n = min(max(weeks * (3 if len(channels) == 1 else len(channels) * 2), 8), 20)
    pillars = pillar_cycle(n)
    sources: list[str] = []
    if research_path:
        data = json.loads(Path(research_path).read_text(encoding="utf-8"))
        sources = [s["url"] for s in data.get("sources") or [] if not s.get("blocked")]

    rows = []
    day = today + timedelta(days=1)
    ch_i = 0
    for i in range(n):
        while day.weekday() >= 5:
            day += timedelta(days=1)
        channel = channels[ch_i % len(channels)]
        ch_i += 1
        pillar = pillars[i]
        academy = ACADEMIES[i % (len(ACADEMIES) - 1)]
        hooks = HOOKS[pillar]
        hook = hooks[i % len(hooks)]
        rows.append(
            {
                "date": day.isoformat(),
                "time": CHANNEL_TIMES.get(channel, "12:00"),
                "timezone": "Europe/Prishtina",
                "channel": channel,
                "format": FORMAT_BY_CHANNEL.get(channel, "text"),
                "pillar": pillar,
                "academy": academy if pillar != "enrollment" else "none",
                "language": language,
                "hook": hook,
                "caption_summary": f"{pillar.replace('-', ' ')} post about {academy}",
                "cta": "save and share with someone who needs this" if pillar != "enrollment" else "apply link in bio",
                "asset_notes": "1080x1350 or 1080x1920; brand colors; real campus or UI shot",
                "sources": sources[:2] if pillar == "ai-trends" and sources else [],
                "status": "draft",
            }
        )
        if i % len(channels) == len(channels) - 1:
            day += timedelta(days=1)

    run_dir = ROOT / "output" / f"run-{today.isoformat()}-{slug}"
    run_dir.mkdir(parents=True, exist_ok=True)
    drafts = run_dir / "drafts"
    drafts.mkdir(exist_ok=True)

    calendar = {
        "slug": slug,
        "generated": today.isoformat(),
        "weeks": weeks,
        "language": language,
        "channels": channels,
        "rows": rows,
    }
    (run_dir / "calendar.json").write_text(
        json.dumps(calendar, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [
        f"# Content Calendar — {slug}",
        "",
        f"Period: {rows[0]['date']} → {rows[-1]['date']} ({weeks} weeks)",
        f"Channels: {', '.join(channels)} | Language: {language} | Posts: {len(rows)}",
        "",
        "| Date | Time | Channel | Format | Pillar | Academy | Hook | CTA |",
        "|------|------|---------|--------|--------|---------|------|-----|",
    ]
    for r in rows:
        lines.append(
            "| {date} | {time} | {channel} | {format} | {pillar} | {academy} | {hook} | {cta} |".format(**r)
        )
    (run_dir / "calendar.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    for r in rows:
        slug_topic = r["hook"].lower().replace(" ", "-")[:40].strip("-")
        name = f"{r['date']}-{r['channel']}-{slug_topic}.md"
        body = f"""# {r['date']} — {r['channel']} — {r['pillar']}

- Academy: {r['academy']}
- Format: {r['format']}
- Language: {r['language']}
- Sources: {', '.join(r['sources']) or '-'}

## Hook

{r['hook']}

## Caption

{r['caption_summary']}. Expand with one concrete example from the academy and keep sentences short. End with a single clear next step for the reader.

## CTA

{r['cta']}

## Hashtags

#CreativeHubKosovo #CreativeHubAcademy

## Asset notes

{r['asset_notes']}

## Review checks

- [ ] facts match knowledge base
- [ ] single language
- [ ] single CTA
- [ ] no banned phrases
"""
        (drafts / name).write_text(body, encoding="utf-8")

    return {"run_dir": str(run_dir), "posts": len(rows)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a content calendar")
    parser.add_argument("--research", default=None)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--weeks", type=int, default=4)
    parser.add_argument("--channels", default="instagram,linkedin")
    parser.add_argument("--language", default="sq", choices=["sq", "en"])
    args = parser.parse_args()
    channels = [c.strip() for c in args.channels.split(",") if c.strip()]
    result = build(args.research, args.slug, args.weeks, channels, args.language)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
