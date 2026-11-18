# Google Review NFC Sticker — Design Spec

**Date:** 2026-11-18  
**Status:** Approved for implementation  
**Owner:** iAGO Digital print kit

## Goal

Produce a static print kit for NFC Google Review stickers: a single-sticker blueprint with a placeholder QR, plus imposition sheets for a **12" × 17"** print sheet. Real QR images are swapped in later before printing.

## Sticker art (10 × 10 cm)

Based on the provided reference card:

1. **Top (royal blue)** — Google “G” in a white circle; white copy “Déjanos una reseña” / “en Google”; five gold stars.
2. **Wave divider** — soft upward curve between blue and white.
3. **Bottom (white)** — left: “Acerca tu teléfono” + NFC/phone icon; center: small black circle separator; right: “Escanear código QR” + QR image.
4. **Footer** — centered under the NFC/QR row: “Desarrollado por” + iAGO Digital logo (logo asset, not plain text for the brand name).
5. **Shape** — square with rounded corners for die-cut preview.

QR starts as `qr-placeholder.png` (fake URL). Later batches replace per-sticker QR files only; art stays shared.

## Sheet layouts (12" × 17")

| Variant | Grid | Sticker size | Stickers/sheet | Notes |
|---------|------|--------------|----------------|-------|
| A | 3 × 3 | 10 × 10 cm | 9 | Near-max for 3 columns on 12" (~0.5 cm leftover on width) |
| B | 3 × 4 | 10 × 10 cm | 12 | Comfortable leftover on the 17" side |

**Not in v1:** 12 × 12 cm / 2 × 3 (original idea). Revisit only if requested.

Max square for a 3 × 3 grid edge-to-edge on 12" × 17" is **4" ≈ 10.16 cm**; 10 × 10 cm is the practical production size with cut gaps.

## Deliverables

Under `print/google-review-stickers/`:

- `sticker-10cm.html` — single sticker blueprint
- `sheet-3x3-10cm.html` — 9-up sheet
- `sheet-3x4-10cm.html` — 12-up sheet
- `assets/` — logo, Google G, NFC icon, placeholder QR
- `README.md` — open in browser, print to PDF at 100% / actual size

## Later QR workflow

1. Client supplies N QR image files.
2. Place under `assets/qrs/`.
3. Regenerate or parameterize sheets so each sticker slot gets one QR.
4. Sheet count = `ceil(N / stickers_per_sheet)` for the chosen grid.

## Out of scope

- In-app PDF generator UI
- NFC chip encoding (physical programming)
- Live Google review URL creation
