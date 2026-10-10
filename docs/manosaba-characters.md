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
