#!/usr/bin/env python3
"""Audit the brand theme tokens: WCAG contrast + colorblind confusability.

Parses the live theme (:root + .dark in src/app.css) and, if present, any
[data-brand=...] evaluation blocks. Checks the standard shadcn token pairs
against WCAG AA and simulates protanopia/deuteranopia/tritanopia to flag
hue-only distinctions between semantic colors (primary / accent /
destructive / highlight). Keep this at 0 failures after ANY token edit —
this is the accessibility contract documented in app.css and CLAUDE.md.

Three families of check, each of which can fail the exit code:

1. TEXT_PAIRS — opaque token-on-token pairs (`text-foreground` on `bg-card`).
2. COMPOSITED_PAIRS — translucent recipes (`text-primary` on `bg-primary/10`
   over `bg-card`). See that list's own comment. This family exists because
   alpha over a surface is exactly where AA fails silently: hand-computed
   ratios written into code comments were wrong repeatedly during the 2026-08
   rebrand (a claimed "3.1" that measured 2.95; a ToneTile table that did not
   reproduce; an 18.46 that was really 17.46) because nothing executed them.
   These entries execute them. Issue #783.
3. Color-blind separation between the semantic colors.

When you add a translucent recipe to a component, add it here too and let the
script produce the number for the comment, rather than the other way round.
"""

import re
import sys
from pathlib import Path

CSS = Path(sys.argv[1] if len(sys.argv) > 1 else "src/app.css").read_text()


