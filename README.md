# `vector-pdf-html` — Portable Agent Skill

Exports HTML decks, zines, brand books, and UI artifacts to **100% Illustrator-editable vector PDFs** (live text, vector SVG paths, native PDF vector shadings, zero rasterized pages, and zero macOS Preview `SMask` boxes).

Works on **macOS, Linux, and Windows** (Node.js 18+) and follows the universal `SKILL.md` standard supported across modern AI coding agents.

---

## Install in Any Agent

Drop the `vector-pdf-html/` folder into your agent's global or project skills directory:

| Agent | Global Install Path | Project-Local Path |
|---|---|---|
| **Google Antigravity** | `~/.gemini/config/skills/vector-pdf-html` | `.agents/skills/vector-pdf-html` |
| **Claude Code** | `~/.claude/skills/vector-pdf-html` | `.claude/skills/vector-pdf-html` |
| **Cursor** | `~/.cursor/skills/vector-pdf-html` | `.cursor/skills/vector-pdf-html` |
| **OpenAI Codex CLI** | `~/.codex/skills/vector-pdf-html` | `.agents/skills/vector-pdf-html` |
| **Gemini CLI** | `~/.gemini/skills/vector-pdf-html` | `.gemini/skills/vector-pdf-html` |
| **Windsurf / Other Agents** | `.agents/skills/vector-pdf-html` | *(or reference `SKILL.md` in rules)* |

> **Zero manual setup:** On first run, `scripts/export-vector-pdf.mjs` automatically detects Google Chrome / Chromium / Edge (or installs Playwright Chromium into its own `scripts/node_modules` folder).

---

## Usage

Ask your agent:
> *"Export `deck.html` to a vector PDF for Illustrator using `vector-pdf-html`."*

Or run directly from the terminal:
```bash
node vector-pdf-html/scripts/export-vector-pdf.mjs ./input.html ./output.pdf
```
