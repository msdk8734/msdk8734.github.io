# 杉本博司 パブリックアートマップ — プロジェクト引き継ぎ（第4版）

## プロジェクト概要

杉本博司のパブリックアート・建築・恒久設置インスタレーションを世界地図上にマッピングする。  
GitHub Pages（`msdk8734.github.io`）の既存ビジュアライゼーションサイトに追加済み。

---

## 技術スタック

- **地図ライブラリ**: Leaflet.js + OpenStreetMap
- **タイル**: OpenStreetMap（`brightness(0.62) grayscale(0.8) contrast(1.0) saturate(0.6)` でグレー化）
- **データ形式**: `data/sugimoto.json`（JSONファイル、HTMLとは別ファイル）
- **ホスティング**: GitHub Pages（`msdk8734.github.io`）
- **デザイン**: 杉本博司公式サイト（sugimotohiroshi.com）の基調色に統一

---

## ファイル構成

```
msdk8734.github.io/
├── index.html                    ← トップページ（杉本マップのカード追加済み）
├── sugimoto-map.html             ← 杉本マップ本体
├── data/
│   └── sugimoto.json             ← 作品データ（16件）
├── shrines-temples-map.html
├── japan-population-map-2025.html
├── japan-population-pyramid.html
├── tokyo-heatmap.html
├── ramen-map.html
├── newspaper-circulation.html
└── page-view-ranking.html
```

---

## デザイン仕様

### カラーパレット（公式サイト準拠）

| CSS変数 | 値 | 用途 |
|---|---|---|
| `--bg` | `#808081` | 背景（公式サイトの正確な値） |
| `--surface` | `#737374` | サイドバー・パネル背景 |
| `--border` | `#686869` | ボーダー |
| `--border-mid` | `#757576` | 中間ボーダー |
| `--text-primary` | `#eeeeec` | メインテキスト |
| `--text-secondary` | `#d0d2d0` | サブテキスト |
| `--text-muted` | `#b0b4b2` | ミュートテキスト |
| `--accent` | `#7a9aa8` | アクセント（公式サイトのNEWS & EVENT色） |

### カテゴリ別マーカー色

| category | 色 | 意味 |
|---|---|---|
| `architecture` | `#e8d8b8` | 建築プロジェクト |
| `sculpture` | `#a8c8d8` | 彫刻 |
| `installation` | `#c8a8d8` | インスタレーション |
| `permanent-collection` | `#a8d8c0` | 美術館の恒久展示 |

### フォント
- **ヘッダータイトル**（`Hiroshi Sugimoto`）: Cormorant Garamond・ウェイト300・スペーシング広め・大文字
  - 公式サイトは `garamond-premier-pro-display 300`（Adobe Fonts専用）のためCormorant Garamondで代替
- **サブタイトル・UI全般**: IBM Plex Sans（既存サイトと統一）
- **モノスペース部分**: IBM Plex Mono

---

## sugimoto.json の構造

```json
{
  "id": 1,
  "name": "作品名（英語）",
  "nameJa": "作品名（日本語）",
  "year": 2017,
  "location": "住所（英語）",
  "locationJa": "住所（日本語）",
  "country": "Japan",
  "category": "architecture",
  "access": "reservation",
  "lat": 35.1882,
  "lng": 139.1345,
  "description": "作品説明（英語）",
  "url": "https://..."
}
```

### access の種別
| 値 | 意味 |
|---|---|
| `public` | 常時公開 |
| `reservation` | 要予約 |
| `limited` | 期間限定・条件付き |

---

## 現在の作品リスト（16件）

| id | 作品名 | 国 | 年 | category | access |
|---|---|---|---|---|---|
| 1 | Enoura Observatory | Japan | 2017 | architecture | reservation |
| 2 | Go'o Shrine (Art House Project) | Japan | 2002 | architecture | reservation |
| 3 | Coffin of Light | Japan | 2009 | installation | public |
| 4 | Concept of Moss | Japan | 2009 | sculpture | public |
| 5 | Glass Tea House "Mondrian" | Japan | 2014 | architecture | reservation |
| 6 | Hiroshi Sugimoto Gallery: Time Corridors | Japan | 2022 | architecture | reservation |
| 7 | MOA Museum of Art (Renovation) | Japan | 2017 | architecture | public |
| 8 | Kukkyo-cho / Mathematical Model 013 | Japan | 2013 | installation | public |
| 9 | SUNDIAL | Japan | 2018 | sculpture | public |
| 10 | Point of Infinity | USA | 2023 | sculpture | public |
| 11 | Hirshhorn Museum Lobby Redesign | USA | 2018 | architecture | public |
| 12 | Hirshhorn Sculpture Garden Redesign | USA | 2026 | architecture | public |
| 13 | Mathematical Model 012 | France | 2010 | sculpture | public |
| 14 | Confession of Zero | Italy | 2014 | installation | limited |
| 15 | Japan Society Atrium Garden | USA | 2017 | architecture | public |
| 16 | Time Exposed | Japan | 2006 | permanent-collection | public |

