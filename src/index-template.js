// =====================================================================
// src/index-template.js
// Render the hub home page: one card per brand.
// Input: array of { data, total } summaries produced by build.js.
// =====================================================================

'use strict';

const { escapeHtml, hexToRgba } = require('./template');

function renderCard(entry) {
  const d = entry.data;
  const accent = d.accent || '#888888';
  const isEmpty = entry.total === 0;
  const countHtml = isEmpty
    ? `<span class="soon">Sắp cập nhật</span>`
    : `<span class="bc-count"><span class="n">${entry.total}</span> mã</span>`;
  return (
    `<a class="brand-card${isEmpty ? ' empty-brand' : ''}" href="./${escapeHtml(d.brand)}.html" ` +
      `style="--card-accent:${escapeHtml(accent)}">` +
      `<div class="bc-top">` +
        `<span class="bc-name">${escapeHtml(d.name)}</span>` +
        (d.country ? `<span class="bc-flag">${escapeHtml(d.country)}</span>` : '') +
      `</div>` +
      `<p class="bc-tag">${escapeHtml(d.tagline || d.subtitle || '')}</p>` +
      `<div class="bc-foot">` +
        countHtml +
        `<span class="bc-go">Xem danh mục →</span>` +
      `</div>` +
    `</a>`
  );
}

function renderIndexPage(entries) {
  // Populated brands first (by count desc), empty/skeleton brands after.
  const sorted = entries.slice().sort((a, b) => {
    if ((a.total === 0) !== (b.total === 0)) return a.total === 0 ? 1 : -1;
    return b.total - a.total;
  });

  const grandTotal = entries.reduce((n, e) => n + e.total, 0);
  const liveBrands = entries.filter((e) => e.total > 0).length;
  const cards = sorted.map(renderCard).join('');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HOANTRANTDH · Product Catalog Hub</title>
<meta name="description" content="Trung tâm tra cứu mã đặt hàng đa hãng do HOANTRANTDH phân phối — Flowline, Seneca, Georgin, Dinel, Termotech, Anhui Tiankang và bộ cách ly tín hiệu HOANTRANTDH." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="./styles.css" />
<style>:root{--accent:#0B5FFF;--accent-soft:${hexToRgba('#0B5FFF', 0.1)};}</style>
</head>
<body>
<header class="topbar">
  <div class="wrap">
    <a class="brand-badge" href="./index.html">HOANTRANTDH</a>
    <span class="breadcrumb">Product Catalog Hub</span>
  </div>
</header>

<div class="wrap">
  <section class="home-hero">
    <p class="eyebrow">TRA CỨU MÃ ĐẶT HÀNG · MULTI-BRAND</p>
    <h1>Trung tâm danh mục<br />sản phẩm HOANTRANTDH</h1>
    <p class="lead">Tra cứu nhanh mã đặt hàng của mọi hãng do HOANTRANTDH phân phối. Lọc realtime theo mã hoặc mô tả, bấm để chép mã, xuất danh sách đang lọc ra Excel để gửi hỏi giá.</p>
    <div class="pills" style="margin-top:18px">
      <span class="pill"><b>${liveBrands}</b> hãng đang có dữ liệu</span>
      <span class="pill"><b>${grandTotal}</b> mã tra cứu được</span>
      <span class="pill"><b>${entries.length}</b> hãng trong hệ thống</span>
    </div>
  </section>
</div>

<main class="wrap">
  <div class="brand-grid">${cards}</div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <span>© HOANTRANTDH · Product Catalog Hub — tra cứu mã đặt hàng đa hãng.</span>
    <span>Site tĩnh · cập nhật bằng cách thả JSON &amp; build lại.</span>
  </div>
</footer>
</body>
</html>`;
}

module.exports = { renderIndexPage };
