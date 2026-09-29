#!/usr/bin/env python3
"""Success-criteria gate for the luxury-static-site skill.

    python3 scripts/audit.py <site-dir>
    python3 scripts/audit.py ./site --css styles.css
    python3 scripts/audit.py ./site --json

Checks the built site against the skill's definition of done and prints a
grouped report. Exit code 0 only if nothing FAILED; warnings do not block.

The distinction this script exists to enforce: INTAKE placeholders ({{token}} or
a bracketed stub) mean the interview was never finished and are a hard failure.
CONTENT placeholders (data-placeholder on a testimonial, an award, a logo) are
correct behaviour — the brand owner supplies those — and are reported as a
replacement list, not a failure. An element that is *both* is a failure: it is
marked for replacement but still has an unfilled field in it.

Advisory (WARN) items are judgment calls the author is better placed to make
than a regex, so they are surfaced without blocking.
"""

import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser

VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}

# Never appear. These are unambiguous and fail the build.
BANNED_TERMS = [
    "deal", "deals", "discount", "discounted", "hurry", "limited time",
    "act now", "best in class", "best-in-class", "world class", "world-class",
    "cutting edge", "cutting-edge", "state of the art", "revolutionary",
    "game changing", "game-changing", "seamless", "seamlessly", "unlock",
    "game-changer", "cheap", "cheapest", "buy now", "limited offer",
    "sign up now", "dont miss", "don't miss", "click here", "order now",
]

# Surface it, don't block. A luxury page may need these in moderation.
WATCH_TERMS = [
    "premium", "quality", "luxury", "luxurious", "exclusive", "affordable",
    "ultimate", "perfect", "amazing", "incredible", "stunning", "beautiful",
    "best", "leading", "world's finest",
]

# Bare stubs, whatever their casing.
STUB_TERMS = ["tbd", "todo", "lorem ipsum", "fixme", "to be confirmed", "xxx"]

INTAKE_TOKEN = re.compile(r"\{\{\s*[a-z0-9_.-]+\s*\}\}")
# Two or more capitalised words in brackets reads as a stub; a single word
# like [New] is ordinary copy and must not fail the build.
INTAKE_BRACKET = re.compile(r"\[([A-Z][A-Za-z']+(?:[ ][A-Za-z']+){1,6})\]")
STUB_UPPER = re.compile(r"\b(PLACEHOLDER|INSERT [A-Z ]+HERE)\b")

FORBIDDEN_CSS = [
    (r"backdrop-filter", "glassmorphism"),
    (r"(?<!-)\b(?:linear|radial|conic)-gradient\s*\(", "stock gradient"),
    (r"text-shadow\s*:\s*(?!none)", "text glow"),
    (r"transition\s*:\s*all\b", "transition: all is unmeasurable"),
    (r"filter\s*:\s*blur", "blurred backdrop"),
    (r"\bwill-change\s*:\s*transform\b", "permanent will-change"),
]

ALLOWED_KEYFRAMES = ["reveal", "fade", "rise", "drift", "ease", "shimmer-none"]


class Finding(object):
    __slots__ = ("level", "group", "msg", "where")

    def __init__(self, level, group, msg, where=""):
        self.level = level
        self.group = group
        self.msg = msg
        self.where = where

    def as_dict(self):
        return {"level": self.level, "group": self.group, "message": self.msg, "where": self.where}


