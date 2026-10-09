#!/usr/bin/env python3
"""
Generate a Panaverse surface wordmark.

The house marks (Pana Mia Club, Pana Social) are hand-lettered. Nobody has
drawn one for every surface, and no typeface traces hand lettering
convincingly, so surfaces without a drawn mark fly a set one built by this
script -- the same call already made for Pana Connectors and Pana Admin.

This exists because those two were generated once by a script that was never
committed, so the recipe had to be read back off the PNGs. It is checked in so
the next surface does not repeat that.

What it borrows from the real marks, all of which were measured off
`pana_connectors_long_orange.png` rather than guessed:

  Two-tier capitals. The house marks are not mixed case. They are capitals
  throughout with only the lead letter of each word drawn large -- PanaSocial
  is P + ANA, S + OCIAL. All-caps and true-lowercase both miss this.

  Set solid, no word space.

  Pana flame (#FF833A), sampled off the live Pana Social mark.

  A star inside the word.

  A small seeded rotation, baseline shift and weight change per glyph, because
  a uniform baseline is most of what makes type read as type rather than as
  lettering.

What it cannot fake is the irregular marker stroke of the drawn marks. That
needs a person with a pen, and any mark this produces should be replaced by one
when somebody draws it.

Usage:
    python scripts/generate-surface-wordmark.py \
        --word EVENTS --star-index 1 --out public/logos/pana_events_long_orange.png
"""

from __future__ import annotations

import argparse
import math
import random

from PIL import Image, ImageDraw, ImageFont

# Sampled off public/logos/pana_social_long_orange.png -- the most common
# opaque pixel in the live mark, not a guess at "orange".
FLAME = (255, 131, 58, 255)

# Rendered large and reduced, because the jitter rotates individual glyphs and
# a rotation at final size shreds the edges Nunito's rounded terminals depend
# on.
SUPERSAMPLE = 4

# Measured off the Connectors mark: the lead capital of each word runs about
# ten sevenths of the rest.
SMALL_CAP_RATIO = 0.70

PREFIX = "PANA"


def star_points(cx: float, cy: float, r: float, rotation: float = -90.0):
    """Five-pointed star, outer radius r, first point at `rotation` degrees."""
    inner = r * 0.42
    pts = []
    for i in range(10):
        radius = r if i % 2 == 0 else inner
        angle = math.radians(rotation + i * 36.0)
        pts.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return pts


def draw_star(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float) -> None:
    """A star with softened points, to sit beside Nunito's rounded terminals.

    Drawn as a filled polygon and then stroked round-jointed along its own
    outline, which rounds the vertices without needing a second asset.
    """
    pts = star_points(cx, cy, r)
    draw.polygon(pts, fill=FLAME)
    draw.line(pts + [pts[0]], fill=FLAME, width=max(2, int(r * 0.17)), joint="curve")


def build(
    font_path: str,
    word: str,
    star_index: int | None,
    target_width: int,
    seed: int,
) -> Image.Image:
    rng = random.Random(seed)
    cap = 160 * SUPERSAMPLE

    # (character, is_lead) -- the lead letter of each word is the large tier.
    glyphs: list[tuple[str, bool]] = []
    for i, ch in enumerate(PREFIX):
        glyphs.append((ch, i == 0))
    for i, ch in enumerate(word):
        glyphs.append((ch, i == 0))

    # A star index past the end of the word appends the star rather than
    # replacing a letter. The glyph it stands on is only there to carry an
    # advance width, and never gets drawn.
    appended_star = star_index is not None and star_index >= len(word)
    if appended_star:
        glyphs.append(("O", False))

    star_slot = None if star_index is None else len(PREFIX) + min(star_index, len(word))

    def font_for(lead: bool, weight: float) -> ImageFont.FreeTypeFont:
        size = int(cap if lead else cap * SMALL_CAP_RATIO)
        f = ImageFont.truetype(font_path, size)
        f.set_variation_by_axes([weight])
        return f

    # Jitter is seeded so the mark is stable across runs: regenerating must not
    # silently produce a slightly different logo than the one in git.
    plan = []
    for i, (ch, lead) in enumerate(glyphs):
        plan.append(
            {
                "ch": ch,
                "lead": lead,
                "weight": rng.uniform(860, 940),
                "angle": rng.uniform(-1.6, 1.6),
                "dy": rng.uniform(-0.022, 0.022) * cap,
                "is_star": i == star_slot,
            }
        )

    pad = int(cap * 0.5)
    canvas_w = int(cap * len(glyphs) * 1.05) + pad * 2
    canvas_h = int(cap * 2.2)
    img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    baseline = int(canvas_h * 0.70)
    x = float(pad)
    # Tracked tighter than metrics: the drawn marks set solid and almost touch.
    tracking = -0.055 * cap

    for g in plan:
        f = font_for(g["lead"], g["weight"])
        # Cap height for this tier, taken off a flat-topped capital so the star
        # and the letters share one top line.
        ref = draw.textbbox((0, 0), "E", font=f, anchor="ls")
        tier_cap = abs(ref[1])
        advance = draw.textlength(g["ch"], font=f)

        if g["is_star"]:
            r = tier_cap * 0.62
            cx = x + advance / 2
            cy = baseline - tier_cap / 2 + g["dy"]
            draw_star(draw, cx, cy, r)
            x += advance + tracking
            continue

        # Each glyph is drawn into its own tile and rotated about its own
        # baseline, so a rotation never drags a neighbour out of line.
        tile = Image.new("RGBA", (int(advance * 2.4), int(cap * 2.4)), (0, 0, 0, 0))
        td = ImageDraw.Draw(tile)
        ox, oy = tile.width // 4, int(tile.height * 0.70)
        td.text((ox, oy), g["ch"], font=f, fill=FLAME, anchor="ls")
        tile = tile.rotate(g["angle"], resample=Image.BICUBIC, center=(ox, oy))
        img.alpha_composite(tile, (int(x - ox), int(baseline + g["dy"] - oy)))
        x += advance + tracking

    img = img.crop(img.getbbox())
    height = max(1, round(img.height * (target_width / img.width)))
    return img.resize((target_width, height), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", required=True, help="Nunito variable TTF")
    ap.add_argument("--word", required=True, help="Second word, in capitals")
    ap.add_argument(
        "--star-index",
        type=int,
        default=None,
        help=(
            "Index within --word to replace with the star. Pass len(word) or "
            "more to append the star after the word instead. Omit for no star."
        ),
    )
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=800)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    img = build(args.font, args.word, args.star_index, args.width, args.seed)
    img.save(args.out)
    print(f"{args.out} {img.width}x{img.height}")


if __name__ == "__main__":
    main()
