#!/usr/bin/env python3
"""Compile the Creative Hub Kosovo CSO & CMO execution report into a branded PDF."""

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#0C1527")
NAVY_SOFT = colors.HexColor("#16233C")
GREEN = colors.HexColor("#16A34A")
GREEN_BRIGHT = colors.HexColor("#22C55E")
GREEN_TINT = colors.HexColor("#ECFDF3")
CHARCOAL = colors.HexColor("#1E293B")
SLATE = colors.HexColor("#475569")
MUTED = colors.HexColor("#64748B")
OFFWHITE = colors.HexColor("#F8FAFC")
LINE = colors.HexColor("#E2E8F0")
AMBER = colors.HexColor("#F59E0B")
WHITE = colors.white

WORKSPACE = Path(__file__).resolve().parents[1]
OUT = WORKSPACE / "creative_hub_gtm_agents_results.pdf"

styles = getSampleStyleSheet()


def S(name, **kw):
    kw.setdefault("name", name)
    return ParagraphStyle(**kw)


H_TITLE = S("HTitle", fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=WHITE)
H_SUB = S("HSub", fontName="Helvetica", fontSize=11.5, leading=16, textColor=colors.HexColor("#C7D2E0"))
H_META = S("HMeta", fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#8FA3BF"))

H1 = S("H1", fontName="Helvetica-Bold", fontSize=16.5, leading=20, textColor=NAVY, spaceBefore=4, spaceAfter=2)
H2 = S("H2", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=3)
H3 = S("H3", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=GREEN, spaceBefore=7, spaceAfter=2)

KICKER = S("Kicker", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=GREEN, spaceAfter=2)

BODY = S("Body", fontName="Helvetica", fontSize=9.6, leading=14, textColor=CHARCOAL, spaceAfter=5)
BODY_C = S("BodyC", parent=BODY, alignment=TA_CENTER)
LEAD = S("Lead", fontName="Helvetica", fontSize=10.8, leading=16, textColor=SLATE, spaceAfter=6)
SMALL = S("Small", fontName="Helvetica", fontSize=8.4, leading=12, textColor=MUTED)
SMALL_W = S("SmallW", parent=SMALL, textColor=colors.HexColor("#C7D2E0"))
BULLET = S("Bullet", parent=BODY, leftIndent=11, bulletIndent=2, spaceAfter=2.5)
METRIC_N = S("MetricN", fontName="Helvetica-Bold", fontSize=21, leading=23, textColor=GREEN, alignment=TA_CENTER)
METRIC_L = S("MetricL", fontName="Helvetica", fontSize=7.8, leading=10, textColor=SLATE, alignment=TA_CENTER)
METRIC_S = S("MetricS", fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=SLATE, alignment=TA_CENTER)
MAIL = S("Mail", fontName="Courier", fontSize=8.6, leading=12.6, textColor=CHARCOAL)
TH = S("TH", fontName="Helvetica-Bold", fontSize=8.4, leading=11, textColor=WHITE)
TD = S("TD", fontName="Helvetica", fontSize=8.4, leading=11.4, textColor=CHARCOAL)
TD_B = S("TDB", parent=TD, fontName="Helvetica-Bold")
CODE = S("Code", fontName="Courier", fontSize=8.2, leading=12, textColor=colors.HexColor("#0F172A"))
FOOT = S("Foot", fontName="Helvetica", fontSize=7.5, leading=10, textColor=MUTED, alignment=TA_CENTER)


def P(text, style=BODY):
    return Paragraph(text, style)


def bullets(items, style=BULLET):
    return [Paragraph(t, style, bulletText="\u2022") for t in items]


def callout(title, body, accent=GREEN, tint=GREEN_TINT):
    inner = [Paragraph(title, S("CT", fontName="Helvetica-Bold", fontSize=9.6, leading=13, textColor=accent, spaceAfter=3))]
    for para in body:
        inner.append(Paragraph(para, S("CB", fontName="Helvetica", fontSize=9.2, leading=13.6, textColor=CHARCOAL)))
    t = Table([[inner]], colWidths=[168 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6E9DE")),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def mail_block(lines):
    body = [[Preformatted("\n".join(lines), MAIL)]]
    t = Table(body, colWidths=[168 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def scorecards(cards):
    cells = []
    for value, label in cards:
        cells.append([Paragraph(value, METRIC_N), Paragraph(label, METRIC_L)])
    row = [[Table([[c[0]], [c[1]]], style=TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ])) for c in cells]]
    t = Table(row, colWidths=[168 * mm / len(cells)] * len(cells))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), OFFWHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def data_table(header, rows, widths, highlight_rows=None, score_col=None):
    data = [[Paragraph(h, TH) for h in header]]
    for r in rows:
        data.append([c if not isinstance(c, str) else Paragraph(c, TD) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, OFFWHITE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    t.setStyle(TableStyle(style))
    return t


def section_bar(number, title):
    t = Table(
        [[Paragraph(f"<font color='#22C55E'>{number}</font>", S("SN", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=GREEN_BRIGHT)),
          Paragraph(title, S("ST", fontName="Helvetica-Bold", fontSize=13.5, leading=17, textColor=WHITE))]],
        colWidths=[12 * mm, 156 * mm],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("LEFTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def flow_diagram():
    def node(kicker, title, sub, fill, fg, width):
        return Table(
            [[Paragraph(kicker, S("FK", fontName="Helvetica-Bold", fontSize=6.8, leading=9, textColor=fg))],
             [Paragraph(title, S("FT", fontName="Helvetica-Bold", fontSize=9, leading=11.5, textColor=fg))],
             [Paragraph(sub, S("FS", fontName="Helvetica", fontSize=7.2, leading=9.5, textColor=fg))]],
            colWidths=[width],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#94A3B8") if fill == WHITE else fill),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (0, 0), 7),
                ("BOTTOMPADDING", (0, 2), (0, 2), 8),
                ("TOPPADDING", (0, 1), (0, 2), 1),
            ]),
        )

    w = 46 * mm
    n1 = node("TRIGGER", "Lead Gen + CMO Social", "Cold email drafts, reels, LinkedIn", WHITE, NAVY, w)
    n2 = node("ENTRY", "Website Landing Page", "hubsy widget + application form", WHITE, NAVY, w)
    n3 = node("CONVERT", "Hubsy AI Assistant", "Pose-5 mascot, 2-3s typing delay, 15-month installments", GREEN, WHITE, w)
    n4 = node("BOOK", "Leonita / Flaka", "Calendly 20-min consultation", NAVY, WHITE, w)

    arrow = lambda: Paragraph("<font color='#16A34A'><b>&#8594;</b></font>",
                              S("AR", fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=GREEN, alignment=TA_CENTER))

    t = Table([[n1, arrow(), n2, arrow(), n3, arrow(), n4]],
              colWidths=[w, 8 * mm, w, 8 * mm, w, 8 * mm, w])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(21 * mm, 15 * mm, 189 * mm, 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(21 * mm, 10.5 * mm, "Creative Hub Kosovo  ·  CSO & CMO Autonomous Execution Report  ·  October 2026")
    canvas.drawRightString(189 * mm, 10.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    canvas.setFillColor(GREEN)
    canvas.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, stroke=0, fill=1)
    canvas.setFillColor(GREEN_BRIGHT)
    canvas.rect(0, 0, A4[0], 4 * mm, stroke=0, fill=1)
    canvas.setStrokeColor(colors.HexColor("#1E2E4A"))
    canvas.setLineWidth(0.7)
    for y in range(int(120 * mm), int(260 * mm), 22):
        canvas.line(21 * mm, y, 60 * mm, y)
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=21 * mm,
        rightMargin=21 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title="Creative Hub Kosovo — CSO & CMO Autonomous Execution Report",
        author="Creative Hub Kosovo · AI OS",
        subject="CSO & CMO agent results, lead scoring, outreach drafts, 1-week content strategy",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=cover),
        PageTemplate(id="inner", frames=[frame], onPage=footer),
    ])

    e = []

    # ---------------- COVER ----------------
    e.append(Spacer(1, 42 * mm))
    e.append(Paragraph("CREATIVE HUB KOSOVO", S("eye", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=GREEN_BRIGHT)))
    e.append(Spacer(1, 5 * mm))
    e.append(Paragraph("CSO &amp; CMO<br/>Autonomous Execution Report", H_TITLE))
    e.append(Spacer(1, 6 * mm))
    e.append(Paragraph(
        "Real Research Findings, Qualified Lead Scores, Outreach Drafts "
        "&amp; CMO 1-Week Strategy", H_SUB))
    e.append(Spacer(1, 10 * mm))
    e.append(Table([[""]], colWidths=[46 * mm], rowHeights=[2.6], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_BRIGHT), ("LINEBELOW", (0, 0), (-1, -1), 2.6, GREEN_BRIGHT)])))
    e.append(Spacer(1, 10 * mm))
    for line in [
        "October 2026",
        "Platform: AI OS — Antigravity IDE &amp; Playwright",
        "Agents in scope: CSO · Lead Gen · CMO · Content Planner",
        "Prepared for internal review — drafts only, nothing sent",
    ]:
        e.append(Paragraph(line, H_META))
        e.append(Spacer(1, 1.6 * mm))
    e.append(Spacer(1, 30 * mm))
    cover_cards = scorecards([
        ("3", "QUALIFIED LEADS"),
        ("18", "PUBLIC SOURCES REVIEWED"),
        ("0", "LOGINS USED"),
        ("3", "POSTS SCHEDULED"),
    ])
    e.append(cover_cards)
    e.append(NextPageTemplate("inner"))
    e.append(PageBreak())

    # ---------------- EXECUTIVE SNAPSHOT ----------------
    e.append(Paragraph("EXECUTIVE SNAPSHOT", KICKER))
    e.append(Paragraph("What the agents actually produced", H1))
    e.append(Paragraph(
        "Two autonomous agents ran end to end. The CSO planned and delegated a prospecting brief; "
        "the Lead Gen Agent researched public pages with Playwright and returned scored leads plus "
        "outreach drafts. The CMO did the same for content, returning a one-week calendar with hooks, "
        "captions and coordinator booking CTAs. Everything below is the real output, not a template.", LEAD))
    e.append(Spacer(1, 3 * mm))
    e.append(scorecards([
        ("92", "TOP LEAD SCORE"),
        ("18", "CSO PAGES SCANNED"),
        ("18", "CMO SOURCES REVIEWED"),
        ("0", "LOGIN WALLS CROSSED"),
    ]))
    e.append(Spacer(1, 4 * mm))
    e.append(callout("Headline result", [
        "The Lead Gen Agent found three real Kosovo/Albania prospects in executive coaching and HR tech, "
        "led by XPR Consulting at a fit score of 92. Draft outreach for XPR references a specific line "
        "from their own executive development page, and is ready for a human to review and send.",
        "The Content Planner answered a saturated \u201clearn AI\u201d feed with two market objections, "
        "producing three execution-ready posts targeting three inbound consultations in one week.",
    ]))

    # ---------------- PART 1 ----------------
    e.append(Spacer(1, 7 * mm))
    e.append(section_bar("01", "CSO &amp; LEAD GEN AGENT — Explicit Results"))
    e.append(Spacer(1, 4 * mm))
    e.append(Paragraph("Execution metrics", H2))
    e.append(scorecards([
        ("18", "PUBLIC PAGES REVIEWED"),
        ("0", "LOGINS USED"),
        ("3", "QUALIFIED LEADS"),
        ("1", "DRAFT SET READY"),
    ]))
    e.append(Spacer(1, 3 * mm))
    e.append(Paragraph(
        "The Lead Gen Agent stayed strictly on open public sources. Search results pointing at LinkedIn "
        "profile pages were identified as login-walled and skipped without any attempt to authenticate, "
        "so all depth came from the prospects' own websites.", BODY))

    e.append(Paragraph("Scored lead table", H2))
    e.append(data_table(
        ["Score", "Prospect", "Location", "Space", "Primary target / focus"],
        [
            [Paragraph("<b>92</b>", S("s92", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=GREEN)),
             Paragraph("<b>XPR Consulting L.L.C</b>", TD_B),
             "Prishtina, Kosovo",
             "Executive development &amp; leadership academies",
             "HR / people-ops buyers matching the HR + AI Academy"],
            [Paragraph("<b>88</b>", S("s88", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=GREEN)),
             Paragraph("<b>HR Bee Management LLC</b>", TD_B),
             "Prishtina, Kosovo",
             "Cloud HR management software",
             "Jobseeker base &amp; student placement pipeline"],
            [Paragraph("<b>74</b>", S("s74", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=colors.HexColor("#B45309"))),
             Paragraph("<b>DIMENSION HR</b>", TD_B),
             "Tirana, Albania",
             "HR consulting, executive search, training",
             "Co-delivery / partnership model"],
        ],
        widths=[15 * mm, 40 * mm, 26 * mm, 40 * mm, 47 * mm],
    ))
    e.append(Spacer(1, 2 * mm))
    e.append(Paragraph(
        "Public channels captured: info@xpr-consulting.com · +383 44 403 166  |  "
        "info@hr-bee.com · 038 78 99 99  |  info@dimensionhr.al", SMALL))

    e.append(Paragraph("The specific website observation that unlocked the best lead", H2))
    e.append(callout(
        "Found on XPR Consulting's executive development page",
        ["\u201cthe best technician became the supervisor, the most loyal person became the manager, "
         "and nobody was taught the job.\u201d",
         "This is the single most specific detail captured in research. It names the exact gap the "
         "HR + AI Academy addresses one layer below leadership, and it is the line the cold email opens on."],
        accent=AMBER, tint=colors.HexColor("#FFFBEB")))

    e.append(Spacer(1, 5 * mm))
    e.append(Paragraph("Draft 1 — Cold email to XPR Consulting", H2))
    e.append(data_table(
        ["Field", "Value"],
        [
            [Paragraph("<b>To</b>", TD), "info@xpr-consulting.com"],
            [Paragraph("<b>From (human sender)</b>", TD), "Leonita Krasniqi, Creative Hub Kosovo"],
            [Paragraph("<b>Subject</b>", TD), "<b>the manager who was never taught to manage</b>"],
            [Paragraph("<b>Language</b>", TD), "English"],
            [Paragraph("<b>Source</b>", TD), "xpr-consulting.com/services/executive-development/"],
        ],
        widths=[42 * mm, 126 * mm],
    ))
    e.append(Spacer(1, 3 * mm))
    e.append(mail_block([
        "Hi,",
        "",
        "I read the opening of your executive development page, the part about the",
        "best technician becoming the supervisor and the most loyal person becoming",
        "the manager, and nobody ever being taught how to do either job. That is the",
        "same pattern we built our Human Resources + AI Academy around, just one",
        "layer earlier.",
        "",
        "Creative Hub Kosovo runs practical, U.S.-certified academies in Prishtina.",
        "The HR + AI program covers people operations, recruitment, and the AI tools",
        "now expected inside HR teams, with real projects rather than slideware. Your",
        "clients feel the gap at the leadership layer. Ours sits at the HR and",
        "people-ops layer feeding it.",
        "",
        "Would a 20-minute call with Leonita, our HR academy coordinator, be useful",
        "to see whether a referral or co-delivery arrangement makes sense? No deck,",
        "just the two curriculums side by side.",
        "",
        "Best,",
        "[Name]",
        "Creative Hub Kosovo",
    ]))

    e.append(Spacer(1, 5 * mm))
    e.append(Paragraph("Draft 2 — Follow-up, day 5", H2))
    e.append(data_table(
        ["Field", "Value"],
        [
            [Paragraph("<b>Send timing</b>", TD), "Day 5 after the cold email if no reply"],
            [Paragraph("<b>Language</b>", TD), "English"],
            [Paragraph("<b>Angle</b>", TD), "HR + AI module list and two student project examples"],
        ],
        widths=[42 * mm, 126 * mm],
    ))
    e.append(Spacer(1, 3 * mm))
    e.append(mail_block([
        "Hi,",
        "",
        "One more thought after your leadership academy page. The managers you",
        "develop inherit HR processes built by people who, in your own words, were",
        "never taught the job. That is usually where the AI expectations land first:",
        "job descriptions, screening, performance notes.",
        "",
        "If it helps, I can send the HR + AI module list and two student project",
        "examples. If the timing is wrong, no problem at all.",
        "",
        "Best,",
        "[Name]",
    ]))

    e.append(Spacer(1, 5 * mm))
    e.append(Paragraph("CSO strategic notes", H2))
    for b in bullets([
        "<b>Pitch partnership, not competition.</b> XPR and DIMENSION HR both sell training. "
        "Position Creative Hub as a referral or co-delivery partner, never as a rival offer.",
        "<b>HR Bee is a small team (0–10 employees per its public STIKK listing).</b> A team-enrollment "
        "pitch is weak. Lead with their jobseeker base and HR client base instead.",
        "<b>Sender configuration required before sending.</b> The drafts carry a [Name] placeholder; "
        "confirm the sending human and that the partnership framing is approved.",
        "<b>General inboxes.</b> All three are public general addresses. A human should verify a named "
        "contact on LinkedIn before the first send.",
        "<b>No invented facts.</b> The drafts contain no prices, dates, or enrollment claims beyond the "
        "public curriculum description. Add numbers only from the knowledge base if desired.",
    ]):
        e.append(b)

    e.append(PageBreak())

    # ---------------- PART 2 ----------------
    e.append(section_bar("02", "CMO &amp; CONTENT PLANNER — 1-Week Strategy"))
    e.append(Spacer(1, 4 * mm))
    e.append(Paragraph("Research &amp; execution summary", H2))
    e.append(scorecards([
        ("18", "PUBLIC SOURCES"),
        ("0", "LOGINS USED"),
        ("3", "POSTS SCHEDULED"),
        ("3", "TARGET BOOKINGS"),
    ]))
    e.append(Spacer(1, 3 * mm))
    for b in bullets([
        "18 public sources reviewed with zero-login Playwright research across tech education and "
        "career-transition content.",
        "Visual references saved to <font face='Courier'>inspo/2026-10-20-data-vibe-week.md</font> "
        "(committed <font face='Courier'>fca9724</font>).",
        "Every caption ends in a single coordinator booking CTA — Flaka for Vibe Coding, "
        "Leonita for Data Science &amp; AI.",
    ]):
        e.append(b)

    e.append(Paragraph("Core research insight", H2))
    e.append(callout("The feed is saturated — so do not add another \u201clearn AI\u201d post", [
        "The public feed is flooded with generic beginner tutorials. This strategy instead attacks the "
        "two objections that actually stop a purchase:",
        "\u201cIs a data career still worth it?\u201d and \u201cEveryone can vibe code now, so why train?\u201d",
        "Each post names the fear and answers it with proof — portfolio projects, a real screen recording, "
        "and a named coordinator to book.",
    ]))

    e.append(Paragraph("Campaign strategic focus", H2))
    e.append(Paragraph(
        "Drive <b>3 qualified inbound consultations per week</b> for the Data Science &amp; AI and "
        "Vibe Coding academies. Three posts, one week, two channels (Instagram Reels in Albanian, "
        "LinkedIn in English).", BODY))

    e.append(Paragraph("1-week content matrix", H2))

    def post_card(index, when, channel, academy, lang, hook, caption, cta):
        head = Table(
            [[Paragraph(f"POST {index}", S("pi", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=WHITE)),
              Paragraph(when, S("pw", fontName="Helvetica-Bold", fontSize=9, leading=11.5, textColor=WHITE)),
              Paragraph(f"{channel}  ·  {academy}  ·  {lang}", S("pc", fontName="Helvetica", fontSize=8.4, leading=11, textColor=GREEN_BRIGHT))]],
            colWidths=[20 * mm, 62 * mm, 86 * mm],
        )
        head.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), NAVY),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        body = [
            Paragraph("HOOK", S("hl", fontName="Helvetica-Bold", fontSize=7.6, leading=9.5, textColor=GREEN)),
            Paragraph(hook, S("hv", fontName="Helvetica-Bold", fontSize=10, leading=13.5, textColor=NAVY, spaceAfter=6)),
            Paragraph("CAPTION", S("cl", fontName="Helvetica-Bold", fontSize=7.6, leading=9.5, textColor=GREEN)),
            Paragraph(caption, S("cv", fontName="Helvetica", fontSize=8.8, leading=12.6, textColor=CHARCOAL, spaceAfter=6)),
            Paragraph("CTA", S("ctl", fontName="Helvetica-Bold", fontSize=7.6, leading=9.5, textColor=GREEN)),
            Paragraph(cta, S("ctv", fontName="Courier-Bold", fontSize=8.6, leading=12, textColor=colors.HexColor("#15803D"))),
        ]
        box = Table([[body]], colWidths=[168 * mm])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), WHITE),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 11),
            ("RIGHTPADDING", (0, 0), (-1, -1), 11),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        return KeepTogether([head, box, Spacer(1, 4 * mm)])

    e.append(post_card(
        1, "Wed 21 Oct, 19:30", "Instagram Reel", "Vibe Coding", "SQ",
        "Në Prishtinë të gjithë \u2018ndërtojnë me AI\u2019. Punësohen ata që dinë ta rregullojnë kur prishet.",
        "Prompti e bën çdo njeri. Puna e vërtetë nis kur aplikacioni thyhet dhe dikush duhet ta kuptojë pse. "
        "Vibe Coding Mastery: 9 javë, 16 sesione live, 8 dorëzime reale. Bisedo 20 minuta me Flakën — linku në bio.",
        "Flaka · https://calendly.com/flaka-creativehub/30min",
    ))
    e.append(post_card(
        2, "Fri 23 Oct, 09:00", "LinkedIn", "Data Science &amp; AI", "EN",
        "Data analyst roles aren\u2019t dying. The job description changed, and most courses didn\u2019t.",
        "The entry-level job that only asked for Excel and a certificate is gone. What replaced it asks for SQL, "
        "Python, a BI tool, and enough AI literacy to sanity-check the model. Then it asks for proof. Certificate "
        "says you attended; portfolio says what you can do on a Monday morning. Data Science &amp; Analytics + AI: "
        "18 weeks, 8 modules, 7 portfolio projects, hybrid Prishtina or online, U.S. certificate. Book 20 minutes "
        "with Leonita — she\u2019ll answer honestly.",
        "Leonita · https://calendly.com/leonita-creativehubkos/30min",
    ))
    e.append(post_card(
        3, "Sun 25 Oct, 11:00", "Instagram Reel", "Data Science &amp; AI", "SQ",
        "Pyet një punëdhënës çfarë hap i pari: certifikatën apo portofolin.",
        "Përgjigjja e sinqertë: portofolin. Certifikata të hap derën, projektet të mbajnë brenda. Studentët "
        "mbarojnë me 7 projekte reale. Bisedo 20 minuta me Leonitën — linku në bio.",
        "Leonita · https://calendly.com/leonita-creativehubkos/30min",
    ))

    e.append(Paragraph("Funnel math &amp; conversion rules", H2))
    e.append(flow_line := data_table(
        ["Stage", "Volume", "Assumption"],
        [
            [Paragraph("<b>Surfaces</b>", TD), "6", "3 posts × 2 channels of distribution"],
            [Paragraph("<b>Reach</b>", TD), "4,000 – 6,000", "Combined organic reach for the week"],
            [Paragraph("<b>Site / profile visits</b>", TD), "60 – 90", "≈1.5% click-through"],
            [Paragraph("<b>Consultation bookings</b>", TD), "<b>3</b>", "≈5% booking intent"],
        ],
        widths=[52 * mm, 40 * mm, 76 * mm],
    ))
    e.append(Spacer(1, 3 * mm))
    e.append(callout("Reply rule", [
        "Reply once to every comment with the booking link, within 60 minutes of the comment. "
        "One reply, one link — never repeat the same link in a thread.",
    ], accent=GREEN))

    e.append(Paragraph("Execution watch-outs", H2))
    for b in bullets([
        "<b>Vibe Coding starts March 2027.</b> Do not imply imminent seats or a closing window.",
        "<b>Student footage needs permission and anonymization</b> before any project is shown on screen.",
        "<b>Both reels need real screen recordings</b> — a broken app being fixed, and a scroll through "
        "real dashboards. Stock footage is not a fallback.",
        "<b>Test both Calendly links on mobile</b> before publishing.",
    ]):
        e.append(b)

    e.append(Paragraph("References", H2))
    e.append(Paragraph(
        "Beat sheets, asset notes and full caption drafts: "
        "<font face='Courier'>.agent/content-planner/output/run-2026-10-20-data-vibe-week/drafts/</font>. "
        "Visual references: <font face='Courier'>inspo/2026-10-20-data-vibe-week.md</font>.", BODY))

    e.append(PageBreak())

    # ---------------- PART 3 ----------------
    e.append(section_bar("03", "End-to-End Inbound Conversion Flow"))
    e.append(Spacer(1, 4 * mm))
    e.append(Paragraph(
        "Both agents feed a single path: cold outreach and social content create the trigger, the landing "
        "page captures the visitor, Hubsy qualifies them in Albanian or English, and a named coordinator "
        "closes with a booked call.", LEAD))
    e.append(Spacer(1, 5 * mm))
    e.append(flow_diagram())
    e.append(Spacer(1, 7 * mm))
    e.append(data_table(
        ["Stage", "What happens", "Owned by"],
        [
            [Paragraph("<b>Lead Gen / CMO Social</b>", TD),
             "Scored prospects receive drafted outreach; reels and LinkedIn posts drive organic traffic to the same destination.",
             "CSO + CMO agents"],
            [Paragraph("<b>Website Landing Page</b>", TD),
             "Visitor lands on creativehubkos.com, reads the program and opens the Hubsy widget or the application form.",
             "Marketing site"],
            [Paragraph("<b>Hubsy AI Assistant</b>", TD),
             "Pose-5 mascot greets with a 2–3s typing delay, answers in one language only, explains the 15-month installments, and routes to the right coordinator.",
             "Hubsy agent"],
            [Paragraph("<b>Direct Booking</b>", TD),
             "One-click Calendly booking with Leonita for Data Science &amp; AI, or Flaka for Vibe Coding.",
             "Human coordinators"],
        ],
        widths=[38 * mm, 100 * mm, 30 * mm],
    ))

    e.append(Spacer(1, 8 * mm))
    e.append(callout("Status", [
        "Nothing has been sent, published, or booked by the agents. All outreach and content in this "
        "report is in draft form and is waiting for human review.",
        "Generated by the AI OS agents on Antigravity IDE with Playwright. October 2026.",
    ], accent=NAVY, tint=OFFWHITE))

    doc.build(e)
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    build()
