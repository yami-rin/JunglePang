# まのさばキャラクターの追加

人物図鑑の立ち絵をデザイン資料とし、ゲーム用には顔だけの新規SVGを描いた。立ち絵そのものは配布物に含めない。参照元は `C:\Project\MANOSABA_RESEARCH\EVIDENCE\harness_probe` の画像で、`people_profiles/P01.png` は桜羽エマ。ほかの12人も同じ人物図鑑の以下の画面を参照した。

| SVG | 人物 | 参照画像 |
| --- | --- | --- |
| `ema.svg` | 桜羽エマ | `people_profiles/P01.png` |
| `hiro.svg` | 二階堂ヒロ | `people_profiles/P02.png` |
| `annan.svg` | 夏目アンアン | `people_profiles/P03.png` |
| `noah.svg` | 城ヶ崎ノア | `people_profiles/P04.png` |
| `reia.svg` | 蓮見レイア | `people_profiles/P05.png` |
| `miria.svg` | 佐伯ミリア | `people_profiles/P06.png` |
| `margo.svg` | 宝生マーゴ | `people_profiles/P07.png` |
| `nanoka.svg` | 黒部ナノカ | `people_profiles/P08.png` |
| `arisa.svg` | 紫藤アリサ | `people_profiles/P09.png` |
| `sherie.svg` | 橘シェリー | `people_profiles_right/R08.png` |
| `hanna.svg` | 遠野ハンナ | `people_profiles_right/R09.png` |
| `koko.svg` | 沢渡ココ | `people_last/L3.png` |
| `meruru.svg` | 氷上メルル | `people_last/L4.png` |

SVGは既存動物と同じ `200 × 132` のviewBox、太さ3〜4の輪郭、横長の頭部、楕円影に揃えた。再生成は `node tools/generate-manosaba-art.mjs`。同サイズの比較は `artifacts/manosaba-sheet.png`、選択画面とゲーム画面の確認画像は `artifacts/manosaba-picker-*.png` と `artifacts/manosaba-play-*.png` にある。

## 参考デザインに合わせた調整

エマは白い大きな髪束、ピンクの毛先、傾いた黒いベレー帽、白とピンクの花、クロスピンを持つ丸い顔として描き直した。ほかの12人も濃い輪郭線と、目・頬・口の表現を揃えた。変更はSVGと制作スクリプトに限定し、ゲームの配置・判定・ルールは変更していない。

このSVG案はコードで制作した。Inkscape 1.4.4ポータブル版をローカルに用意し、Computer UseでエマのSVGを開いたが、キャンバスのクリックとドラッグは `SendInput sent 0 of 1 events; GetLastError=87` で失敗した。Inkscape上での作画・修正は未完了であり、GUIで描いた成果物とは扱わない。

ローカル起動は `npm run build` の後に `npm start`。`http://localhost:5177/` を開く。E2E検証で既存のChromiumを使う場合は、`PLAYWRIGHT_CHROMIUM_EXECUTABLE` にブラウザ実行ファイルを指定して `npm run test:e2e` を実行する。

2026-10-10の検証では単体テスト45件、ビルド、デスクトップ・Pixel 7相当のE2E66件が成功した。E2E16件はローカル自動入力専用、実API接続専用、デスクトップでは対象外のモバイル専用ケースとしてスキップされた。キャラ選択、左右の重複禁止、スコア、40秒タイマー、ミス、既存動物との混在、AutoReset、画面回転を確認し、選択画面・ゲーム画面のスクリーンショットを更新した。スマートフォン実機とInkscape上での作画は未検証・未完了。