**サイドバーの表示順**: 国別（Japan → USA → France → Italy）→ 年代順

---

## 実装済みの機能

### 地図
- **初期表示**: 日本中心（`[35.5, 138]`、zoom 3）
- **移動範囲制限**: `maxBounds: [[-80, -100], [85, 370]]`（東西の無限ループ防止）
- **USAの作品**: マーカーを `lng + 360°` に配置（日本から東回りで見えるようにするため）
- **マーカークリック**: zoom 17 にフライイン → 右上の情報パネルが開く（PC・スマホ共通）

### ヘッダー
- タイトルのみ（`Hiroshi Sugimoto` / `Public Art & Architecture Map`）
- カウントバッジなし・フィルターなし

### サイドバー（PCのみ表示）
- 作品リストのみ（フィルターなし）
- 国別→年代順でソート
- 作品クリックで zoom 17 にフライイン

### 情報パネル
- 地図右上に固定表示（`top: 68px; right: 16px; width: 260px`）
- 作品名・日本語名・年・カテゴリ・アクセス・場所・説明・Learn more リンクを表示
- ✕ボタンで閉じる
- Leaflet の popup は使用していない（独自実装）

### リセットボタン
- 地図左下に常時表示（PC・スマホ共通）
- タップで初期表示（日本中心・zoom 3）に戻り、情報パネルも閉じる

### スマホ対応
- サイドバー非表示
- **ボトムシート**（2段階）
  - peek: ハンドルのみ（48px）
  - half: 画面の 40vh（1回タップまたは上スワイプ）
  - open: 画面の 80vh（2回タップまたは上スワイプ）
  - シートの `height` と `#bottom-sheet-list` の `max-height` を JS で明示的にピクセル計算して設定
  - ハンドル部分のタッチのみ開閉操作、リスト部分のスワイプはスクロールとして機能
  - 作品タップで zoom 17 にフライイン → シートが peek に閉じる
- ズームコントロール（＋／－）をボトムシートより上に配置（`bottom: 56px`）

---

## index.html のカード

杉本マップのカードを3番目（Shrines & Temples の次）に追加済み。  
プレビューエリアは SVG で世界地図の大陸輪郭 + カテゴリ別カラードットを描画。  
タグ: `Public Art Map` / メタタグ: `Leaflet.js / Public Art / Architecture`

---

## 重要な注意点

### UIの要素を削除する際の手順
HTML要素・CSS・**JSの参照コードをすべて同時に削除**すること。  
例：カウントバッジ（`visible-count`）を削除した際、`buildList`関数内の  
`document.getElementById('visible-count')` と `countEl.textContent = ...` が残っていると  
null参照エラーでサイドバーの描画がクラッシュする。

### 作品を追加する際の手順
1. `sugimoto.json` に新しい作品を追記する
2. USAの作品は `country: "USA"` にすれば自動で `lng+360°` に配置される
3. HTMLは変更不要（fetchで自動読み込み）

### ローカルでの動作確認
`fetch('data/sugimoto.json')` はブラウザのセキュリティ制限により、HTMLファイルを直接ダブルクリックで開くと失敗する。  
ローカル確認には VS Code の Live Server 等の簡易サーバーを使うこと。  
GitHub Pages 上では問題なく動作する。

### 地図の東西配置について
- ヨーロッパ・日本の作品: 通常の経度で配置
- USAの作品: `lng + 360°` で配置（日本から東に進んでアメリカに到達できるようにするため）
- 西端 `-100°` 〜 東端 `370°` の範囲内に全作品が収まっている

---

## 除外した作品（参考）

| 作品名 | 理由 |
|---|---|
| Glass Tea House — Venice（2014–2016） | 一時展示 |
| Glass Tea House — Versailles（2018–2019） | 一時展示 |
| Glass Tea House — Kyoto（2020） | 一時展示 |
| IZU PHOTO MUSEUM（静岡・長泉） | 2021年閉館 |
| ISETAN SALONE（東京ミッドタウン） | 商業施設内装（判断保留） |
