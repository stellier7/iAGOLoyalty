# Google Review NFC stickers (print kit)

Static blueprints for **10 × 10 cm** stickers on a **12" × 17"** sheet, matching the Spanish Google Review card layout, with **Desarrollado por** + the iAGO Digital logo in the footer.

## Files

| File | What it is |
|------|------------|
| [sticker-10cm.html](./sticker-10cm.html) | Single sticker blueprint |
| [sheet-3x3-10cm.html](./sheet-3x3-10cm.html) | **9** stickers (3 columns × 3 rows) |
| [sheet-3x4-10cm.html](./sheet-3x4-10cm.html) | **12** stickers (3 columns × 4 rows) |
| `assets/qr-placeholder.png` | Fake QR for design / proofing |

## How many fit?

On a **12" × 17"** sheet at **10 × 10 cm**:

- **3 × 3 → 9 stickers**
- **3 × 4 → 12 stickers**

A full 3-column square maxes out near **~10.16 cm** (4"); **10 cm** leaves a little room for gaps/cut.

## Print to PDF

1. Open the HTML file in Chrome.
2. Print → Destination: **Save as PDF**.
3. Paper size: **12 × 17 in** for sheets (or custom 10 × 10 cm for the single sticker).
4. Margins: **None**.
5. Scale: **100% / Actual size** (do not “Fit to page”).
6. Enable **Background graphics**.

## Swapping real QR codes later

1. Drop client QR PNGs into `assets/qrs/`.
2. Replace each sticker’s `assets/qr-placeholder.png` reference (or we regenerate the sheet HTML for you).
3. Re-export PDFs before sending to print.

NFC programming is separate from this artwork: the chip should open the same review URL as the QR.
