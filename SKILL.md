---
name: vector-pdf-html
description: >-
  Exports HTML files, brand decks, zines, and multi-slide presentations to 100%
  Illustrator-editable vector PDFs (live text, vector SVG paths, native PDF
  gradients, zero rasterized pages, and zero broken macOS Preview SMask boxes).
  Use whenever the user asks to save, convert, or export HTML to PDF without
  rasterizing, for Adobe Illustrator / Figma editing, print-ready vector
  handoff, or clean vector PDF export.
---

# Vector PDF from HTML (`vector-pdf-html`)

Exports single-page or multi-slide HTML documents to **100% vector, Illustrator-editable PDFs** using headless Chrome/Chromium `page.pdf()` — **never** screenshot-to-PDF.

## Why Standard HTML-to-PDF Rasterizes Pages

The PDF specification has no native CSS Gaussian blur or SVG `<feTurbulence>` primitive. Whenever Chromium's Skia PDF engine encounters any of the following, it flattens elements into raster bitmaps (`/Subtype /Image`) and soft-masks (`/SMask`) — which become uneditable images in Adobe Illustrator and render as solid grey/brown boxes in macOS Preview:

1. **SVG `<filter>` / `<feTurbulence>` overlays** (e.g., `.film-grain`, noise textures covering `inset: 0`).
2. **CSS `filter` & `backdrop-filter`** (`blur()`, `drop-shadow()`, `backdrop-blur-*`).
3. **Blurred `box-shadow` & `text-shadow`** (any shadow with blur radius > `0`).
4. **CSS `radial-gradient` / `linear-gradient` with alpha < `1` (`transparent` / `rgba`)**, `mask-image`, `mix-blend-mode`, and 3D `perspective` / `translateZ(...)` transforms.

By contrast, **inline `<svg>` `<linearGradient>` and `<radialGradient>` shapes with opaque color stops** export as native PDF vector shadings (`/ShadingType 2` and `/ShadingType 3`) that stay 100% resolution-independent and editable in Illustrator.

---

## Workflow

### Step 1: Audit & Convert Glows Before Exporting (Optional Design Polish)

The helper script automatically sanitizes print CSS and converts CSS `radial-gradient` halos into solid-stop inline `<svg><radialGradient>` shapes. Before running on custom designs:
- Keep logos, icons, and diagrams as **inline `<svg>`** (with unique/scoped CSS class names so multiple SVGs on one page never collide).
- Ensure `@font-face` rules resolve cleanly from the HTML file's directory so fonts embed as live editable text.

### Step 2: Run the Vector PDF Exporter Script

Resolve `scripts/export-vector-pdf.mjs` relative to this `SKILL.md` file's directory (`<skill-dir>/scripts/export-vector-pdf.mjs`). On first run, if neither `playwright` nor `puppeteer` is found locally, the script automatically bootstraps `playwright` into `<skill-dir>/scripts/node_modules`.

```bash
node <skill-dir>/scripts/export-vector-pdf.mjs <input.html> <output.pdf> [--selector <css>] [--size <W,H>] [--preview-dir <dir>]
```

#### Options

- `<input.html>` — Path to the source HTML file.
- `<output.pdf>` — Destination path for the generated vector PDF.
- `--selector <css>` — Slide/page container selector used to auto-measure page dimensions (defaults to `.slide, .spread-artboard, [data-spread], .book-page, .canvas, [class*="canvas-"]:not(.canvas-label)`).
- `--size <W,H>` — Explicit `@page` dimensions (e.g. `1600px,900px`, `1280px,720px`, or `156mm,234mm`). Overrides auto-measured selector size.
- `--preview-dir <dir>` — Renders page thumbnails (via native `PDFKit` on macOS or `pdftoppm` on Linux) to visually verify zero grey `SMask` boxes.

### Step 3: Mandatory Verification Gate

Never deliver the PDF without checking the script's forensic audit output:

1. **`Live Fonts` (`/Type /Font`) > `0`:** Confirms live editable typography is embedded (unless all text in the HTML was intentionally outlined SVG paths).
2. **`Embedded Images` (`/Subtype /Image`) == HTML `<img>` count:** Confirms zero CSS/UI layers were flattened into bitmaps.
3. **`SMasks` (`/SMask`) == `0`** *(or visually verified clean via `--preview-dir`)*: Confirms zero broken grey/brown transparency mask boxes in macOS Preview or Adobe Illustrator.
4. If extra bitmaps remain, check the HTML for `<canvas>` / WebGL elements or inline SVG `<image>` / `<filter>` nodes and replace them with vector `<svg>` paths before re-running.
