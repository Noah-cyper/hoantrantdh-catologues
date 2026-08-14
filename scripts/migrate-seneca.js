#!/usr/bin/env node
// =====================================================================
// scripts/migrate-seneca.js
// Parse the Seneca lookup HTML (7-stage "giai đoạn" layout, source:
// Short Form Catalog SFC_2401EN) into data/seneca.json, matching the
// schema in src/template.js.
//
// Usage:
//   node scripts/migrate-seneca.js [path/to/seneca-source.html]
//
// Default input:  scripts/seneca-source.html
// Output:         data/seneca.json  (groupType "stage", sections id "1".."7")
//
// Dependency-free. The source markup is purpose-built, so the parser
// reads its explicit structure instead of guessing:
//   <section class="stage s-*" id="gdN"> … </section>   → one stage
//     <span class="tier">…</span>                        → note
//     <h2>Heading <em>N mã</em></h2>                      → heading
//     <div class="grp"><div class="grp-h"><span class="t">…</span>  → group name
//       <tr data-st data-code="CODE"> … <td class="desc">…</td>     → [code, desc]
// Stage 5 ("Đường truyền") carries no order codes — its bearer matrix
// is emitted as the OPTIONAL "bridge" block so no information is lost.
// Vietnamese descriptions are preserved verbatim.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = process.argv[2] || path.join(__dirname, 'seneca-source.html');
const OUTPUT = path.join(ROOT, 'data', 'seneca.json');

// Accent per stage, taken from the source's own class palette so the hub
// page mirrors the original design intent.
const CLASS_COLORS = {
  's-field': '#BE6B34',
  's-control': '#128377',
  's-super': '#544CD1',
  's-steel': '#556378',
};
const FALLBACK_COLORS = ['#E4002B', '#EA580C', '#CA8A04', '#128377', '#2563EB', '#7C3AED', '#0891B2'];

// Concise filter-button labels per stage id (the <h2> headings are longer).
const SHORT = {
  '1': 'Đo',
  '2': 'Điều hòa tín hiệu',
  '3': 'Thu thập · điều khiển',
  '4': 'Giao thức lên tầng',
  '5': 'Đường truyền',
  '6': 'Server / Cloud',
  '7': 'Dashboard / HMI',
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

// ---- section splitting --------------------------------------------------
// Slice the document into <section class="stage …" id="gdN"> blocks.
// Sections do not nest, so cutting on the opening tag is safe.

function splitStages(html) {
  const re = /<section\b[^>]*\bclass="stage([^"]*)"[^>]*\bid="gd([1-7])"[^>]*>/gi;
  const marks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    marks.push({ id: m[2], cls: m[1].trim(), index: m.index });
  }
  return marks.map((mk, i) => ({
    id: mk.id,
    cls: mk.cls,
    html: html.slice(mk.index, i + 1 < marks.length ? marks[i + 1].index : html.length),
  }));
}

// ---- row / group extraction ---------------------------------------------

function extractRow(trHtml) {
  const codeMatch = /\bdata-code="([^"]+)"/i.exec(trHtml);
  if (!codeMatch) return null;
  const descMatch = /<td[^>]*class="[^"]*\bdesc\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i.exec(trHtml);
  const code = decodeEntities(codeMatch[1]).trim();
  const desc = descMatch ? stripTags(descMatch[1]) : '';
  if (!code) return null;
  return [code, desc];
}

// Each <div class="grp"> → { name, rows }. A stage may hold several groups.
// Match class="grp" exactly so the sibling <div class="grp-h"> title bar
// (and any other grp-* helper class) never starts a new group.
function extractGroups(stageHtml) {
  const groups = [];
  const grpRe = /<div\b[^>]*\bclass="grp"[^>]*>([\s\S]*?)(?=<div\b[^>]*\bclass="grp"|<\/section>)/gi;
  let g;
  while ((g = grpRe.exec(stageHtml)) !== null) {
    const chunk = g[1];
    const nameMatch = /<div\b[^>]*\bclass="grp-h"[^>]*>[\s\S]*?<span\b[^>]*\bclass="t"[^>]*>([\s\S]*?)<\/span>/i.exec(chunk);
    const name = nameMatch ? stripTags(nameMatch[1]) : '';
    const rows = [];
    const trRe = /<tr\b[^>]*\bdata-code="[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
    let tr;
    while ((tr = trRe.exec(chunk)) !== null) {
      const row = extractRow(tr[0]);
      if (row) rows.push(row);
    }
    if (rows.length) groups.push({ name, rows });
  }
  return groups;
}

