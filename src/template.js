// =====================================================================
// src/template.js
// Render a single brand's lookup page (data object -> HTML string).
// Pure function of the JSON: adding a brand never touches this file.
// =====================================================================

'use strict';

// ---- small HTML helpers -------------------------------------------------

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Value used inside a data-* attribute for search. Lower-cased, quote-safe.
function searchKey(code, desc) {
  return escapeHtml((String(code) + ' ' + String(desc)).toLowerCase());
}

// #RRGGBB (or #RGB) -> "rgba(r,g,b,alpha)". Falls back gracefully.
function hexToRgba(hex, alpha) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Count every [code, desc] row across all sections/groups.
function countCodes(data) {
  let n = 0;
  for (const section of data.sections || []) {
    for (const group of section.groups || []) {
      n += (group.rows || []).length;
    }
  }
  return n;
}

// ---- section / group rendering -----------------------------------------

function renderRow(row) {
  const code = row[0];
  const desc = row[1] == null ? '' : row[1];
  return (
    `<tr class="code-row" data-kind="code" data-section="__SEC__" data-search="${searchKey(code, desc)}">` +
      `<td class="code" data-code="${escapeHtml(code)}" title="Bấm để chép mã">${escapeHtml(code)}</td>` +
      `<td class="desc">${escapeHtml(desc)}</td>` +
    `</tr>`
  );
}

function renderGroup(group) {
  const rows = (group.rows || []).map(renderRow).join('');
  return (
    `<div class="group">` +
      (group.name ? `<h3 class="group-name">${escapeHtml(group.name)}</h3>` : '') +
      `<table class="code-table"><tbody>${rows}</tbody></table>` +
    `</div>`
  );
}

function renderSection(section, groupType) {
  const secColor = section.color || 'var(--accent)';
  const kicker = groupType === 'stage' ? `Giai đoạn ${escapeHtml(section.id)}` : `Nhóm ${escapeHtml(section.id)}`;
  const groupsHtml = (section.groups || [])
    .map(renderGroup)
    .join('')
    .replace(/__SEC__/g, escapeHtml(section.id));
  return (
    `<section class="cat" id="sec-${escapeHtml(section.id)}" data-section="${escapeHtml(section.id)}" ` +
      `style="--sec-color:${escapeHtml(secColor)}">` +
      `<div class="cat-head">` +
        `<div class="cat-num">${escapeHtml(section.id)}</div>` +
        `<div class="meta">` +
          `<div class="cat-label">` +
            `<span class="cat-kicker">${kicker}</span>` +
            (section.short ? `<span class="cat-short">${escapeHtml(section.short)}</span>` : '') +
          `</div>` +
          (section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : '') +
          (section.note ? `<p class="cat-note">${escapeHtml(section.note)}</p>` : '') +
        `</div>` +
      `</div>` +
      groupsHtml +
    `</section>`
  );
}

function renderBridge(bridge) {
  if (!bridge) return '';
  const rows = (bridge.rows || [])
    .map(
      (r) =>
        `<tr class="bridge-row" data-kind="bridge" data-section="bridge" ` +
          `data-search="${searchKey(r[0], r[1])}">` +
          `<td class="k" data-code="${escapeHtml(r[0])}">${escapeHtml(r[0])}</td>` +
          `<td class="v">${escapeHtml(r[1] == null ? '' : r[1])}</td>` +
        `</tr>`
    )
    .join('');
  return (
    `<section class="bridge" id="sec-bridge" data-section="bridge">` +
      `<h2><span class="dot"></span>${escapeHtml(bridge.heading || 'Ghép nối')}</h2>` +
      (bridge.intro ? `<p class="intro">${escapeHtml(bridge.intro)}</p>` : '') +
      `<table class="bridge-table"><tbody>${rows}</tbody></table>` +
    `</section>`
  );
}

// ---- filter buttons -----------------------------------------------------

function renderFilters(data) {
  const buttons = [
    `<button class="filter-btn active" data-filter="all" type="button">TẤT CẢ</button>`,
  ];
  for (const section of data.sections || []) {
    buttons.push(
      `<button class="filter-btn" data-filter="${escapeHtml(section.id)}" type="button">` +
        `<span class="tag">${escapeHtml(section.id)}</span>${escapeHtml(section.short || section.id)}` +
      `</button>`
    );
  }
  if (data.bridge) {
    buttons.push(`<button class="filter-btn" data-filter="bridge" type="button">Ghép nối</button>`);
  }
  buttons.push(
    `<button class="filter-btn copy-btn" id="copyFiltered" type="button" title="Chép toàn bộ mã đang hiển thị (TSV)">` +
      `⧉ Chép mã đang lọc</button>`
  );
  return buttons.join('');
}

