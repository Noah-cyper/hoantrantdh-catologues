#!/usr/bin/env node
// =====================================================================
// scripts/migrate-seneca.js
// Parse the existing Seneca lookup HTML (7-stage "giai đoạn" layout,
// source: Short Form Catalog SFC_2401EN) into data/seneca.json,
// matching the schema in src/template.js.
//
// Usage:
//   node scripts/migrate-seneca.js [path/to/seneca-source.html]
//
// Default input:  scripts/seneca-source.html
// Output:         data/seneca.json  (groupType "stage", sections id "1".."7")
//
// Dependency-free. The parser is deliberately tolerant: it locates the
// seven "Giai đoạn N" boundaries, then extracts every [code, description]
// pair inside each. Vietnamese descriptions are preserved verbatim.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = process.argv[2] || path.join(__dirname, 'seneca-source.html');
const OUTPUT = path.join(ROOT, 'data', 'seneca.json');

// Palette for the 7 stages (id 1..7).
const STAGE_COLORS = ['#E4002B', '#EA580C', '#CA8A04', '#128377', '#2563EB', '#7C3AED', '#0891B2'];

// Human labels for each stage — override here if the source uses other wording.
const STAGE_HEADINGS = {
  '1': 'Giai đoạn 1',
  '2': 'Giai đoạn 2',
  '3': 'Giai đoạn 3',
  '4': 'Giai đoạn 4',
  '5': 'Giai đoạn 5',
  '6': 'Giai đoạn 6',
  '7': 'Giai đoạn 7',
};

// ---- html helpers -------------------------------------------------------

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- stage splitting ----------------------------------------------------
// Find the byte offset of each "Giai đoạn N" (or "GĐ N") marker and slice
// the document into 7 chunks. Returns { '1': html, ... }.

function splitByStage(html) {
  const re = /Giai\s*đo[aạ]n\s*([1-7])|G[ĐĐ]\s*([1-7])/gi;
  const marks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const stage = m[1] || m[2];
    marks.push({ stage, index: m.index });
  }
  const chunks = {};
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length;
    // Keep the first occurrence per stage (later ones are usually nav links).
    if (!chunks[marks[i].stage]) chunks[marks[i].stage] = html.slice(start, end);
  }
  return chunks;
}

// ---- row extraction -----------------------------------------------------
// Strategy 1: <tr> ... first two <td> => [code, desc].
// Strategy 2: elements carrying data-code="..." plus sibling description.

function extractRows(chunkHtml) {
  const rows = [];
  const seen = new Set();

  // Strategy 1 — table rows.
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(chunkHtml)) !== null) {
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [];
    let c;
    while ((c = cellRe.exec(tr[1])) !== null) cells.push(stripTags(c[1]));
    if (cells.length >= 2 && cells[0] && cells[1]) {
      const code = cells[0];
      // Skip header rows.
      if (/^(mã|code|m[oô] t[aả]|description)$/i.test(code)) continue;
      pushRow(rows, seen, code, cells.slice(1).join(' — '));
    }
  }
  if (rows.length) return rows;

  // Strategy 2 — data-code attributes.
  const dcRe = /data-code=["']([^"']+)["'][^>]*>([\s\S]*?)</gi;
  let d;
  while ((d = dcRe.exec(chunkHtml)) !== null) {
    pushRow(rows, seen, stripTags(d[1]), stripTags(d[2]));
  }
  return rows;
}

function pushRow(rows, seen, code, desc) {
  code = code.trim();
  desc = (desc || '').trim();
  if (!code) return;
  const key = code + '|' + desc;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push([code, desc]);
}

// ---- main ---------------------------------------------------------------

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`✖ Không tìm thấy file nguồn: ${INPUT}`);
    console.error('  → Đặt file HTML tra cứu Seneca (bản 7 giai đoạn) vào scripts/seneca-source.html');
    console.error('    hoặc truyền đường dẫn: node scripts/migrate-seneca.js <file.html>');
    process.exit(1);
  }

  const html = fs.readFileSync(INPUT, 'utf8');
  const chunks = splitByStage(html);
  const stageIds = Object.keys(chunks).sort();

  if (!stageIds.length) {
    console.error('✖ Không nhận diện được "Giai đoạn N" nào trong file. Kiểm tra định dạng nguồn.');
    process.exit(1);
  }

  const sections = [];
  let total = 0;
  for (const id of stageIds) {
    const rows = extractRows(chunks[id]);
    total += rows.length;
    sections.push({
      id,
      short: `GĐ ${id}`,
      color: STAGE_COLORS[(Number(id) - 1) % STAGE_COLORS.length],
      heading: STAGE_HEADINGS[id] || `Giai đoạn ${id}`,
      groups: [{ name: `Giai đoạn ${id}`, rows }],
    });
    console.log(`  Giai đoạn ${id}: ${rows.length} mã`);
  }

  // Preserve brand metadata from the existing skeleton if present.
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); } catch (_) { /* skeleton absent */ }

  const out = {
    brand: 'seneca',
    name: meta.name || 'SENECA',
    country: meta.country || 'Italy',
    tagline: meta.tagline || 'Made in Italy · Signal Conditioning & IIoT',
    accent: meta.accent || '#E4002B',
    title: meta.title || 'SENECA — Danh mục mã đặt hàng theo 7 giai đoạn chuỗi tín hiệu',
    subtitle: meta.subtitle || 'Bộ cách ly, chuyển đổi, thu thập, truyền thông và giám sát tín hiệu của Seneca (Ý).',
    intro: `Tổng ${total} mã theo 7 giai đoạn chuỗi tín hiệu (nguồn: Short Form Catalog SFC_2401EN).`,
    groupType: 'stage',
    sources: meta.sources || [{ label: 'Trang chủ Seneca', url: 'https://www.seneca.it' }],
    sections,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n✔ Đã ghi ${OUTPUT} — ${sections.length} giai đoạn · ${total} mã.`);
  if (total < 478) {
    console.warn(`⚠ Chỉ trích được ${total}/478 mã. Kiểm tra lại selector trong extractRows().`);
  }
}

main();
