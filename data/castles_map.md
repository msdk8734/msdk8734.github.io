# 🏯 Japanese Castle Map — 引き継ぎメモ

## プロジェクト概要

**URL:** `https://msdk8734.github.io/castles-map.html`  
**リポジトリ:** `msdk8734.github.io`（GitHub Pages）  
**概要:** 日本100名城・続100名城（計200城）をLeaflet.js + OpenStreetMapでインタラクティブにマッピングするWebアプリ

---

## ファイル構成

```
msdk8734.github.io/
├── index.html               ← サイトのギャラリーページ（城マップのカードあり）
├── castles-map.html         ← 城マップ本体
└── data/
    └── castles.json         ← 城データ（200件）
```

---

## castles.json スキーマ（最新版）

ChatGPT が検証・整備した `castles_verified_all_audited_v3.json` を採用。全200件 `verification_confidence: "high"`。

```json
{
  "id": 801,
  "list_type": "100",           // "100" | "continued_100"
  "number": 1,                  // リスト内の番号
  "name_ja": "根室半島チャシ跡群",
  "reading_ja": "ねむろはんとうちゃしあとぐん",
  "name_en": "Nemuro Peninsula Chashi Ruins",
  "prefecture": "北海道",
  "prefecture_en": "Hokkaido",
  "tower_status": "ruins",      // 下記5種類
  "is_national_treasure": false,
  "built_year": null,
  "lat": 43.39075,
  "lng": 145.66838,
  "coordinate_type": "site_center",
  "locations": { "site_center": { "lat": 43.39075, "lng": 145.66838 } },
  "notes_ja": "",
  "source_primary": "https://jcastle.info/...",
  "verification_confidence": "high",
  "verification_note": "..."
}
```

### `tower_status` の値（5種類）

| 値 | 説明 | 色 |
|---|---|---|
| `existing` | 現存天守（12城） | 金 #f0c040・グロー |
| `reconstructed_wood` | 木造復元 | 緑 #4caf7d |
| `reconstructed_concrete` | RC復興 | 青 #4a90c8 |
| `replica` | 模擬天守 | オレンジ #e07d40 |
| `ruins` | 遺構・跡地のみ | ベージュ #c8b89a |

### `list_type` の値

| 値 | 意味 |
|---|---|
| `"100"` | 日本100名城（1〜100番） |
| `"continued_100"` | 続日本100名城（101〜200番） |

---

## castles-map.html の構造

### 技術スタック

- **Leaflet.js 1.9.4**（CDN）
- **OpenStreetMap** タイル
- **Google Fonts**: Cinzel（英語）+ Noto Serif JP（日本語）
- バニラJS（フレームワークなし）、単一HTMLファイル

### レイアウト（デスクトップ）

```
┌─────────────────────────────────────────────┐
│ header（ヘッダー）                           │
│  🏯タイトル ｜ フィルター群 ｜ ⌂Reset View  │
├────────────────────────────┬────────────────┤
│                            │ Sidebar(256px) │
│  地図（Leaflet）           │  Stats         │
│                            │  Legend        │
│  [⌂][+][-]                │  12 Surviving  │
│   ↑地図上リセットボタン    │  By Prefecture │
└────────────────────────────┴────────────────┘
```

### レイアウト（スマホ ≤680px）

```
┌────────────────────────────┐
│ header（タイトルのみ）      │
├────────────────────────────┤
│                            │
│  地図（Leaflet）           │
│  [⌂]                      │
│                            │
├────────────────────────────┤
│ ボトムパネル（mob-panel）  │
│  BEST 100 / NEXT 100 / All │
│  Type / ★Nat.Treasure      │
│  Stats（4つ横並び）        │
│  Legend（横並び）          │
└────────────────────────────┘
```

### デザインテーマ（CSS変数）

```css
--ink:        #1a1209   /* 背景（ほぼ黒）*/
--parchment:  #f5f0e8   /* テキスト */
--gold:       #c9921a   /* アクセント */
--gold-light: #e8b84b   /* 明るい金 */
--silver:     #8a9aaa   /* サブテキスト */
--panel-bg:   rgba(20,15,8,0.94)
--border:     rgba(201,146,26,0.35)
```

### 地図タイルフィルター

```css
/* デスクトップ */
.leaflet-tile { filter: brightness(0.7) saturate(0.5) hue-rotate(185deg); }
/* スマホ（明るめ） */
@media (max-width:680px) {
  .leaflet-tile { filter: brightness(0.88) saturate(0.55) hue-rotate(185deg); }
}
```