class PageParser(HTMLParser):
    def __init__(self, page):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.page = page
        self.findings = []
        self.html_attrs = None
        self.title = ""
        self.meta_description = ""
        self.h1_count = 0
        self.has_skip_link = False
        self.has_main = False
        self.sections = []          # [{id, primaries, line}]
        self.images = []
        self.controls = []
        self.ids = set()
        self.text_parts = []
        self._capture = None
        self.finalized_placeholders = []
        self._depth = 0
        self._section_stack = []
        self._label_depth = 0
        self._in_title = False
        self._suppress = 0
        self._suppress_tag = None

    # -- helpers ---------------------------------------------------------
    def _add(self, level, group, msg, where=""):
        self.findings.append(Finding(level, group, msg, where or self.page))

    def _classes(self, attrs):
        d = dict(attrs)
        return d.get("class", "") or ""

    # -- parser callbacks ------------------------------------------------
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)

        if self._suppress:
            if tag == self._suppress_tag:
                self._suppress += 1
            return

        if tag not in VOID:
            self._depth += 1

        if self._capture is not None:
            self._capture["parts"].append("")

        if tag == "html":
            self.html_attrs = d
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            if (d.get("name") or "").lower() == "description":
                self.meta_description = d.get("content", "")
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "main":
            self.has_main = True
        elif tag == "label":
            self._label_depth += 1
            if d.get("for"):
                self.ids.add("for:" + d["for"])
        elif tag in ("script", "style"):
            self._suppress = 1
            self._suppress_tag = tag
            return
        elif tag == "a" and "skip-link" in self._classes(attrs):
            self.has_skip_link = True

        if d.get("id"):
            self.ids.add("id:" + d["id"])
        if d.get("data-placeholder") and self._capture is None:
            self._capture = {
                "tag": tag,
                "depth": self._depth,
                "kind": d["data-placeholder"],
                "line": self.getpos()[0],
                "parts": [],
            }

        if tag == "section":
            self._section_stack.append({"id": d.get("id") or "(unnamed)", "primaries": 0, "line": self.getpos()[0]})
        elif tag == "a" and "cta--primary" in self._classes(attrs):
            if self._section_stack:
                self._section_stack[-1]["primaries"] += 1
        elif tag == "button" and "cta--primary" in self._classes(attrs):
            if self._section_stack:
                self._section_stack[-1]["primaries"] += 1

        if tag == "img":
            self.images.append((d, self.getpos()[0]))
        elif tag in ("input", "textarea", "select"):
            self.controls.append((tag, d, self._label_depth > 0, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in ("script", "style") and self._suppress:
            self._suppress = 0
            self._suppress_tag = None

    def handle_endtag(self, tag):
        if self._suppress:
            if tag == self._suppress_tag:
                self._suppress -= 1
                if self._suppress == 0:
                    self._suppress_tag = None
            return

        if self._capture is not None and self._capture["depth"] == self._depth and tag == self._capture["tag"]:
            self.finalized_placeholders.append(self._capture)
            self._capture = None

        if tag in VOID:
            return

        if tag == "title":
            self._in_title = False
        elif tag == "label":
            self._label_depth = max(0, self._label_depth - 1)
        elif tag == "section" and self._section_stack:
            self.sections.append(self._section_stack.pop())

        self._depth = max(0, self._depth - 1)

    def handle_data(self, data):
        if self._suppress:
            return
        if self._in_title:
            self.title += data
        if self._capture is not None:
            self._capture["parts"].append(data)
        self.text_parts.append(data)

    # -- post-parse checks -----------------------------------------------
    def finish(self):
        for leftover in self._section_stack:
            self.sections.append(leftover)
        if self._capture is not None:
            self.finalized_placeholders.append(self._capture)
            self._capture = None

        for cap in self.finalized_placeholders:
            where = "{0}:{1}".format(self.page, cap["line"])
            inner = re.sub(r"\s+", " ", " ".join(cap["parts"])).strip()
            leftover = INTAKE_TOKEN.search(inner) or STUB_UPPER.search(inner)
            if leftover:
                self._add(
                    "FAIL", "placeholder",
                    "<{0}> is marked data-placeholder={1!r} but still contains {2!r} — "
                    "it is both an intake and a content placeholder".format(
                        cap["tag"], cap["kind"], leftover.group(0)),
                    where)
            else:
                self._add(
                    "REPLACE", "placeholder",
                    "<{0}> content placeholder of type {1!r} — brand owner must supply this".format(
                        cap["tag"], cap["kind"]),
                    where)

        if self.html_attrs is None:
            self._add("FAIL", "html", "<html> tag not found — file may not be HTML", self.page)
        elif not self.html_attrs.get("lang"):
            self._add("FAIL", "a11y", "<html> is missing a lang attribute", self.page)

        if not self.title.strip():
            self._add("FAIL", "seo", "<title> is empty", self.page)
        if not self.meta_description.strip():
            self._add("FAIL", "seo", "meta description is missing", self.page)
        elif len(self.meta_description) > 165:
            self._add("WARN", "seo", "meta description is {0} chars; over ~160 truncates in SERPs".format(len(self.meta_description)), self.page)

        if self.h1_count == 0:
            self._add("FAIL", "semantics", "no <h1> on the page", self.page)
        elif self.h1_count > 1:
            self._add("FAIL", "semantics", "{0} <h1> elements; exactly one is required".format(self.h1_count), self.page)

        if not self.has_main:
            self._add("FAIL", "a11y", "no <main> landmark", self.page)
        if not self.has_skip_link:
            self._add("FAIL", "a11y", "no skip link (.skip-link) — first tab stop should bypass the header", self.page)

        for attrs, line in self.images:
            if "alt" not in attrs:
                self._add("FAIL", "a11y", "<img> has no alt attribute", "{0}:{1}".format(self.page, line))
            elif attrs.get("alt", "").strip().lower() in ("image", "photo", "picture", "hero", "logo image"):
                self._add("WARN", "copy", "alt text is a content-free label: {0!r}".format(attrs.get("alt")), "{0}:{1}".format(self.page, line))
            if "width" not in attrs or "height" not in attrs:
                self._add("WARN", "perf", "<img> missing width/height — causes layout shift", "{0}:{1}".format(self.page, line))

        for tag, d, in_label, line in self.controls:
            itype = (d.get("type") or "").lower()
            if tag == "input" and itype in ("hidden", "submit", "button", "reset", "image"):
                continue
            has_label = bool(
                in_label
                or d.get("aria-label")
                or d.get("aria-labelledby")
                or (d.get("id") and ("for:" + d["id"]) in self.ids)
            )
            if not has_label:
                self._add("FAIL", "a11y", "<{0}> has no associated label".format(tag), "{0}:{1}".format(self.page, line))
            if d.get("required") and d.get("aria-required") != "true":
                self._add("WARN", "a11y", "required <{0}> lacks aria-required".format(tag), "{0}:{1}".format(self.page, line))

        for i, sec in enumerate(self.sections):
            where = "{0} (section {1}, line {2})".format(self.page, i + 1, sec["line"])
            if sec["primaries"] > 1:
                self._add("FAIL", "cta", "section has {0} primary CTAs; exactly one is allowed".format(sec["primaries"]), where)
            elif sec["primaries"] == 0:
                self._add("WARN", "cta", "section has no primary CTA", where)

        self._scan_text()

    def _scan_text(self):
        blob = " ".join(self.text_parts)
        haystack = blob + " " + self.title + " " + self.meta_description
        flat = re.sub(r"\s+", " ", haystack)
        seen_tokens = set()

        for m in INTAKE_TOKEN.finditer(flat):
            token = m.group(0)
            if token in seen_tokens:
                continue
            seen_tokens.add(token)
            left = max(0, m.start() - 45)
            right = min(len(flat), m.end() + 45)
            ctx = flat[left:right].strip()
            self._add("FAIL", "placeholder", "unfilled intake placeholder {0} — …{1}…".format(token, ctx), self.page)

        for m in INTAKE_BRACKET.finditer(flat):
            self._add("FAIL", "placeholder", "bracketed stub [{0}] left in copy".format(m.group(1)), self.page)

        for m in STUB_UPPER.finditer(flat):
            self._add("FAIL", "placeholder", "unresolved stub {0!r} in copy".format(m.group(0)), self.page)

        low = flat.lower()
        for term in BANNED_TERMS:
            if re.search(r"\b" + re.escape(term) + r"\b", low):
                self._add("FAIL", "copy", "banned term {0!r} in copy".format(term), self.page)
        for term in WATCH_TERMS:
            if re.search(r"\b" + re.escape(term) + r"\b", low):
                self._add("WARN", "copy", "watch term {0!r} — confirm it is not boastful here".format(term), self.page)
        for term in STUB_TERMS:
            if term in low:
                self._add("FAIL", "placeholder", "stub text {0!r} in copy".format(term), self.page)


def audit_css(css_path, findings):
    if not os.path.isfile(css_path):
        findings.append(Finding("FAIL", "css", "no stylesheet at {0}".format(css_path)))
        return
    with open(css_path, "r", encoding="utf-8") as fh:
        css = fh.read()

    cleaned = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    props = re.findall(r"(--[A-Za-z0-9_-]+)\s*:", cleaned)

    if not props:
        findings.append(Finding("FAIL", "css", "no CSS custom properties found — colours, type and spacing must be tokenised"))
    else:
        required = ["--ink", "--surface", "--accent"]
        missing = [r for r in required if r not in props]
        if missing:
            findings.append(Finding("WARN", "css", "expected tokens not declared: {0}".format(", ".join(missing))))
        if not any(p.startswith("--fg-on-") for p in props):
            findings.append(Finding("WARN", "css", "no --fg-on-* audit pairs declared; run contrast.py on a token file to check contrast"))
        hardcoded = re.findall(r"(?:color|background(?:-color)?)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;", cleaned)
        if hardcoded:
            findings.append(Finding("WARN", "css", "{0} hardcoded colour value(s) outside custom properties".format(len(hardcoded))))

    for pattern, label in FORBIDDEN_CSS:
        hits = re.findall(pattern, cleaned)
        if hits:
            findings.append(Finding("FAIL", "css", "forbidden CSS: {0} ({1} occurrence{2})".format(label, len(hits), "" if len(hits) == 1 else "s")))

    for name in re.findall(r"@keyframes\s+([A-Za-z0-9_-]+)", cleaned):
        if name.lower() not in ALLOWED_KEYFRAMES:
            findings.append(Finding("WARN", "motion", "unexpected @keyframes {0!r} — only gentle fade/reveal is allowed".format(name)))

    if ":focus-visible" not in cleaned:
        findings.append(Finding("FAIL", "a11y", "no :focus-visible style — visible focus states are required"))
    if "prefers-reduced-motion" not in cleaned:
        findings.append(Finding("FAIL", "a11y", "no prefers-reduced-motion block — motion must be disableable"))

    media = len(re.findall(r"@media", cleaned))
    if media < 2:
        findings.append(Finding("WARN", "responsive", "only {0} media quer{1} — verify 375 / 768 / 1440".format(media, "y" if media == 1 else "ies")))

    if re.search(r"<script", css, re.I):
        findings.append(Finding("WARN", "css", "<script> found inside CSS"))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Audit a luxury static site against the skill's success criteria.")
    ap.add_argument("site", help="site directory, or a single .html file")
    ap.add_argument("--css", help="path to stylesheet (default: <site>/styles.css)")
    ap.add_argument("--json", action="store_true", help="emit JSON")
    args = ap.parse_args(argv)

    site = args.site.rstrip(os.sep)
    if os.path.isfile(site):
        pages, base = [site], os.path.dirname(site) or "."
    else:
        if not os.path.isdir(site):
            raise SystemExit("audit: no such path: {0}".format(args.site))
        base = site
        pages = sorted(
            os.path.join(site, f) for f in os.listdir(site) if f.lower().endswith((".html", ".htm"))
        )

    if not pages:
        raise SystemExit("audit: no HTML files found in {0}".format(site))

    findings = []
    for page in pages:
        parser = PageParser(os.path.basename(page))
        with open(page, "r", encoding="utf-8", errors="replace") as fh:
            parser.feed(fh.read())
        parser.close()
        parser.finish()
        findings.extend(parser.findings)

    audit_css(args.css or os.path.join(base, "styles.css"), findings)

    fails = [f for f in findings if f.level == "FAIL"]
    warns = [f for f in findings if f.level == "WARN"]
    todo = [f for f in findings if f.level == "REPLACE"]

    if args.json:
        sys.stdout.write(json.dumps({
            "site": site,
            "pages": [os.path.basename(p) for p in pages],
            "pass": not fails,
            "counts": {"fail": len(fails), "warn": len(warns), "replace": len(todo)},
            "findings": [f.as_dict() for f in findings],
        }, indent=2) + "\n")
        return 1 if fails else 0

    group_order = ["html", "semantics", "a11y", "cta", "placeholder", "copy", "css", "motion", "responsive", "perf", "seo"]
    level_order = {"FAIL": 0, "WARN": 1, "REPLACE": 2}
    grouped = {}
    for f in findings:
        grouped.setdefault(f.group, []).append(f)

    def group_rank(name):
        return group_order.index(name) if name in group_order else len(group_order)

    for name in sorted(grouped, key=group_rank):
        sys.stdout.write("\n{0}\n{1}\n".format(name.upper(), "-" * len(name)))
        for f in sorted(grouped[name], key=lambda x: level_order[x.level]):
            tag = {"FAIL": "FAIL  ", "WARN": "warn  ", "REPLACE": "TODO  "}[f.level]
            sys.stdout.write("  {0} {1}  [{2}]\n".format(tag, f.msg, f.where or "-"))

    sys.stdout.write("\n{0} page(s) · {1} fail · {2} warn · {3} to replace\n".format(
        len(pages), len(fails), len(warns), len(todo)))

    if fails:
        sys.stdout.write("\nBUILD GATE FAILED — fix the {0} failure(s) above before handoff.\n".format(len(fails)))
    elif todo:
        sys.stdout.write("\nGate passed. {0} content placeholder(s) must be listed in the handoff checklist.\n".format(len(todo)))
    else:
        sys.stdout.write("\nGate passed. Site is ready for handoff.\n")
    sys.stdout.write("Still verify by eye at 375 / 768 / 1440, and re-run contrast.py on the final palette.\n")

    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
