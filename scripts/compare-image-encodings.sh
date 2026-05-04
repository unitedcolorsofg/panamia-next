#!/usr/bin/env bash
# compare-image-encodings.sh
#
# Generate AVIF / WebP / JPEG variants of a source image at multiple
# quality levels, compute SSIM + PSNR vs the source, and assemble a
# labeled side-by-side comparison grid for visual inspection.
#
# Usage:
#   scripts/compare-image-encodings.sh <source-image> [output-dir]
#
# Example:
#   scripts/compare-image-encodings.sh public/img/home/website_banner.jpg /tmp/banner_cmp
#
# Outputs in <output-dir>:
#   variants/   — encoded variants (q60/q75/q85 AVIF, q75/q85/q92 WebP, q85 JPEG)
#   metrics.txt — SSIM/PSNR/size table
#   compare.png — labeled side-by-side grid (center-cropped detail)
#
# Requires: ImageMagick 7+ (`magick`) with AVIF + WebP delegates.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <source-image> [output-dir]" >&2
  exit 1
fi

SRC="$1"
OUT="${2:-/tmp/image_cmp}"

if [[ ! -f "$SRC" ]]; then
  echo "source not found: $SRC" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 7+ (magick) required" >&2
  exit 1
fi

mkdir -p "$OUT/variants" "$OUT/panels"
BASE="$(basename "${SRC%.*}")"
V="$OUT/variants"

echo "Source: $SRC"
src_size=$(du -b "$SRC" | awk '{printf "%.1fKB", $1/1024}')
echo "Source size: $src_size"
echo

echo "Encoding variants..."
magick "$SRC" -strip -quality 85 -interlace Plane -sampling-factor 4:2:0 "$V/${BASE}.q85.jpg"
magick "$SRC" -strip -quality 60 "$V/${BASE}.q60.avif"
magick "$SRC" -strip -quality 75 "$V/${BASE}.q75.avif"
magick "$SRC" -strip -quality 85 "$V/${BASE}.q85.avif"
magick "$SRC" -strip -define webp:method=6 -quality 75 "$V/${BASE}.q75.webp"
magick "$SRC" -strip -define webp:method=6 -quality 85 "$V/${BASE}.q85.webp"
magick "$SRC" -strip -define webp:method=6 -quality 92 "$V/${BASE}.q92.webp"

# Metrics
{
  printf "%-22s %-10s %-10s %-10s\n" "variant" "SSIM" "PSNR(dB)" "size"
  printf "%-22s %-10s %-10s %-10s\n" "(source)" "1.000000" "inf" "$src_size"
  for f in \
    "$V/${BASE}.q85.jpg" \
    "$V/${BASE}.q60.avif" \
    "$V/${BASE}.q75.avif" \
    "$V/${BASE}.q85.avif" \
    "$V/${BASE}.q75.webp" \
    "$V/${BASE}.q85.webp" \
    "$V/${BASE}.q92.webp"; do
    label="${f##*/${BASE}.}"
    # `magick compare` exits non-zero when images differ; ignore that.
    ssim=$({ magick compare -metric SSIM "$SRC" "$f" null: 2>&1 || true; } | awk '{print $1}')
    psnr=$({ magick compare -metric PSNR "$SRC" "$f" null: 2>&1 || true; } | awk '{print $1}')
    size=$(du -b "$f" | awk '{printf "%.1fKB", $1/1024}')
    printf "%-22s %-10s %-10s %-10s\n" "$label" "$ssim" "$psnr" "$size"
  done
} | tee "$OUT/metrics.txt"
echo

# Labeled center-cropped panels (600x600)
W=600; H=600
make_panel() {
  local f="$1" label="$2"
  local size
  size=$(du -b "$f" | awk '{printf "%.0fKB", $1/1024}')
  magick "$f" -gravity center -crop ${W}x${H}+0+0 +repage \
    -gravity south -background '#000a' -fill white \
    -font DejaVu-Sans-Bold -pointsize 28 \
    -splice 0x44 -annotate +0+8 "$label  ($size)" \
    "$OUT/panels/${label}.png"
}

make_panel "$SRC" "source"
make_panel "$V/${BASE}.q85.jpg"  "q85.jpg"
make_panel "$V/${BASE}.q92.webp" "q92.webp"
make_panel "$V/${BASE}.q85.webp" "q85.webp"
make_panel "$V/${BASE}.q75.webp" "q75.webp"
make_panel "$V/${BASE}.q85.avif" "q85.avif"
make_panel "$V/${BASE}.q75.avif" "q75.avif"
make_panel "$V/${BASE}.q60.avif" "q60.avif"

magick montage \
  "$OUT/panels/source.png" \
  "$OUT/panels/q85.jpg.png" \
  "$OUT/panels/q92.webp.png" \
  "$OUT/panels/q85.webp.png" \
  "$OUT/panels/q75.webp.png" \
  "$OUT/panels/q85.avif.png" \
  "$OUT/panels/q75.avif.png" \
  "$OUT/panels/q60.avif.png" \
  -tile 4x2 -geometry +4+4 -background '#222' \
  "$OUT/compare.png"

echo "Wrote:"
echo "  $OUT/metrics.txt"
echo "  $OUT/compare.png"
echo "  $OUT/variants/  (7 encoded files)"
