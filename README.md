# HOANTRANTDH · Product Catalog Hub

Web tra cứu **mã đặt hàng (order code) đa hãng**, chạy tĩnh, deploy GitHub Pages.
Mỗi hãng phân phối là **một trang tra cứu độc lập** với cùng bộ chức năng: lọc realtime,
lọc theo nhóm, bấm-để-chép-mã, "chép mã đang lọc" ra TSV cho Excel, bộ đếm và trạng thái rỗng.

Giao diện tiếng Việt · code + comment tiếng Anh · **vanilla JS + Node build script** · không framework, không runtime, không `localStorage`.

## Kiến trúc — data-driven

Toàn bộ nội dung nằm trong `data/<brand>.json`. **Thêm hãng mới = thêm 1 file JSON + chạy build.**
Không sửa code render khi thêm hãng.

```
data/*.json  ──►  build.js  ──►  dist/<brand>.html + dist/index.html + dist/styles.css
                   │
                   ├─ src/template.js        render 1 trang hãng → HTML (kèm client JS inline)
                   ├─ src/index-template.js  render trang chủ liệt kê các hãng
                   └─ src/styles.css         1 CSS dùng chung; accent per-page qua biến --accent
```

## Chạy

```bash
npm run build         # sinh dist/  (đọc mọi data/*.json)
npm run build:single  # + gộp toàn bộ hub vào 1 file: dist/catalog-hub.html
npm run dev           # build + watch data/ & src/ + serve http://localhost:3000
npm run serve         # build + serve tĩnh
```

**File đơn (offline):** `npm run build:single` sinh `dist/catalog-hub.html` — **một file HTML tự chứa** (inline CSS + JS, không cần mạng) gồm trang chủ + tất cả hãng, điều hướng bằng router `#/<brand>`; mỗi hãng có search/lọc/chép/tải tài liệu riêng. Gửi file này cho ai cũng mở được bằng trình duyệt, không cần server.

Không có dependency runtime — `npm run build` chỉ cần Node ≥ 18.

## Thêm một hãng mới

1. Tạo `data/<slug>.json` (xem `data/flowline.json` làm mẫu chuẩn). Tối thiểu cần `brand`, `name`, `sections`.
2. `npm run build` → tự sinh `dist/<slug>.html` và card trên `dist/index.html`.
3. `git push` → GitHub Actions build & deploy lên Pages.

> `brand` **phải trùng tên file** (không đuôi). Ví dụ `data/georgin.json` → `"brand": "georgin"` → `/georgin.html`.

### Schema `data/<brand>.json`

```jsonc
{
  "brand": "flowline",              // slug = tên file, dùng cho URL /flowline.html
  "name": "FLOWLINE",               // hiển thị lớn
  "country": "USA",                 // (optional) badge nước trên card trang chủ
  "tagline": "Made in USA · Level Measurement",
  "accent": "#C8102E",              // màu nhận diện → biến CSS --accent
  "title": "…",                     // <title> trang
  "subtitle": "…", "intro": "…",    // mô tả đầu trang (optional)
  "groupType": "tech",              // "tech" (Nhóm A/B…) | "stage" (Giai đoạn 1–7) — chỉ đổi nhãn
  "sources": [ { "label": "…", "url": "https://…" } ],
  "sections": [
    {
      "id": "A", "short": "Radar", "color": "#128377",
      "heading": "…", "note": "…",  // note optional (in nghiêng)
      "groups": [
        { "name": "A.1 …", "rows": [ ["MÃ", "mô tả"], ["MÃ2", "mô tả2"] ] }
      ]
    }
  ],
  "bridge": {                       // OPTIONAL — mục "Ghép nối"
    "heading": "…", "intro": "…",
    "rows": [ ["Tuyến 1 …", "mô tả tuyến"] ]
  },
  "note_end": "…"                   // ghi chú cuối trang (optional)
}
```

**Quy tắc render:**

- Tổng số mã = đếm mọi `rows` trong mọi `groups`/`sections`.
- Nút lọc sinh tự động: `TẤT CẢ` + mỗi `section.id · short` + `Ghép nối` (nếu có `bridge`) + `Chép mã đang lọc`.
- Search khớp trên `mã + " " + mô tả`, không phân biệt hoa thường, có dấu.
- `Chép mã đang lọc` gom đúng các dòng đang hiển thị theo filter + query hiện tại → TSV (`mã⇥mô tả`).
- Màu số thứ tự / badge mỗi section lấy từ `section.color`; accent tổng trang từ `accent`.

## Các hãng

| Hãng | Nước | groupType | Trạng thái |
|---|---|---|---|
| **Flowline** | USA | tech (A–N) | ✅ 112 mã · 315 tài liệu · 14 nhóm (toàn bộ catalog flowline.com, datasheet/manual/quick-start) |
| **Seneca** | Italy | stage (1–7) | ✅ 478 mã · 33 nhóm + Ghép nối (từ Short Form Catalog SFC_2401EN qua `scripts/migrate-seneca.js`) |
| **Georgin** | France | tech (A–C) | ✅ 46 mã · 190 tài liệu · 3 nhóm (fiche technique/CE/ATEX từ georgin.com) |
| **Dinel** | Czech | tech (A–H) | ✅ 37 mã · 67 tài liệu · 8 nhóm (datasheet/manual/ATEX từ dinel.cz) |
| **Comac Cal** | Czech | tech (A–E) | ✅ 16 mã · 39 tài liệu · 5 nhóm (datasheet/manual/Modbus/M-Bus từ comaccal.com) |
| **Termotech** | Italy | tech (A–C) | ✅ 12 mã · dòng duyệt DNV hàng hải (RTD/thermocouple/thermowell từ CATALOGO_SPECIALI) |
| **Broadsens** | USA | tech (A–F) | ✅ 24 mã · 26 tài liệu · 6 nhóm (cảm biến rung/nhiệt độ không dây + gateway, từ broadsens.com) |
| **ei3** | USA | tech (A–D) | ✅ 23 mã · 4 nhóm (ConnectedAI · gateway edge · phân tích · bảo mật — nhập từ nhánh mặc định) |
| **SmartConnect IoT** | France | tech (A) | ✅ 4 module nền tảng (edge · cloud · analytics · AI/ML) từ smartconnectiot.com |
| **Anhui Tiankang** | China | tech | ⏳ khung |
| **HOANTRANTDH ISOLATION** | OEM | tech | ⏳ khung |

> Nguyên tắc: **không tự bịa mã** — chỉ nhập mã có nguồn từ catalog chính hãng.

### Migrate Seneca (478 mã)

Dữ liệu Seneca đến từ file HTML tra cứu 7 giai đoạn (Short Form Catalog `SFC_2401EN`):

```bash
# đặt file nguồn tại scripts/seneca-source.html (hoặc truyền đường dẫn)
node scripts/migrate-seneca.js [path/to/seneca-source.html]
npm run build
```

Script tách 7 giai đoạn ("Giai đoạn N"), trích mọi cặp `[mã, mô tả]`, xuất `data/seneca.json`
đúng schema (`groupType: "stage"`, `id` = "1".."7"), giữ nguyên mô tả tiếng Việt.

## Deploy — GitHub Pages

`.github/workflows/deploy.yml`: push lên `main` → `npm run build` → deploy `dist/` bằng
`actions/upload-pages-artifact` + `actions/deploy-pages`.

Bật Pages: **Settings → Pages → Source = GitHub Actions**.

`dist/` được `.gitignore` — output sinh khi build, không commit vào repo.
