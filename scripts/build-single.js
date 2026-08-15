#!/usr/bin/env node
// =====================================================================
// scripts/build-single.js
// Bundle the whole hub — home page + every brand catalogue — into ONE
// self-contained HTML file (inline CSS + JS, no external requests).
// Client-side hash router switches between a home view and one view per
// brand; each brand view runs its own scoped search / filter / copy /
// document-toggle. Output: dist/catalog-hub.html
//
//   node scripts/build-single.js
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');
const OUT = path.join(DIST_DIR, 'catalog-hub.html');

const {
  escapeHtml, hexToRgba, countCodes, renderSection, renderBridge, renderSources,
} = require(path.join(SRC_DIR, 'template'));

// ---- per-brand view -----------------------------------------------------

function renderFilters(data) {
  const btns = [`<button class="filter-btn active" data-filter="all" type="button">TẤT CẢ</button>`];
  for (const s of data.sections || []) {
    btns.push(
      `<button class="filter-btn" data-filter="${escapeHtml(s.id)}" type="button">` +
        `<span class="tag">${escapeHtml(s.id)}</span>${escapeHtml(s.short || s.id)}</button>`
    );
  }
  if (data.bridge) btns.push(`<button class="filter-btn" data-filter="bridge" type="button">Ghép nối</button>`);
  btns.push(
    `<button class="filter-btn copy-btn js-copyFiltered" type="button" title="Chép toàn bộ mã đang hiển thị (TSV)">⧉ Chép mã đang lọc</button>`
  );
  return btns.join('');
}