// Stage 5 bearer matrix → bridge rows [medium, note].
function extractMatrix(stageHtml) {
  const rows = [];
  const re = /<div\b[^>]*\bclass="row"[^>]*>\s*<div\b[^>]*\bclass="k"[^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*\bclass="v"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(stageHtml)) !== null) {
    rows.push([stripTags(m[1]), stripTags(m[2])]);
  }
  return rows;
}

// A stage's <h2>Heading <em>…</em></h2> and <span class="tier">…</span>.
function extractMeta(stageHtml) {
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(stageHtml);
  let heading = '';
  if (h2) heading = stripTags(h2[1].replace(/<em\b[^>]*>[\s\S]*?<\/em>/i, ''));
  const tier = /<span\b[^>]*\bclass="[^"]*\btier\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(stageHtml);
  return { heading, note: tier ? stripTags(tier[1]) : '' };
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
  const stages = splitStages(html);

  if (!stages.length) {
    console.error('✖ Không nhận diện được <section class="stage" id="gdN"> nào. Kiểm tra định dạng nguồn.');
    process.exit(1);
  }

  const sections = [];
  let bridge = null;
  let total = 0;

  for (const stage of stages) {
    const { heading, note } = extractMeta(stage.html);
    const color = CLASS_COLORS[stage.cls] || FALLBACK_COLORS[(Number(stage.id) - 1) % FALLBACK_COLORS.length];
    const groups = extractGroups(stage.html);
    const count = groups.reduce((n, g) => n + g.rows.length, 0);

    if (count === 0) {
      // Bearer stage (no order codes) → optional bridge block.
      const matrix = extractMatrix(stage.html);
      if (matrix.length) {
        bridge = {
          heading: `Giai đoạn ${stage.id} · ${heading || 'Đường truyền'}`,
          intro: note ? `${note} — bearer nằm sẵn trong thiết bị, không có mã đặt hàng riêng.` : '',
          rows: matrix,
        };
        console.log(`  Giai đoạn ${stage.id}: bearer (${matrix.length} tuyến) → mục "Ghép nối"`);
      } else {
        console.log(`  Giai đoạn ${stage.id}: 0 mã (bỏ qua)`);
      }
      continue;
    }

    total += count;
    sections.push({
      id: stage.id,
      short: SHORT[stage.id] || `GĐ ${stage.id}`,
      color,
      heading,
      note,
      groups,
    });
    console.log(`  Giai đoạn ${stage.id}: ${count} mã · ${groups.length} nhóm`);
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
    subtitle: meta.subtitle || 'Bộ cách ly, chuyển đổi, thu thập, truyền thông và giám sát tín hiệu của Seneca (Ý) do HOANTRANTDH phân phối.',
    intro: `Tổng ${total} mã theo chuỗi tín hiệu 7 giai đoạn (nguồn: Short Form Catalog SFC_2401EN).`,
    groupType: 'stage',
    sources: meta.sources || [{ label: 'Trang chủ Seneca', url: 'https://www.seneca.it' }],
    sections,
  };
  if (bridge) out.bridge = bridge;

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n✔ Đã ghi ${OUTPUT} — ${sections.length} giai đoạn có mã · ${total} mã${bridge ? ' + 1 mục Ghép nối' : ''}.`);
  if (total !== 478) {
    console.warn(`⚠ Trích được ${total} mã (kỳ vọng 478). Kiểm tra lại selector trong extractGroups().`);
  }
}

main();