---

## 主な機能と実装の注意点

### フィルター（List / Type / Nat. Treasure）

- デスクトップ: ヘッダー内 `#fw`
- スマホ: ボトムパネル `.mob-panel` 内
- `bindFilters(root)` 関数で両方に同じイベントを付与
- デスクトップ・スマホのボタンが **連動** して `on` クラスが切り替わる

```js
fList = 'all' | '100' | 'continued_100'
fType = 'all' | 'existing' | 'reconstructed' | 'ruins'
fNat  = true | false
```

### マーカークリック・サイドバークリック → ズームイン

```js
// zoom 17（max 18の1手前）まで flyTo → 1.2秒後にポップアップ
map.flyTo([c.lat, c.lng], 17, {animate:true, duration:1.2});
setTimeout(()=>this.openPopup(), 1300);
```

- すでに zoom ≥ 17 の場合はズームせずそのままポップアップ
- サイドバーの「12 Surviving Keeps」クリックも同じ挙動
- **タッチ対応**: `m.on('click', ...)` で明示的にポップアップを開く

### リセットボタン（日本全体表示に戻る）

```js
const INITIAL_CENTER = [36.2, 137.0];
const INITIAL_ZOOM   = 5;
function resetView() {
  map.flyTo(INITIAL_CENTER, INITIAL_ZOOM, {animate:true, duration:1.0});
}
```

- **デスクトップ**: ヘッダーの `#reset-btn`（`⌂ Reset View`）
- **スマホ含む全環境**: 地図左上の Leaflet custom control（`⌂` ボタン）

### 都道府県ランキング（By Prefecture）

- サイドバー下部にバー付きランキング
- クリックでその都道府県の城群に `fitBounds`（スマホでは非表示）

### スマホ用ボトムパネルの高さ調整

```js
// パネルの実際の高さ分だけ地図のpaddingBottomを設定
function adjustMapForPanel() { ... }
window.addEventListener('resize', adjustMapForPanel);
setTimeout(adjustMapForPanel, 100);
```

---

## データについての注意

### 公式ナンバリング・城名
- jokaku.jp で全件照合済み ✅
- 100名城1〜100番、続100名城101〜200番、欠番・重複なし

### 座標の精度
- ChatGPT が jcastle.info 等で全200件を1件ずつ再照合
- 全件 `coordinate_type: "site_center"` = 本丸・主郭の代表点
- 七尾城などの大幅ずれを修正済み
- **ただし完全ではない可能性あり**。気になる城はGoogleマップで確認して報告 → 即修正可能

### 座標修正方法（Googleマップ）

1. Googleマップで「○○城跡」を検索
2. PC: ピンを右クリック → 座標が表示 → クリックでコピー
3. スマホ: ピンを長押し → 上部に座標表示
4. `castles.json` の該当城の `lat` / `lng` を更新

---

## ローカル起動方法

JSONをfetch経由で読み込むため、ファイルをブラウザで直接開くと `CORS` エラーになる。

```bash
cd msdk8734.github.io
python3 -m http.server 8000
# → http://localhost:8000/castles-map.html
```

---

## 現存12天守（tower_status: "existing"）

| No. | 城名 | 都道府県 | 座標 |
|-----|------|----------|------|
| 4 | 弘前城 | 青森県 | 40.608, 140.465 |
| 29 | 松本城 | 長野県 | 36.239, 137.969 |
| 36 | 丸岡城 | 福井県 | 36.152, 136.272 |
| 43 | 犬山城 | 愛知県 | 35.388, 136.939 |
| 50 | 彦根城 | 滋賀県 | 35.276, 136.252 |
| 59 | 姫路城 | 兵庫県 | 34.838, 134.693 |
| 64 | 松江城 | 島根県 | 35.475, 133.050 |
| 68 | 備中松山城 | 岡山県 | 34.809, 133.622 |
| 78 | 丸亀城 | 香川県 | 34.286, 133.800 |
| 81 | 松山城 | 愛媛県 | 33.845, 132.766 |
| 83 | 宇和島城 | 愛媛県 | 33.219, 132.565 |
| 84 | 高知城 | 高知県 | 33.561, 133.531 |

---

## 今後の改善候補

- [ ] 座標の精査（まだズレている可能性のある城がある）
- [ ] `notes_ja` が空の89件に説明文を追加
- [ ] 検索機能（城名で検索して絞り込み）
- [ ] スタンプラリー達成管理機能（localStorageで訪問済みを記録）
- [ ] ポップアップに訪問ボタン・評価等を追加
