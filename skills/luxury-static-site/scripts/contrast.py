#!/usr/bin/env python3
"""WCAG 2.x contrast calculator for the luxury-static-site skill.

Two modes:

    contrast.py "#1c1c1a" "#f4f1ea"                 # one pair
    contrast.py --tokens styles.css                 # every --fg-on-* token
    contrast.py --tokens styles.css --large         # relax to the 3:1 large-text floor
    contrast.py --pair "#8a6a3b" "#f4f1ea" --level AA

The --tokens mode parses a CSS file for custom properties and resolves every
declaration whose name starts with --fg-on- against the --* token it names, so
`--fg-on-surface: var(--ink);` is checked as ink against surface. That catches
the failure mode that matters in a luxury palette: a metallic accent that looks
right on a white artboard and lands at 2.8:1 on the actual warm ground.

Exit code is 1 if any pair fails the level, 0 otherwise, so it can gate a build.
"""

import argparse
import json
import os
import re
import sys

# WCAG 2.2 relative luminance: linearise each channel, then weight by
# 0.2126 R + 0.7152 G + 0.0722 B.
def _linearise(channel):
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def parse_hex(value):
    """'#abc', '#aabbcc', '#aabbccdd' -> (r, g, b). Returns None if unparseable."""
    if not isinstance(value, str):
        return None
    v = value.strip().lstrip("#")
    if len(v) == 3:
        v = "".join(ch * 2 for ch in v)
    if len(v) == 8:
        v = v[:6]
    if len(v) != 6:
        return None
    try:
        return tuple(int(v[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def relative_luminance(rgb):
    r, g, b = (_linearise(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg, bg):
    """fg and bg are (r, g, b) tuples. Returns a float, or None if either is unparseable."""
    a, b = parse_hex(fg), parse_hex(bg)
    if a is None or b is None:
        return None
    la, lb = relative_luminance(a), relative_luminance(b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def thresholds(level, large):
    """Minimum ratio for a pass. Large text is >=24px, or >=18.66px bold."""
    table = {
        "A": (4.5, 3.0),
        "AA": (4.5, 3.0),
        "AAA": (7.0, 4.5),
    }
    normal, big = table.get(level.upper(), table["AA"])
    return big if large else normal


def read_tokens(css_path):
    """Return {token_name: raw_value} for every --custom-property in the file."""
    try:
        with open(css_path, "r", encoding="utf-8") as fh:
            source = fh.read()
    except OSError as exc:
        raise SystemExit("contrast: cannot read {0}: {1}".format(css_path, exc))

    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    tokens = {}
    for name, raw in re.findall(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);", source):
        tokens.setdefault(name, raw.strip())
    return tokens


def resolve(raw, tokens, depth=0):
    """Follow var(--x) chains up to a literal colour. Returns hex string or None."""
    if depth > 8 or raw is None:
        return None
    raw = raw.strip()
    if parse_hex(raw):
        return raw.lower()
    m = re.fullmatch(r"var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\s*\)", raw)
    if not m:
        return None
    name, fallback = m.group(1), m.group(2)
    if name in tokens:
        found = resolve(tokens[name], tokens, depth + 1)
        if found:
            return found
    if fallback:
        return resolve(fallback, tokens, depth + 1)
    return None


def _ratio_text(ratio):
    return "{0:.2f}:1".format(ratio)


def check_pair(label, fg_raw, bg_raw, fg_hex, bg_hex, level, large):
    ratio = contrast_ratio(fg_hex, bg_hex)
    need = thresholds(level, large)
    if ratio is None:
        return (label, None, None, "UNRESOLVED", fg_raw, bg_raw)
    if ratio + 0.005 >= need:
        return (label, ratio, need, "PASS", fg_raw, bg_raw)
    return (label, ratio, need, "FAIL", fg_raw, bg_raw)


def report(rows, level, large, stream=sys.stdout):
    failed = 0
    for label, ratio, need, verdict, fg_raw, bg_raw in rows:
        if verdict == "PASS":
            stream.write("  PASS  {0:<34} {1:>8}  (needs {2})\n".format(label, _ratio_text(ratio), _ratio_text(need)))
        elif verdict == "FAIL":
            failed += 1
            stream.write("  FAIL  {0:<34} {1:>8}  (needs {2})\n".format(label, _ratio_text(ratio), _ratio_text(need)))
            stream.write("        {0} on {1}\n".format(fg_raw, bg_raw))
        else:
            failed += 1
            stream.write("  FAIL  {0:<34} unresolvable colour\n        {1} on {2}\n".format(label, fg_raw, bg_raw))
    return failed


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="WCAG 2.x contrast checker. Reads hex literals or a CSS token file.",
    )
    ap.add_argument("hexes", nargs="*", metavar="HEX", help="foreground and background hex, positionally")
    ap.add_argument("--pair", nargs=2, metavar=("FG", "BG"), dest="pair_opt", help="foreground and background hex")
    ap.add_argument("--tokens", metavar="FILE", help="CSS file to read custom properties from")
    ap.add_argument("--level", default="AA", choices=["A", "AA", "AAA"], help="required level (default AA)")
    ap.add_argument("--large", action="store_true", help="use the large-text floor (3:1 / 4.5:1)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = ap.parse_args(argv)

    rows = []

    if args.tokens:
        if not os.path.isfile(args.tokens):
            raise SystemExit("contrast: no such file: {0}".format(args.tokens))
        tokens = read_tokens(args.tokens)
        if not tokens:
            raise SystemExit("contrast: no custom properties found in {0}".format(args.tokens))
        checked = 0
        for name in sorted(tokens):
            if not name.startswith("--fg-on-"):
                continue
            fg_hex = resolve(tokens[name], tokens)
            m = re.fullmatch(r"--fg-on-(.+)", name)
            bg_name = "--" + m.group(1)
            bg_hex = resolve(tokens.get(bg_name), tokens)
            checked += 1
            if bg_hex is None:
                rows.append((name.lstrip("-"), None, thresholds(args.level, args.large), "UNRESOLVED", tokens[name], bg_name + " is not declared"))
                continue
            rows.append(check_pair(name.lstrip("-"), tokens[name], bg_name, fg_hex, bg_hex, args.level, args.large))
        if checked == 0:
            raise SystemExit(
                "contrast: no --fg-on-* pair tokens in {0}.\n"
                "          Declare pairs as --fg-on-surface: var(--ink); and --surface: #f4f1ea;".format(args.tokens)
            )
    elif args.pair_opt:
        fg, bg = args.pair_opt
        rows.append(check_pair("pair", fg, bg, fg, bg, args.level, args.large))
    elif len(args.hexes) == 2:
        fg, bg = args.hexes
        rows.append(check_pair("pair", fg, bg, fg, bg, args.level, args.large))
    else:
        ap.error("give two hex values, --pair FG BG, or --tokens FILE")

    if args.json:
        payload = [
            {
                "label": r[0],
                "ratio": None if r[1] is None else round(r[1], 2),
                "required": r[2],
                "verdict": r[3],
                "foreground": r[4],
                "background": r[5],
            }
            for r in rows
        ]
        sys.stdout.write(json.dumps(payload, indent=2) + "\n")
    else:
        failed = report(rows, args.level, args.large)
        total = len(rows)
        sys.stdout.write(
            "\n{0}/{1} pairs pass {2}{3}\n".format(total - failed, total, args.level, " (large text)" if args.large else "")
        )
        if failed:
            sys.stdout.write(
                "Adjust the failing pair by moving the foreground's lightness until it\n"
                "clears the floor, keeping its hue. Do not change the hue to pass.\n"
            )

    # UNRESOLVED counts as a failure: an unparseable colour is not a pass.
    return 1 if any(r[3] in ("FAIL", "UNRESOLVED") for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
