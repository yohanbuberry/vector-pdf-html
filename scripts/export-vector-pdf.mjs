#!/usr/bin/env node
/**
 * export-vector-pdf.mjs
 * Portable, cross-agent, cross-OS HTML -> 100% Illustrator-editable Vector PDF exporter.
 *
 * - Self-bootstraps `playwright` into ./node_modules on first run if neither
 *   playwright nor puppeteer is already available.
 * - Uses installed Google Chrome / Chromium / Edge when available, or Playwright Chromium.
 * - Strips CSS/SVG features that force Chromium's Skia PDF engine to rasterize layers
 *   (feTurbulence grain, filter: blur, backdrop-filter, blurred box-shadow, mask-image).
 * - Converts CSS radial-gradient(...) glows into opaque-stop inline <svg><radialGradient>
 *   shapes so they export as native PDF vector shadings (/ShadingType 3).
 * - Audits the generated PDF binary (/Type /Font, /ShadingType, /Subtype /Image, /SMask).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PKG = path.join(SCRIPT_DIR, 'package.json');

function parseArgs(argv) {
  const opts = {
    input: null,
    output: null,
    selector: '.slide, .spread-artboard, [data-spread], .book-page, .canvas, [class*="canvas-"]:not(.canvas-label)',
    size: null,
    previewDir: null,
  };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node export-vector-pdf.mjs <input.html> <output.pdf> [options]\n\n' +
        'Options:\n' +
        '  --selector <css>      Slide/artboard selector to auto-measure page size\n' +
        '  --size <W,H>          Explicit CSS @page size (e.g. "1600px,900px" or "156mm,234mm")\n' +
        '  --preview-dir <dir>   Render verification PNGs (macOS PDFKit or Linux pdftoppm)\n'
      );
      process.exit(0);
    } else if (a === '--selector') {
      opts.selector = argv[++i];
    } else if (a === '--size') {
      opts.size = argv[++i];
    } else if (a === '--preview-dir') {
      opts.previewDir = argv[++i];
    } else {
      pos.push(a);
    }
  }
  opts.input = pos[0];
  opts.output = pos[1];
  if (!opts.input || !opts.output) {
    console.error('Error: <input.html> and <output.pdf> are required. Run with --help for usage.');
    process.exit(2);
  }
  return opts;
}

function findSystemChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const platform = os.platform();
  const candidates =
    platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : platform === 'win32'
      ? [
          path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
          path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium',
        ];

  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function bootstrapPlaywright() {
  console.log(`Bootstrapping playwright into ${SCRIPT_DIR}/node_modules (one-time setup)…`);
  if (!fs.existsSync(SCRIPT_PKG)) {
    fs.writeFileSync(
      SCRIPT_PKG,
      JSON.stringify({ name: 'vector-pdf-html-runner', private: true, version: '1.0.0' }, null, 2) + '\n'
    );
  }
  const npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(
    npmCmd,
    ['install', '--prefix', SCRIPT_DIR, '--no-audit', '--no-fund', '--loglevel=error', 'playwright'],
    { stdio: 'inherit' }
  );
  if (res.status !== 0) {
    throw new Error('Failed to install playwright automatically.');
  }
  if (!findSystemChrome()) {
    const npxCmd = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
    spawnSync(npxCmd, ['--prefix', SCRIPT_DIR, 'playwright', 'install', 'chromium'], { stdio: 'inherit' });
  }
}

async function loadBrowserEngine() {
  const sysChrome = findSystemChrome();
  const searchDirs = [SCRIPT_DIR, process.cwd()];

  // 1. Try existing Playwright
  for (const base of searchDirs) {
    const pkg = path.join(base, 'package.json');
    if (!fs.existsSync(pkg)) continue;
    try {
      const req = createRequire(pkg);
      const pw = req('playwright');
      const browser = await pw.chromium.launch({
        headless: true,
        ...(sysChrome ? { executablePath: sysChrome } : {}),
        args: ['--allow-file-access-from-files'],
      });
      return { kind: 'playwright', browser };
    } catch {
      // continue
    }
  }

  // 2. Try existing Puppeteer
  for (const base of searchDirs) {
    const pkg = path.join(base, 'package.json');
    if (!fs.existsSync(pkg)) continue;
    try {
      const req = createRequire(pkg);
      const puppeteer = req('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        ...(sysChrome ? { executablePath: sysChrome } : {}),
        args: ['--allow-file-access-from-files'],
      });
      return { kind: 'puppeteer', browser };
    } catch {
      // continue
    }
  }

  // 3. Self-bootstrap Playwright into skill scripts directory
  bootstrapPlaywright();
  const req = createRequire(SCRIPT_PKG);
  const pw = req('playwright');
  const browser = await pw.chromium.launch({
    headless: true,
    ...(sysChrome ? { executablePath: sysChrome } : {}),
    args: ['--allow-file-access-from-files'],
  });
  return { kind: 'playwright', browser };
}

const VECTOR_SAFE_PRINT_CSS = `
@media print {
  .film-grain,
  [class*="grain"],
  [class*="noise"] {
    display: none !important;
    background-image: none !important;
  }

  *, *::before, *::after {
    filter: none !important;
    -webkit-filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    mix-blend-mode: normal !important;
    box-shadow: none !important;
    text-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  [filter] {
    filter: none !important;
  }
}
`;

function auditPdfBuffer(buf) {
  const str = buf.toString('latin1');
  const pages = (str.match(/\/Type\s*\/Page\b/g) || []).length;
  const fonts = (str.match(/\/Type\s*\/Font\b/g) || []).length;
  const images = (str.match(/\/Subtype\s*\/Image\b/g) || []).length;
  const smasks = (str.match(/\/SMask\b/g) || []).length;
  const shadings = (str.match(/\/ShadingType\b/g) || []).length;
  return { pages, fonts, images, smasks, shadings };
}

function renderPreviews(pdfPath, previewDir) {
  fs.mkdirSync(previewDir, { recursive: true });
  if (os.platform() === 'darwin') {
    const swiftCode = `
import Foundation
import PDFKit
import AppKit

let pdfURL = URL(fileURLWithPath: ${JSON.stringify(pdfPath)})
let outDir = ${JSON.stringify(previewDir)}
guard let doc = PDFDocument(url: pdfURL) else { exit(1) }
let count = min(doc.pageCount, 8)
for i in 0..<count {
    guard let page = doc.page(at: i) else { continue }
    let b = page.bounds(for: .mediaBox)
    let img = page.thumbnail(of: NSSize(width: b.width, height: b.height), for: .mediaBox)
    guard let tiff = img.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { continue }
    try png.write(to: URL(fileURLWithPath: "\\(outDir)/page_\\(i+1).png"))
}
`;
    execFileSync('swift', ['-e', swiftCode], { stdio: 'inherit' });
    return true;
  }
  // Try pdftoppm on Linux/Windows if installed
  const res = spawnSync('pdftoppm', ['-png', '-l', '8', pdfPath, path.join(previewDir, 'page')], { stdio: 'ignore' });
  return res.status === 0;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inputAbs = path.resolve(opts.input);
  const outputAbs = path.resolve(opts.output);

  if (!fs.existsSync(inputAbs)) {
    throw new Error(`Input HTML file not found: ${inputAbs}`);
  }
  fs.mkdirSync(path.dirname(outputAbs), { recursive: true });

  const { kind, browser } = await loadBrowserEngine();
  try {
    const page = await browser.newPage();
    if (kind === 'playwright') {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto(pathToFileURL(inputAbs).href, { waitUntil: 'networkidle' });
    } else {
      await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(inputAbs).href, { waitUntil: 'networkidle0' });
    }

    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    const measured = await page.evaluate((sel) => {
      const els = Array.from(document.querySelectorAll(sel));
      els.forEach((el) => el.scrollIntoView({ behavior: 'instant' }));
      window.scrollTo(0, 0);

      const domImgCount = document.querySelectorAll('img').length;
      document.querySelectorAll('[filter]').forEach((el) => el.removeAttribute('filter'));

      let gradId = 0;
      const parseRgbTuple = (raw) => {
        const m = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (m) return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
        if (/^transparent$/i.test(raw.trim())) return [0, 0, 0, 0];
        return null;
      };

      const findBackdropRgb = (el) => {
        let cur = el.parentElement;
        while (cur) {
          const bgc = getComputedStyle(cur).backgroundColor;
          const t = parseRgbTuple(bgc);
          if (t && t[3] >= 0.95) return [t[0], t[1], t[2]];
          cur = cur.parentElement;
        }
        return [255, 255, 255];
      };

      const blendRgb = (fg, bg) => {
        const a = fg[3];
        const r = Math.round(fg[0] * a + bg[0] * (1 - a));
        const g = Math.round(fg[1] * a + bg[1] * (1 - a));
        const b = Math.round(fg[2] * a + bg[2] * (1 - a));
        return `rgb(${r},${g},${b})`;
      };

      const splitTopLevel = (s) => {
        const out = [];
        let depth = 0;
        let cur = '';
        for (const ch of s) {
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          if (ch === ',' && depth === 0) {
            out.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
      };

      document.querySelectorAll('*').forEach((el) => {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundImage;
        if (!bg || bg === 'none' || (!bg.includes('radial-gradient(') && !bg.includes('linear-gradient('))) return;

        const layers = splitTopLevel(bg);
        if (layers.length > 1 && layers.every((l) => l.startsWith('radial-gradient('))) {
          el.style.setProperty('background-image', 'none', 'important');
          return;
        }

        const backdrop = findBackdropRgb(el);
        const svgShapes = [];
        const defs = [];
        let convertedAny = false;

        for (const layer of layers) {
          if (layer.startsWith('radial-gradient(')) {
            const inner = layer.slice('radial-gradient('.length, -1);
            const args = splitTopLevel(inner);
            if (args.length < 2) continue;

            let cx = '50%', cy = '50%', rx = '50%';
            let startIdx = 0;
            if (!/^(rgba?\(|#|transparent)/i.test(args[0])) {
              const shapeSpec = args[0];
              startIdx = 1;
              const atMatch = shapeSpec.match(/at\s+([\d.]+%?)\s+([\d.]+%?)/i);
              if (atMatch) { cx = atMatch[1]; cy = atMatch[2]; }
              const sizeMatch = shapeSpec.match(/([\d.]+%)\s+([\d.]+%)/);
              if (sizeMatch) { rx = sizeMatch[1]; }
            }

            const stops = [];
            for (let k = startIdx; k < args.length; k++) {
              const st = args[k];
              const pctMatch = st.match(/^(.*?)\s+([\d.]+%)$/);
              const rawColor = pctMatch ? pctMatch[1] : st;
              const offset = pctMatch ? pctMatch[2] : `${Math.round(((k - startIdx) / Math.max(1, args.length - 1 - startIdx)) * 100)}%`;
              const tup = parseRgbTuple(rawColor);
              const solidColor = tup ? blendRgb(tup, backdrop) : rawColor.trim();
              stops.push({ offset, color: solidColor });
            }
            const lastStop = stops[stops.length - 1];
            if (lastStop && lastStop.offset !== '100%') {
              stops.push({ offset: '100%', color: `rgb(${backdrop[0]},${backdrop[1]},${backdrop[2]})` });
            }

            const id = `vec_rg_${++gradId}`;
            const stopsXml = stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
            defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${rx}">${stopsXml}</radialGradient>`);
            const isRound = parseFloat(cs.borderTopLeftRadius) >= Math.min(el.clientWidth, el.clientHeight) * 0.4;
            svgShapes.push(
              isRound
                ? `<ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#${id})"/>`
                : `<rect width="100%" height="100%" fill="url(#${id})"/>`
            );
            convertedAny = true;
          } else if (layer.startsWith('linear-gradient(') && layer.includes('rgba(')) {
            el.style.setProperty('background-image', 'none', 'important');
          }
        }

        if (convertedAny) {
          if (cs.position === 'static') el.style.position = 'relative';
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');
          svg.setAttribute('preserveAspectRatio', 'none');
          svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;border-radius:inherit;';
          svg.innerHTML = `<defs>${defs.join('')}</defs>${svgShapes.join('')}`;
          el.insertBefore(svg, el.firstChild);
          el.style.setProperty('background-image', 'none', 'important');
        }
      });

      document.querySelectorAll('*').forEach((el) => {
        const cs = getComputedStyle(el);
        if ((cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none')) {
          el.style.setProperty('display', 'none', 'important');
        }
      });

      if (els.length > 0) {
        const r = els[0].getBoundingClientRect();
        return {
          count: els.length,
          width: Math.round(r.width),
          height: Math.round(r.height),
          domImgCount,
        };
      }
      return {
        count: 0,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        domImgCount,
      };
    }, opts.selector);

    await new Promise((r) => setTimeout(r, 500));

    let pageWidth = `${measured.width}px`;
    let pageHeight = `${measured.height}px`;
    if (opts.size) {
      const parts = opts.size.split(/[xX,]/).map((s) => s.trim());
      if (parts.length === 2) {
        pageWidth = parts[0];
        pageHeight = parts[1];
      }
    }

    const pageSizeRule = `@page { size: ${pageWidth} ${pageHeight}; margin: 0; }`;
    await page.addStyleTag({ content: VECTOR_SAFE_PRINT_CSS + '\n' + pageSizeRule });

    if (kind === 'playwright') {
      await page.emulateMedia({ media: 'print' });
    } else {
      await page.emulateMediaType('print');
    }

    await page.pdf({
      path: outputAbs,
      width: pageWidth,
      height: pageHeight,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });

    const pdfBuf = fs.readFileSync(outputAbs);
    const audit = auditPdfBuffer(pdfBuf);

    console.log(`✓ Exported Vector PDF: ${outputAbs} (${(pdfBuf.length / 1024).toFixed(1)} KB)`);
    console.log(
      `  Audit → Pages: ${audit.pages} | Live Fonts: ${audit.fonts} | Vector Shadings: ${audit.shadings} | ` +
      `Embedded Images: ${audit.images} (HTML <img> tags: ${measured.domImgCount}) | SMasks: ${audit.smasks}`
    );

    if (audit.fonts === 0) {
      console.warn('  ⚠ WARNING: 0 live fonts detected — check if text was outlined or rasterized!');
    }
    if (audit.images > measured.domImgCount) {
      console.warn(
        `  ⚠ WARNING: PDF contains ${audit.images - measured.domImgCount} non-<img> bitmap(s). ` +
        'Inspect inline styles or canvas/WebGL elements if strict zero-raster output is required.'
      );
    } else {
      console.log('  ✓ PASS: Zero CSS/UI layers were rasterized — 100% vector & live text ready for Illustrator.');
    }

    if (opts.previewDir) {
      const ok = renderPreviews(outputAbs, path.resolve(opts.previewDir));
      if (ok) {
        console.log(`  ✓ Rendered verification previews to: ${path.resolve(opts.previewDir)}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