function renderBrandView(data) {
  const total = countCodes(data);
  const accent = data.accent || '#C8102E';
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

  return (
    `<div class="view brand-view" data-view="${escapeHtml(data.brand)}" data-title="${escapeHtml(title)}" ` +
      `style="--accent:${escapeHtml(accent)};--accent-soft:${hexToRgba(accent, 0.1)}" hidden>` +
      `<div class="wrap"><section class="hero">` +
        (data.tagline ? `<p class="eyebrow">${escapeHtml(data.tagline)}</p>` : '') +
        `<h1>${h1}</h1>` +
        (data.subtitle ? `<p class="lead">${escapeHtml(data.subtitle)}</p>` : '') +
        (data.intro ? `<p class="lead">${escapeHtml(data.intro)}</p>` : '') +
        `<div class="pills">${stats.join('')}</div>` +
        renderSources(data.sources) +
      `</section></div>` +
      `<div class="controls"><div class="wrap controls-inner">` +
        `<div class="search-row">` +
          `<div class="search-box">` +
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>` +
            `<input class="js-search" type="search" autocomplete="off" spellcheck="false" placeholder="Tìm theo mã hoặc mô tả…" aria-label="Tìm kiếm mã đặt hàng" />` +
          `</div>` +
          `<div class="counter js-counter" aria-live="polite"></div>` +
        `</div>` +
        `<div class="filters">${renderFilters(data)}</div>` +
      `</div></div>` +
      `<main class="wrap">` +
        sectionsHtml + bridgeHtml +
        `<div class="empty js-empty"><div class="big">Không tìm thấy mã nào khớp</div><div class="sub">Thử từ khoá khác hoặc bấm “TẤT CẢ”.</div></div>` +
        (data.note_end ? `<p class="note-end">${escapeHtml(data.note_end)}</p>` : '') +
      `</main>` +
    `</div>`
  );
}

// ---- home view ----------------------------------------------------------

function renderHomeCard(entry) {
  const d = entry.data;
  const accent = d.accent || '#888888';
  const isEmpty = entry.total === 0;
  const count = isEmpty
    ? `<span class="soon">Sắp cập nhật</span>`
    : `<span class="bc-count"><span class="n">${entry.total}</span> mã</span>`;
  return (
    `<a class="brand-card${isEmpty ? ' empty-brand' : ''}" href="#/${escapeHtml(d.brand)}" ` +
      `data-nav="brand" data-brand="${escapeHtml(d.brand)}" style="--card-accent:${escapeHtml(accent)}">` +
      `<div class="bc-top"><span class="bc-name">${escapeHtml(d.name)}</span>` +
      (d.country ? `<span class="bc-flag">${escapeHtml(d.country)}</span>` : '') + `</div>` +
      `<p class="bc-tag">${escapeHtml(d.tagline || d.subtitle || '')}</p>` +
      `<div class="bc-foot">${count}<span class="bc-go">Xem danh mục →</span></div>` +
    `</a>`
  );
}

function renderHomeView(entries) {
  const sorted = entries.slice().sort((a, b) => {
    if ((a.total === 0) !== (b.total === 0)) return a.total === 0 ? 1 : -1;
    return b.total - a.total;
  });
  const grand = entries.reduce((n, e) => n + e.total, 0);
  const live = entries.filter((e) => e.total > 0).length;
  return (
    `<div class="view view-home" data-view="home">` +
      `<div class="wrap"><section class="home-hero">` +
        `<p class="eyebrow">TRA CỨU MÃ ĐẶT HÀNG · MULTI-BRAND</p>` +
        `<h1>Trung tâm danh mục<br />sản phẩm HOANTRANTDH</h1>` +
        `<p class="lead">Tra cứu nhanh mã đặt hàng của mọi hãng do HOANTRANTDH phân phối. Lọc realtime theo mã hoặc mô tả, bấm để chép mã, tải tài liệu kỹ thuật và xuất danh sách đang lọc ra Excel.</p>` +
        `<div class="pills" style="margin-top:18px">` +
          `<span class="pill"><b>${live}</b> hãng đang có dữ liệu</span>` +
          `<span class="pill"><b>${grand}</b> mã tra cứu được</span>` +
          `<span class="pill"><b>${entries.length}</b> hãng trong hệ thống</span>` +
        `</div>` +
      `</section></div>` +
      `<main class="wrap"><div class="brand-grid">${sorted.map(renderHomeCard).join('')}</div></main>` +
    `</div>`
  );
}

// ---- client runtime (serialized) ----------------------------------------

function bundleScript() {
  var views = Array.prototype.slice.call(document.querySelectorAll('.brand-view'));
  var homeView = document.querySelector('.view-home');
  var homeLink = document.querySelector('.js-homelink');
  var toast = document.getElementById('toast');
  var toastMsg = document.getElementById('toastMsg');
  var toastTimer = null;

  function toastShow(html) {
    toastMsg.innerHTML = html;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); resolve();
      } catch (e) { reject(e); }
    });
  }

  function initView(root) {
    var q = root.querySelector('.js-search');
    var counter = root.querySelector('.js-counter');
    var filters = Array.prototype.slice.call(root.querySelectorAll('.filter-btn[data-filter]'));
    var codeRows = Array.prototype.slice.call(root.querySelectorAll('.code-row'));
    var bridgeRows = Array.prototype.slice.call(root.querySelectorAll('.bridge-row'));
    var sections = Array.prototype.slice.call(root.querySelectorAll('.cat'));
    var bridgeBlock = root.querySelector('.bridge');
    var groups = Array.prototype.slice.call(root.querySelectorAll('.group'));
    var empty = root.querySelector('.js-empty');
    var totalCodes = codeRows.length;
    var activeFilter = 'all';
    function normalize(s) { return (s || '').toLowerCase(); }

    function apply() {
      var query = normalize(q.value.trim());
      var visibleCodes = 0;
      codeRows.forEach(function (row) {
        var inSection = activeFilter === 'all' || row.getAttribute('data-section') === activeFilter;
        var inQuery = query === '' || row.getAttribute('data-search').indexOf(query) !== -1;
        var show = inSection && inQuery && activeFilter !== 'bridge';
        row.hidden = !show; if (show) visibleCodes++;
      });
      var visibleBridge = 0;
      bridgeRows.forEach(function (row) {
        var inSection = activeFilter === 'all' || activeFilter === 'bridge';
        var inQuery = query === '' || row.getAttribute('data-search').indexOf(query) !== -1;
        var show = inSection && inQuery; row.hidden = !show; if (show) visibleBridge++;
      });
      groups.forEach(function (g) { g.hidden = g.querySelectorAll('.code-row:not([hidden])').length === 0; });
      sections.forEach(function (s) { s.hidden = s.querySelectorAll('.code-row:not([hidden])').length === 0; });
      if (bridgeBlock) bridgeBlock.hidden = visibleBridge === 0;
      if (activeFilter === 'bridge') counter.innerHTML = 'Ghép nối: <b>' + visibleBridge + '</b> tuyến';
      else counter.innerHTML = 'Đang hiện <b>' + visibleCodes + '</b> / ' + totalCodes + ' mã';
      var nothing = (activeFilter === 'bridge') ? visibleBridge === 0 : visibleCodes === 0;
      empty.classList.toggle('show', nothing);
    }

    q.addEventListener('input', apply);
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active'); activeFilter = btn.getAttribute('data-filter'); apply();
      });
    });
    var copyBtn = root.querySelector('.js-copyFiltered');
    copyBtn.addEventListener('click', function () {
      var lines = [];
      if (activeFilter === 'bridge') {
        bridgeRows.forEach(function (row) { if (!row.hidden) { var k = row.querySelector('.k'); var v = row.querySelector('.v'); lines.push((k ? k.textContent : '') + '\t' + (v ? v.textContent : '')); } });
      } else {
        codeRows.forEach(function (row) { if (!row.hidden) { var c = row.querySelector('.code'); var d = row.querySelector('.desc-text') || row.querySelector('.desc'); lines.push((c ? c.getAttribute('data-code') : '') + '\t' + (d ? d.textContent : '')); } });
      }
      if (!lines.length) { toastShow('Không có dòng nào để chép'); return; }
      copyText(lines.join('\n')).then(function () { toastShow('<span class="ic">✓</span> Đã chép <b>' + lines.length + '</b> dòng (TSV) — dán vào Excel'); });
    });
    apply();
  }
  views.forEach(initView);

  // global click delegation: doc toggle, code copy, nav
  document.addEventListener('click', function (e) {
    var tgl = e.target.closest ? e.target.closest('.doc-toggle') : null;
    if (tgl) { var list = tgl.parentNode.querySelector('.doc-list'); if (list) { var open = list.hidden; list.hidden = !open; tgl.setAttribute('aria-expanded', open ? 'true' : 'false'); tgl.classList.toggle('open', open); } return; }
    var cell = e.target.closest ? e.target.closest('td.code') : null;
    if (cell) {
      var code = cell.getAttribute('data-code');
      copyText(code).then(function () {
        cell.classList.add('copied');
        var row = cell.closest('tr'); if (row) { row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 700); }
        setTimeout(function () { cell.classList.remove('copied'); }, 700);
        toastShow('<span class="ic">✓</span> Đã chép <code>' + code + '</code>');
      });
      return;
    }
    var nav = e.target.closest ? e.target.closest('[data-nav]') : null;
    if (nav) { e.preventDefault(); var to = nav.getAttribute('data-nav'); location.hash = to === 'home' ? '#/' : '#/' + nav.getAttribute('data-brand'); }
  });

  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var target = h ? document.querySelector('.brand-view[data-view="' + h + '"]') : null;
    views.forEach(function (v) { v.hidden = v !== target; });
    homeView.hidden = !!target;
    if (homeLink) homeLink.hidden = !target;
    window.scrollTo(0, 0);
    document.title = target ? target.getAttribute('data-title') : 'HOANTRANTDH · Product Catalog Hub';
  }
  window.addEventListener('hashchange', route);
  route();
}

// ---- assemble -----------------------------------------------------------

function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort();
  const entries = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    entries.push({ data, total: countCodes(data) });
  }
  // populated brands first, empties last
  const ordered = entries.slice().sort((a, b) => {
    if ((a.total === 0) !== (b.total === 0)) return a.total === 0 ? 1 : -1;
    return b.total - a.total;
  });

  const css = fs.readFileSync(path.join(SRC_DIR, 'styles.css'), 'utf8');
  const homeHtml = renderHomeView(entries);
  const brandsHtml = ordered.map((e) => renderBrandView(e.data)).join('\n');
  const grand = entries.reduce((n, e) => n + e.total, 0);

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HOANTRANTDH · Product Catalog Hub</title>
<meta name="description" content="Trung tâm tra cứu mã đặt hàng đa hãng HOANTRANTDH — ${grand} mã, tất cả trong một trang." />
<style>
${css}
/* single-file bundle helpers */
.view[hidden]{display:none !important}
.topbar .home-link[hidden]{display:none}
</style>
<style>:root{--accent:#0B5FFF;--accent-soft:${hexToRgba('#0B5FFF', 0.1)};}</style>
</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand-badge" href="#/" data-nav="home">HOANTRANTDH</a>
    <span class="breadcrumb">Product Catalog Hub</span>
    <span class="spacer"></span>
    <a class="home-link js-homelink" href="#/" data-nav="home" hidden>← Tất cả hãng</a>
  </div>
</header>

${homeHtml}
${brandsHtml}

<footer class="site-footer">
  <div class="wrap">
    <span>© HOANTRANTDH · Product Catalog Hub — tra cứu mã đặt hàng đa hãng.</span>
    <span>File đơn · ${grand} mã · ${entries.length} hãng.</span>
  </div>
</footer>

<div class="toast" id="toast"><span id="toastMsg"></span></div>
<script>(${bundleScript.toString()})();</script>
</body>
</html>`;

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`✔ ${path.relative(ROOT, OUT)} — ${entries.length} hãng · ${grand} mã · ${kb} KB (1 file)`);
}

main();