def hsl_to_rgb(h, s, ll):
    s, ll = s / 100, ll / 100
    c = (1 - abs(2 * ll - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = ll - c / 2
    r, g, b = (
        (c, x, 0) if h < 60 else (x, c, 0) if h < 120 else (0, c, x) if h < 180 else
        (0, x, c) if h < 240 else (x, 0, c) if h < 300 else (c, 0, x)
    )
    return tuple(round((v + m) * 255) for v in (r, g, b))


def srgb_lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = (srgb_lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(rgb1, rgb2):
    l1, l2 = luminance(rgb1), luminance(rgb2)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


# --- Colorblind simulation (Viénot/Brettel via linear-RGB matrices) ---
CVD = {
    "protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def simulate(rgb, kind):
    lin = [srgb_lin(c) for c in rgb]
    m = CVD[kind]
    out = [sum(m[i][j] * lin[j] for j in range(3)) for i in range(3)]
    def delin(c):
        c = max(0.0, min(1.0, c))
        return round(255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055))
    return tuple(delin(c) for c in out)


def deltaE(rgb1, rgb2):
    """Rough perceptual distance (redmean)."""
    r1, g1, b1 = rgb1
    r2, g2, b2 = rgb2
    rm = (r1 + r2) / 2
    dr, dg, db = r1 - r2, g1 - g2, b1 - b2
    return ((2 + rm / 256) * dr**2 + 4 * dg**2 + (2 + (255 - rm) / 256) * db**2) ** 0.5


# --- Parse CSS ---
themes = {}  # (brand, mode) -> {token: (h,s,l)}


def parse_tokens(body):
    toks = {}
    for tm in re.finditer(r"--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;", body):
        toks[tm.group(1)] = (float(tm.group(2)), float(tm.group(3)), float(tm.group(4)))
    return toks


# The live theme: :root (light) and .dark blocks.
for sel, mode in ((r":root", "light"), (r"\.dark", "dark")):
    for m in re.finditer(sel + r"\s*\{([^}]+)\}", CSS):
        toks = parse_tokens(m.group(1))
        if toks:
            themes.setdefault(("default", mode), {}).update(toks)

# Optional evaluation themes ([data-brand=...] blocks), if the file has any.
for m in re.finditer(r"\[data-brand='(\w+)'\](\.dark)?\s*(?:body\s*)?\{([^}]+)\}", CSS):
    brand, dark, body = m.group(1), bool(m.group(2)), m.group(3)
    key = (brand, "dark" if dark else "light")
    toks = parse_tokens(body)
    if toks:
        themes.setdefault(key, {}).update(toks)

# dark inherits unset tokens from light
for brand in {b for b, _ in themes}:
    if (brand, "dark") in themes and (brand, "light") in themes:
        merged = dict(themes[(brand, "light")])
        merged.update(themes[(brand, "dark")])
        themes[(brand, "dark")] = merged

TEXT_PAIRS = [  # (fg, bg, min_ratio, note)
    ("foreground", "background", 4.5, "body text"),
    ("card-foreground", "card", 4.5, "card text"),
    ("popover-foreground", "popover", 4.5, "popover text"),
    ("primary-foreground", "primary", 4.5, "primary button label"),
    ("secondary-foreground", "secondary", 4.5, "secondary button label"),
    ("muted-foreground", "muted", 4.5, "muted text on muted bg"),
    ("muted-foreground", "background", 4.5, "muted text on page"),
    ("muted-foreground", "card", 4.5, "muted text on card"),
    ("accent-foreground", "accent", 4.5, "accent label"),
    ("highlight-foreground", "highlight", 4.5, "highlight label"),
    ("destructive-foreground", "destructive", 4.5, "destructive label"),
    ("success-foreground", "success", 4.5, "success badge label"),
    ("info-foreground", "info", 4.5, "info badge label"),
    ("success", "background", 3.0, "success as icon/accent on page"),
    ("success", "card", 3.0, "success as icon/accent on card"),
    ("info", "background", 3.0, "info as icon/accent on page"),
    ("info", "card", 3.0, "info as icon/accent on card"),
    ("primary", "background", 3.0, "primary as text-primary/link on page"),
    ("primary", "card", 3.0, "primary on card"),
    ("ring", "background", 3.0, "focus ring visibility"),
    ("border", "background", 1.3, "border visibility (advisory)"),
    # Poster panels (landing page). Same in dark mode by design.
    ("poster-ink", "poster-amber", 4.5, "poster pricing panel body"),
    ("poster-ink", "poster-periwinkle", 4.5, "poster communities panel body"),
    ("poster-ink", "poster-paper", 4.5, "poster features panel body"),
    ("poster-white", "poster-crimson-deep", 4.5, "poster venues panel body"),
    ("poster-white", "poster-ink", 4.5, "poster open source panel body"),
    ("poster-white", "poster-purple", 4.5, "poster close panel body"),
    ("poster-purple", "poster-white", 4.5, "sticker text on white sticker"),
    ("poster-crimson-deep", "poster-white", 4.5, "sticker text on white sticker"),
    ("poster-ink", "poster-lavender", 4.5, "identity tile: ink icon on lavender"),
]

BOTH = ("light", "dark")

# --- Composited-alpha pairs (issue #783) ---
#
# A translucent layer has no token of its own, so TEXT_PAIRS above cannot see
# it: `bg-primary/10` on a card is neither `primary` nor `card`, it is a third
# color that only exists at paint time. Every entry below is a recipe that ships
# in a component, resolved the way the browser resolves it:
#
#     surface = wash_alpha * wash + (1 - wash_alpha) * base   (wash None -> base)
#     ink     = fg_alpha   * fg   + (1 - fg_alpha)   * surface
#     contrast(ink, surface) >= need
#
# Fields: (fg, fg_alpha, wash, wash_alpha, base, need, modes, note).
#   need  4.5 for text, 3.0 for icons/borders (WCAG 1.4.11 non-text).
#   modes some recipes are one-sided — a `dark:` variant that swaps the tint or
#         the foreground means the light and dark rows are DIFFERENT recipes,
#         not one recipe measured twice.
#
# Deliberate limits: exactly one wash layer (the two stacked-tint sites, e.g.
# ImpersonationBanner's chip-on-banner, are not expressible and stay hand-
# checked), and only token-valued colors — one-off `bg-[hsl(...)]` literals that
# do not resolve to a token cannot be audited from app.css alone.
COMPOSITED_PAIRS = [
    # ToneTile (common/ToneTile.svelte) — soft icon tiles. Icons: 3:1 floor.
    ("primary", 1, "primary", 0.10, "background", 3.0, BOTH, "ToneTile brand on page"),
    ("primary", 1, "primary", 0.10, "card", 3.0, BOTH, "ToneTile brand on card"),
    ("info", 1, "info", 0.10, "background", 3.0, BOTH, "ToneTile info on page"),
    ("info", 1, "info", 0.10, "card", 3.0, BOTH, "ToneTile info on card"),
    ("success", 1, "success", 0.10, "background", 3.0, BOTH, "ToneTile success on page"),
    ("success", 1, "success", 0.10, "card", 3.0, BOTH, "ToneTile success on card"),
    ("highlight-foreground", 1, "highlight", 0.20, "background", 3.0, ("light",), "ToneTile warning on page (light: amber itself is 1.8:1)"),
    ("highlight-foreground", 1, "highlight", 0.20, "card", 3.0, ("light",), "ToneTile warning on card"),
    ("highlight", 1, "highlight", 0.20, "background", 3.0, ("dark",), "ToneTile warning on page"),
    ("highlight", 1, "highlight", 0.20, "card", 3.0, ("dark",), "ToneTile warning on card"),
    # Tag chips — EventCard / EventSeriesCard / OrganizationCard. Bold 12px: text.
    ("primary", 1, "primary", 0.10, "card", 4.5, BOTH, "tag chip label on a card"),
    # Stat/banner tints. AttendeeStats keeps an opaque bg-card UNDER the success
    # tint precisely because the same tint over --background measures 4.39:1.
    ("success", 1, "success", 0.10, "card", 4.5, BOTH, "AttendeeStats/EventWizard success stat (opaque card layer)"),
    ("highlight-foreground", 1, "highlight", 0.10, "background", 4.5, ("light",), "AttendeeStats maybe stat"),
    ("highlight", 1, "highlight", 0.10, "background", 4.5, ("dark",), "AttendeeStats maybe stat"),
    # Info / highlight banners (MyTicket on a card, MyTicketModal on a dialog).
    ("info", 1, "info", 0.10, "card", 4.5, BOTH, "MyTicket info banner"),
    ("info", 1, "info", 0.10, "background", 4.5, BOTH, "MyTicketModal / DemoBanner info banner"),
    ("highlight-foreground", 1, "highlight", 0.20, "card", 4.5, ("light",), "MyTicket warning banner"),
    ("highlight", 1, "highlight", 0.20, "card", 4.5, ("dark",), "MyTicket warning banner"),
    ("highlight-foreground", 1, "highlight", 0.20, "background", 4.5, ("light",), "MyTicketModal warning banner"),
    ("highlight", 1, "highlight", 0.20, "background", 4.5, ("dark",), "MyTicketModal warning banner"),
    # Dietary/EventDetails cells: body copy stays on --foreground over the tint.
    ("foreground", 1, "destructive", 0.20, "card", 4.5, BOTH, "DietarySummary allergen cell"),
    ("foreground", 1, "destructive", 0.10, "card", 4.5, BOTH, "DietarySummary restriction cell"),
    ("foreground", 1, "highlight", 0.10, "card", 4.5, BOTH, "DietarySummary / EventActionSidebar note"),
    ("highlight-foreground", 1, "highlight", 0.10, "card", 4.5, ("light",), "EventDetails highlight cell"),
    ("highlight", 1, "highlight", 0.10, "card", 4.5, ("dark",), "EventDetails highlight cell"),
    # Selected-option fills: the label stays --foreground, the BORDER carries the
    # selection, so the 3:1 non-text floor is the one that matters.
    ("primary", 1, "primary", 0.10, "card", 3.0, BOTH, "QuestionnaireFillForm/PollVoteForm selected border"),
    ("foreground", 1, "primary", 0.10, "card", 4.5, BOTH, "QuestionnaireFillForm/PollVoteForm selected label"),
    ("foreground", 1, "success", 0.10, "background", 4.5, BOTH, "RSVPButtons / EventRSVP unselected tint"),
    ("foreground", 1, "destructive", 0.10, "background", 4.5, BOTH, "RSVPButtons / EventRSVP unselected tint"),
    # Public page wash: bg-secondary/55, thinned to /28 in dark.
    ("foreground", 1, "secondary", 0.55, "background", 4.5, ("light",), "public page secondary wash"),
    ("muted-foreground", 1, "secondary", 0.55, "background", 4.5, ("light",), "muted copy on the secondary wash"),
    ("primary", 1, "secondary", 0.55, "background", 3.0, ("light",), "links on the secondary wash"),
    ("foreground", 1, "secondary", 0.28, "background", 4.5, ("dark",), "public page secondary wash"),
    ("muted-foreground", 1, "secondary", 0.28, "background", 4.5, ("dark",), "muted copy on the secondary wash"),
    ("primary", 1, "secondary", 0.28, "background", 3.0, ("dark",), "links on the secondary wash"),
    # Footer cookie notice: a DOUBLE composite — a --background/10 panel on the
    # opaque ink band, with --background/90 text measured over that panel (the
    # full-opacity number, 11.85:1, was quoted here once and was wrong).
    ("background", 0.90, "background", 0.10, "poster-ink", 4.5, ("light",), "footer cookie notice"),
    ("muted-foreground", 1, "muted", 0.50, "card", 4.5, ("dark",), "footer cookie notice"),
    # Poster / seat-map surfaces. Mode-inert by design (fixed brand values), so
    # both modes are checked and must agree.
    ("poster-ink", 0.72, None, 0, "poster-white", 4.5, BOTH, "poster mock body copy (ink @72%)"),
    ("poster-white", 0.50, None, 0, "poster-ink", 4.5, BOTH, "open-source panel meta label (white @50%)"),
    ("poster-white", 0.80, None, 0, "poster-ink", 4.5, BOTH, "poster panel secondary copy (white @80%)"),
    ("poster-white", 1, "poster-white", 0.14, "poster-ink", 4.5, BOTH, "seat-map stage pill / legend strip"),
    ("poster-white", 1, "poster-white", 0.12, "poster-ink", 4.5, BOTH, "seat-map zone chip"),
    ("poster-ink", 1, "poster-white", 0.95, "poster-crimson-deep", 4.5, BOTH, "venues panel pill"),
    ("poster-white", 1, "poster-ink", 0.20, "poster-purple", 4.5, BOTH, "hero panel stat wash (purple end)"),
    ("poster-white", 1, "poster-ink", 0.20, "poster-crimson-deep", 4.5, BOTH, "hero panel stat wash (crimson end)"),
    ("poster-white", 1, "poster-ink", 0.85, "poster-lavender", 4.5, BOTH, "event header scrim (top, lightest ramp stop)"),
    ("poster-white", 1, "poster-ink", 0.45, "poster-lavender", 4.5, BOTH, "event header scrim (mid-gradient)"),
]

SEMANTIC = ["primary", "secondary", "accent", "destructive", "highlight", "success", "info"]
SEMANTIC_EXEMPT = set()  # pairs that are the same semantic in two roles; see issue #781


def blend(over, alpha, base):
    """Paint `over` at `alpha` on an opaque `base`, the way a browser does."""
    return tuple(alpha * o + (1 - alpha) * b for o, b in zip(over, base))

failures = 0
confusables = 0
for (brand, mode), toks in sorted(themes.items()):
    print(f"\n=== {brand} / {mode} ===")
    rgb = {k: hsl_to_rgb(*v) for k, v in toks.items() if k not in ("radius",)}
    for fg, bg, need, note in TEXT_PAIRS:
        if fg not in rgb or bg not in rgb:
            continue
        r = contrast(rgb[fg], rgb[bg])
        ok = r >= need
        if not ok:
            failures += 1
        print(f"  {'PASS' if ok else 'FAIL'}  {r:5.2f} (need {need})  {fg} on {bg}  [{note}]")
    # Composited-alpha recipes (issue #783): resolve the translucent layers,
    # then contrast-check the result. Same output shape as the pairs above.
    print("  -- composited alpha (recipe resolved at paint time) --")
    for fg, fg_a, wash, wash_a, base, need, modes, note in COMPOSITED_PAIRS:
        if mode not in modes:
            continue
        if fg not in rgb or base not in rgb or (wash is not None and wash not in rgb):
            continue
        surface = rgb[base] if wash is None else blend(rgb[wash], wash_a, rgb[base])
        ink = rgb[fg] if fg_a == 1 else blend(rgb[fg], fg_a, surface)
        r = contrast(ink, surface)
        ok = r >= need
        if not ok:
            failures += 1
        recipe = f"{fg}{'' if fg_a == 1 else f'/{fg_a:g}'} on "
        recipe += base if wash is None else f"{wash}/{wash_a:g} over {base}"
        print(f"  {'PASS' if ok else 'FAIL'}  {r:5.2f} (need {need})  {recipe}  [{note}]")
    # colorblind confusability between semantic colors
    print("  -- colorblind separation (redmean dE, sim'd; <60 = confusable) --")
    for i, a in enumerate(SEMANTIC):
        for b in SEMANTIC[i + 1:]:
            if a not in rgb or b not in rgb or frozenset((a, b)) in SEMANTIC_EXEMPT:
                continue
            worst_kind, worst = None, 1e9
            for kind in CVD:
                d = deltaE(simulate(rgb[a], kind), simulate(rgb[b], kind))
                if d < worst:
                    worst, worst_kind = d, kind
            confusable = worst < 60
            if confusable:
                confusables += 1
            flag = "CONFUSABLE" if confusable else "ok        "
            print(f"  {flag} {a:11s} vs {b:11s}  worst dE={worst:6.1f} ({worst_kind})")

print(f"\nTotal WCAG failures: {failures}")
print(f"Total colorblind confusables: {confusables}")
# The a11y contract (app.css / CLAUDE.md) is "0 failures" — make that
# machine-enforceable so CI or scripted callers can't miss a red audit.
sys.exit(1 if failures or confusables else 0)
