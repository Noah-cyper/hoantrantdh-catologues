#!/usr/bin/env node
// =====================================================================
// build.js
// Read every data/*.json -> validate -> render dist/<brand>.html
// + dist/index.html, and copy src/styles.css to dist/.
//
//   node build.js            one-shot build
//   node build.js --watch    rebuild on data/ or src/ change
//   node build.js --serve    also serve dist/ on http://localhost:3000
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const SERVE = args.includes('--serve');
const PORT = Number(process.env.PORT) || 3000;

function freshRequire(modPath) {
  delete require.cache[require.resolve(modPath)];
  return require(modPath);
}

// ---- validation ---------------------------------------------------------

function validate(data, file) {
  const errors = [];
  if (!data || typeof data !== 'object') errors.push('không phải object JSON');
  if (!data.brand) errors.push('thiếu "brand" (slug)');
  if (!data.name) errors.push('thiếu "name"');
  if (!Array.isArray(data.sections)) errors.push('"sections" phải là mảng');
  const expectSlug = path.basename(file, '.json');
  if (data.brand && data.brand !== expectSlug) {
    errors.push(`"brand" ("${data.brand}") phải trùng tên file ("${expectSlug}")`);
  }
  for (const [i, section] of (data.sections || []).entries()) {
    if (!section || typeof section !== 'object') { errors.push(`sections[${i}] không hợp lệ`); continue; }
    if (section.id == null) errors.push(`sections[${i}] thiếu "id"`);
    if (section.groups && !Array.isArray(section.groups)) errors.push(`sections[${i}].groups phải là mảng`);
    for (const [j, group] of (section.groups || []).entries()) {
      if (group.rows && !Array.isArray(group.rows)) errors.push(`sections[${i}].groups[${j}].rows phải là mảng`);
      for (const [k, row] of (group.rows || []).entries()) {
        if (!Array.isArray(row) || row.length < 1) {
          errors.push(`sections[${i}].groups[${j}].rows[${k}] phải là [mã, mô tả]`);
        }
      }
    }
  }
  return errors;
}

// ---- build --------------------------------------------------------------

function build() {
  const { renderBrandPage, countCodes } = freshRequire('./src/template');
  const { renderIndexPage } = freshRequire('./src/index-template');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`✖ Không tìm thấy thư mục data/ (${DATA_DIR})`);
    process.exit(1);
  }

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (!files.length) {
    console.error('✖ Không có file data/*.json nào.');
    process.exit(1);
  }

  const entries = [];
  let hadError = false;

  for (const file of files) {
    const full = path.join(DATA_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.error(`✖ ${file}: JSON lỗi cú pháp — ${e.message}`);
      hadError = true;
      continue;
    }
    const errors = validate(data, file);
    if (errors.length) {
      console.error(`✖ ${file}: ${errors.join('; ')}`);
      hadError = true;
      continue;
    }
    const total = countCodes(data);
    const html = renderBrandPage(data);
    fs.writeFileSync(path.join(DIST_DIR, `${data.brand}.html`), html, 'utf8');
    entries.push({ data, total });
    console.log(`  ✓ ${data.brand}.html  (${total} mã)`);
  }

  if (!entries.length) {
    console.error('✖ Không build được hãng nào.');
    process.exit(1);
  }

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), renderIndexPage(entries), 'utf8');
  console.log(`  ✓ index.html  (${entries.length} hãng)`);

  // Copy shared stylesheet.
  fs.copyFileSync(path.join(SRC_DIR, 'styles.css'), path.join(DIST_DIR, 'styles.css'));
  // .nojekyll keeps GitHub Pages from touching the output.
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');

  const grand = entries.reduce((n, e) => n + e.total, 0);
  console.log(`\n✔ Build xong: ${entries.length} trang hãng · ${grand} mã · dist/`);

  if (hadError) {
    console.error('⚠ Có file bị bỏ qua do lỗi (xem trên). Exit code 1.');
    process.exitCode = 1;
  }
  return entries;
}

// ---- watch + serve ------------------------------------------------------

function startServer() {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  http
    .createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(DIST_DIR, path.normalize(urlPath));
      if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    })
    .listen(PORT, () => console.log(`\n➜ Serve: http://localhost:${PORT}`));
}

function startWatch() {
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('\n↻ Thay đổi phát hiện — build lại…');
      try { build(); } catch (e) { console.error(e); }
    }, 120);
  };
  for (const dir of [DATA_DIR, SRC_DIR]) {
    fs.watch(dir, { recursive: false }, rebuild);
  }
  console.log('👀 Watching data/ và src/ …');
}

// ---- main ---------------------------------------------------------------

build();
if (SERVE) startServer();
if (WATCH) startWatch();
if (!WATCH && !SERVE) { /* one-shot; exit code set above */ }