function renderSources(sources) {
  if (!sources || !sources.length) return '';
  const items = sources
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label || s.url)}</a></li>`
    )
    .join('');
  return (
    `<div class="sources">` +
      `<h4>Tài liệu gốc</h4>` +
      `<ul>${items}</ul>` +
    `</div>`
  );
}

// ---- client-side interactivity (serialized, fully self-contained) -------

function clientScript() {
  var q = document.getElementById('search');
  var counter = document.getElementById('counter');
  var filters = Array.prototype.slice.call(document.querySelectorAll('.filter-btn[data-filter]'));
  var codeRows = Array.prototype.slice.call(document.querySelectorAll('.code-row'));
  var bridgeRows = Array.prototype.slice.call(document.querySelectorAll('.bridge-row'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cat'));
  var bridgeBlock = document.getElementById('sec-bridge');
  var groups = Array.prototype.slice.call(document.querySelectorAll('.group'));
  var empty = document.getElementById('emptyState');
  var toast = document.getElementById('toast');
  var toastMsg = document.getElementById('toastMsg');
  var totalCodes = codeRows.length;
  var activeFilter = 'all';
  var toastTimer = null;

  function normalize(s) { return (s || '').toLowerCase(); }

  function toastShow(html) {
    toastMsg.innerHTML = html;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function apply() {
    var query = normalize(q.value.trim());
    var visibleCodes = 0;

    codeRows.forEach(function (row) {
      var inSection = activeFilter === 'all' || row.getAttribute('data-section') === activeFilter;
      var inQuery = query === '' || row.getAttribute('data-search').indexOf(query) !== -1;
      var show = inSection && inQuery && activeFilter !== 'bridge';
      row.hidden = !show;
      if (show) visibleCodes++;
    });

    var visibleBridge = 0;
    bridgeRows.forEach(function (row) {
      var inSection = activeFilter === 'all' || activeFilter === 'bridge';
      var inQuery = query === '' || row.getAttribute('data-search').indexOf(query) !== -1;
      var show = inSection && inQuery;
      row.hidden = !show;
      if (show) visibleBridge++;
    });

    // Hide empty groups, then empty sections.
    groups.forEach(function (g) {
      var any = g.querySelectorAll('.code-row:not([hidden])').length > 0;
      g.hidden = !any;
    });
    sections.forEach(function (s) {
      var any = s.querySelectorAll('.code-row:not([hidden])').length > 0;
      s.hidden = !any;
    });
    if (bridgeBlock) bridgeBlock.hidden = visibleBridge === 0;

    // Counter.
    if (activeFilter === 'bridge') {
      counter.innerHTML = 'Ghép nối: <b>' + visibleBridge + '</b> tuyến';
    } else {
      counter.innerHTML = 'Đang hiện <b>' + visibleCodes + '</b> / ' + totalCodes + ' mã';
    }

    // Empty state.
    var nothing = (activeFilter === 'bridge') ? visibleBridge === 0 : visibleCodes === 0;
    empty.classList.toggle('show', nothing);
    if (nothing) {
      var big = empty.querySelector('.big');
      var sub = empty.querySelector('.sub');
      var noData = totalCodes === 0 && q.value.trim() === '' && activeFilter === 'all';
      if (big) big.textContent = noData ? 'Danh mục đang được cập nhật' : 'Không tìm thấy mã nào khớp';
      if (sub) sub.textContent = noData
        ? 'Dữ liệu mã của hãng này sẽ được bổ sung từ catalog chính hãng.'
        : 'Thử từ khoá khác hoặc bấm “TẤT CẢ”.';
    }
  }

  // Search input.
  q.addEventListener('input', apply);

  // Filter buttons.
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      apply();
    });
  });

  // Click a code cell -> copy single code.
  document.addEventListener('click', function (e) {
    var cell = e.target.closest ? e.target.closest('td.code') : null;
    if (!cell) return;
    var code = cell.getAttribute('data-code');
    copyText(code).then(function () {
      cell.classList.add('copied');
      var row = cell.closest('tr');
      if (row) { row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 700); }
      setTimeout(function () { cell.classList.remove('copied'); }, 700);
      toastShow('<span class="ic">✓</span> Đã chép <code>' + code + '</code>');
    });
  });

  // Copy all currently-visible rows as TSV (code<TAB>desc).
  var copyBtn = document.getElementById('copyFiltered');
  copyBtn.addEventListener('click', function () {
    var lines = [];
    if (activeFilter === 'bridge') {
      bridgeRows.forEach(function (row) {
        if (!row.hidden) {
          var k = row.querySelector('.k');
          var v = row.querySelector('.v');
          lines.push((k ? k.textContent : '') + '\t' + (v ? v.textContent : ''));
        }
      });
    } else {
      codeRows.forEach(function (row) {
        if (!row.hidden) {
          var c = row.querySelector('.code');
          var d = row.querySelector('.desc');
          lines.push((c ? c.getAttribute('data-code') : '') + '\t' + (d ? d.textContent : ''));
        }
      });
    }
    if (!lines.length) { toastShow('Không có dòng nào để chép'); return; }
    copyText(lines.join('\n')).then(function () {
      toastShow('<span class="ic">✓</span> Đã chép <b>' + lines.length + '</b> dòng (TSV) — dán vào Excel');
    });
  });

  apply();
}

// ---- full page ----------------------------------------------------------

function renderBrandPage(data) {
  const total = countCodes(data);
  const accent = data.accent || '#C8102E';
  const accentSoft = hexToRgba(accent, 0.1);
  const title = data.title || `${data.name} — Danh mục mã đặt hàng`;
  const sectionsHtml = (data.sections || []).map((s) => renderSection(s, data.groupType)).join('');
  const bridgeHtml = renderBridge(data.bridge);

  const stats = [
    `<span class="pill"><b>${total}</b> mã đặt hàng</span>`,
    `<span class="pill"><b>${(data.sections || []).length}</b> ${data.groupType === 'stage' ? 'giai đoạn' : 'nhóm'}</span>`,
  ];
  if (data.tagline) stats.push(`<span class="pill">${escapeHtml(data.tagline)}</span>`);

  const h1 = data.subtitle
    ? `${escapeHtml(data.name)} — <span class="count-hl">${total}</span> mã`
    : `${escapeHtml(data.name)} <span class="count-hl">${total}</span> mã`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(data.subtitle || data.intro || title)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="./styles.css" />
<style>:root{--accent:${escapeHtml(accent)};--accent-soft:${accentSoft};}</style>
</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand-badge" href="./index.html">${escapeHtml(data.name)}</a>
    <span class="breadcrumb">Danh mục mã đặt hàng</span>
    <span class="spacer"></span>
    <a class="home-link" href="./index.html">← Tất cả hãng</a>
  </div>
</header>

<div class="wrap">
  <section class="hero">
    ${data.tagline ? `<p class="eyebrow">${escapeHtml(data.tagline)}</p>` : ''}
    <h1>${h1}</h1>
    ${data.subtitle ? `<p class="lead">${escapeHtml(data.subtitle)}</p>` : ''}
    ${data.intro ? `<p class="lead">${escapeHtml(data.intro)}</p>` : ''}
    <div class="pills">${stats.join('')}</div>
    ${renderSources(data.sources)}
  </section>
</div>

<div class="controls">
  <div class="wrap controls-inner">
    <div class="search-row">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input id="search" type="search" autocomplete="off" spellcheck="false"
          placeholder="Tìm theo mã hoặc mô tả…" aria-label="Tìm kiếm mã đặt hàng" />
      </div>
      <div class="counter" id="counter" aria-live="polite"></div>
    </div>
    <div class="filters">${renderFilters(data)}</div>
  </div>
</div>

<main class="wrap">
  ${sectionsHtml}
  ${bridgeHtml}
  <div class="empty" id="emptyState">
    <div class="big">Không tìm thấy mã nào khớp</div>
    <div class="sub">Thử từ khoá khác hoặc bấm “TẤT CẢ”.</div>
  </div>
  ${data.note_end ? `<p class="note-end">${escapeHtml(data.note_end)}</p>` : ''}
</main>

<footer class="site-footer">
  <div class="wrap">
    <span>HOANTRANTDH · Product Catalog Hub — ${escapeHtml(data.name)}</span>
    <a href="./index.html">Về trang chủ</a>
  </div>
</footer>

<div class="toast" id="toast"><span id="toastMsg"></span></div>

<script>(${clientScript.toString()})();</script>
</body>
</html>`;
}

module.exports = { renderBrandPage, escapeHtml, hexToRgba, countCodes };
