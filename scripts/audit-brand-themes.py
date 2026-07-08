#!/usr/bin/env python3
"""Audit brand-themes.css: WCAG contrast + colorblind confusability.

Parses [data-brand=...] blocks (light + .dark) from brand-themes.css,
checks the standard shadcn token pairs against WCAG AA, and simulates
protanopia/deuteranopia/tritanopia to flag hue-only distinctions between
semantic colors (primary / accent / destructive / highlight).
"""

import re
import sys
from pathlib import Path

CSS = Path(sys.argv[1] if len(sys.argv) > 1 else "src/lib/styles/brand-themes.css").read_text()


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
for m in re.finditer(r"\[data-brand='(\w+)'\](\.dark)?\s*(?:body\s*)?\{([^}]+)\}", CSS):
    brand, dark, body = m.group(1), bool(m.group(2)), m.group(3)
    key = (brand, "dark" if dark else "light")
    toks = {}
    for tm in re.finditer(r"--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;", body):
        toks[tm.group(1)] = (float(tm.group(2)), float(tm.group(3)), float(tm.group(4)))
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
    ("primary", "background", 3.0, "primary as text-primary/link on page"),
    ("primary", "card", 3.0, "primary on card"),
    ("ring", "background", 3.0, "focus ring visibility"),
    ("border", "background", 1.3, "border visibility (advisory)"),
]

SEMANTIC = ["primary", "secondary", "accent", "destructive", "highlight"]

failures = 0
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
    # colorblind confusability between semantic colors
    print("  -- colorblind separation (redmean dE, sim'd; <60 = confusable) --")
    for i, a in enumerate(SEMANTIC):
        for b in SEMANTIC[i + 1:]:
            if a not in rgb or b not in rgb:
                continue
            worst_kind, worst = None, 1e9
            for kind in CVD:
                d = deltaE(simulate(rgb[a], kind), simulate(rgb[b], kind))
                if d < worst:
                    worst, worst_kind = d, kind
            flag = "CONFUSABLE" if worst < 60 else "ok        "
            print(f"  {flag} {a:11s} vs {b:11s}  worst dE={worst:6.1f} ({worst_kind})")

print(f"\nTotal WCAG failures: {failures}")
