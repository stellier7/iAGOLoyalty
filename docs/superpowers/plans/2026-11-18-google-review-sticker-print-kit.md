# Google Review Sticker Print Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static HTML/CSS print kit for 10×10 cm Google Review stickers with iAGO footer, placeholder QR, and 12×17" sheets at 3×3 (9-up) and 3×4 (12-up).

**Architecture:** Self-contained files under `print/google-review-stickers/`. Shared CSS defines exact centimeter sizes. Sheet pages reuse the sticker component via CSS grid. Print via browser → PDF at 100% scale.

**Tech Stack:** HTML, CSS (`cm`/`in` units), SVG/PNG assets, Node `qrcode` only to generate the placeholder PNG (not a runtime dependency).

## Global Constraints

- Sticker face: exactly **10cm × 10cm**
- Sheet page: exactly **12in × 17in**
- Copy and layout match the approved Spanish reference art
- Footer: “Desarrollado por” + iAGO Digital logo image
- Placeholder QR until real codes are supplied
- No app route or Next.js integration required for v1

---

### Task 1: Assets + shared sticker styles

**Files:**
- Create: `print/google-review-stickers/assets/google-g.svg`
- Create: `print/google-review-stickers/assets/nfc-tap.svg`
- Create: `print/google-review-stickers/assets/iago-digital-logo.jpg` (from provided logo)
- Create: `print/google-review-stickers/assets/qr-placeholder.png`
- Create: `print/google-review-stickers/sticker.css`

**Interfaces:**
- Produces: `.sticker` block exactly 10cm × 10cm; classes for Google header, actions row, footer, QR slot

- [ ] **Step 1:** Add SVG/PNG assets and `sticker.css` with print-safe colors and wave divider
- [ ] **Step 2:** Visually check asset paths resolve from sibling HTML files
- [ ] **Step 3:** Commit assets + CSS

### Task 2: Single sticker + sheet HTML

**Files:**
- Create: `print/google-review-stickers/sticker-10cm.html`
- Create: `print/google-review-stickers/sheet-3x3-10cm.html`
- Create: `print/google-review-stickers/sheet-3x4-10cm.html`
- Create: `print/google-review-stickers/README.md`

**Interfaces:**
- Consumes: `.sticker` markup/CSS from Task 1
- Produces: printable pages; 3×3 = 9 stickers; 3×4 = 12 stickers

- [ ] **Step 1:** Build `sticker-10cm.html` with footer + placeholder QR
- [ ] **Step 2:** Build both sheet HTML files with `@page` size 12in 17in
- [ ] **Step 3:** Write README with print instructions
- [ ] **Step 4:** Open in Chrome headless screenshot or print preview sanity check
- [ ] **Step 5:** Commit HTML + README

### Task 3: Push and open PR

**Files:** none new

- [ ] **Step 1:** Push `cursor/google-review-sticker-print-kit-8149`
- [ ] **Step 2:** Open PR against `main` with links to the three HTML blueprints
- [ ] **Step 3:** Send user the PR URL and blob links for each sheet
