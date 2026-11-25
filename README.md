# `vector-pdf-html`

Export HTML decks, brand guidelines, zines, and UI artifacts to **100% Adobe Illustrator–editable vector PDFs** — keeping live text, crisp SVG paths, and native PDF vector gradients with **zero rasterized pages** and **zero broken macOS Preview `SMask` boxes**.

Works across **Google Antigravity, Claude Code, Cursor, OpenAI Codex, Gemini CLI, and GitHub Copilot** on macOS, Linux, and Windows (Node.js 18+).

---

## Quick Install

### Via `skills` CLI (Recommended)
```bash
npx skills add yohanbuberry/vector-pdf-html
```

### Via `git clone`
```bash
# Google Antigravity
git clone --depth 1 https://github.com/yohanbuberry/vector-pdf-html.git ~/.gemini/config/skills/vector-pdf-html

# Claude Code
git clone --depth 1 https://github.com/yohanbuberry/vector-pdf-html.git ~/.claude/skills/vector-pdf-html

# Cursor
git clone --depth 1 https://github.com/yohanbuberry/vector-pdf-html.git ~/.cursor/skills/vector-pdf-html

# OpenAI Codex CLI
git clone --depth 1 https://github.com/yohanbuberry/vector-pdf-html.git ~/.codex/skills/vector-pdf-html
```

> **Zero manual setup:** On first run, `scripts/export-vector-pdf.mjs` automatically uses your installed Chrome / Chromium / Edge, or self-installs Playwright Chromium into its own `scripts/node_modules` folder.

---

## Why This Exists

Standard browser `Save as PDF` / `page.pdf()` flattens modern CSS effects into uneditable bitmaps because the PDF specification has no native CSS Gaussian blur or SVG noise primitive:

| HTML / CSS Feature | Standard `page.pdf()` | `vector-pdf-html` |
|---|---|---|
| `<feTurbulence>` / `.film-grain` overlays | Full-page rasterized bitmap | Stripped cleanly in `@media print` |
| `filter: blur()` / `backdrop-filter` / blurred `box-shadow` | Raster tiles + grey `/SMask` boxes in macOS Preview | Sanitized in print mode so text & vectors stay 100% live |
| CSS `radial-gradient(...)` halos & glows | Rasterized bitmap + `/SMask` ring | Auto-converted to opaque-stop `<svg><radialGradient>` (`/ShadingType 3` native vector shading) |
| Custom `@font-face` & inline `<svg>` | Often mixed with flattened layers | Embedded as live editable fonts (`/Type /Font`) & vector curves |

---

## Usage

### In Any AI Agent
Ask your agent:
> *"Export `presentation.html` to an Illustrator-editable vector PDF using `vector-pdf-html`."*

### From the Terminal
```bash
# Auto-detect slide dimensions (.slide, .spread-artboard, .book-page, .canvas)
node scripts/export-vector-pdf.mjs ./deck.html ./deck.pdf

# Explicit page size + visual verification thumbnails
node scripts/export-vector-pdf.mjs ./zine.html ./zine.pdf --size 1600px,900px --preview-dir ./previews
```

### Built-in PDF Stream Audit
Every export inspects the generated PDF binary to verify nothing was accidentally rasterized:
```text
✓ Exported Vector PDF: ./zine.pdf (605.5 KB)
  Audit → Pages: 7 | Live Fonts: 63 | Vector Shadings: 10 | Embedded Images: 0 (HTML <img> tags: 0) | SMasks: 0
  ✓ PASS: Zero CSS/UI layers were rasterized — 100% vector & live text ready for Illustrator.
```

---

## Manual Skill Paths

| Agent | Global Path | Project Path |
|---|---|---|
| **Google Antigravity** | `~/.gemini/config/skills/vector-pdf-html` | `.agents/skills/vector-pdf-html` |
| **Claude Code** | `~/.claude/skills/vector-pdf-html` | `.claude/skills/vector-pdf-html` |
| **Cursor** | `~/.cursor/skills/vector-pdf-html` | `.cursor/skills/vector-pdf-html` |
| **OpenAI Codex CLI** | `~/.codex/skills/vector-pdf-html` | `.agents/skills/vector-pdf-html` |
| **Gemini CLI** | `~/.gemini/skills/vector-pdf-html` | `.gemini/skills/vector-pdf-html` |

---

## License

MIT
