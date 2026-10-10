# まのさばキャラクターの追加

人物図鑑の立ち絵をデザイン資料として、内蔵imagegenで13人の顔だけの透過PNGを新規生成し、ゲームへ組み込んだ。立ち絵の縮小・貼り付けではない。参照元は `C:\Project\MANOSABA_RESEARCH\EVIDENCE\harness_probe` の画像。立ち絵そのものは配布物に含めない。

| アセットID | 人物 | 参照画像 |
| --- | --- | --- |
| `ema.png` | 桜羽エマ | `people_profiles/P01.png` |
| `hiro.png` | 二階堂ヒロ | `people_profiles/P02.png` |
| `annan.png` | 夏目アンアン | `people_profiles/P03.png` |
| `noah.png` | 城ヶ崎ノア | `people_profiles/P04.png` |
| `reia.png` | 蓮見レイア | `people_profiles/P05.png` |
| `miria.png` | 佐伯ミリア | `people_profiles/P06.png` |
| `margo.png` | 宝生マーゴ | `people_profiles/P07.png` |
| `nanoka.png` | 黒部ナノカ | `people_profiles/P08.png` |
| `arisa.png` | 紫藤アリサ | `people_profiles/P09.png` |
| `sherie.png` | 橘シェリー | `people_profiles_right/R08.png` |
| `hanna.png` | 遠野ハンナ | `people_profiles_right/R09.png` |
| `koko.png` | 沢渡ココ | `people_last/L3.png` |
| `meruru.png` | 氷上メルル | `people_last/L4.png` |

現在使用する画像は上記IDと同名の `public/art/*.png`。既存動物は従来のSVGを使用する。人物の旧SVGと `tools/generate-manosaba-art.mjs` は以前の案として残しているが、現在の人物表示には使わない。

PNGは600×396、ゲームの従来比率200×132の3倍解像度。生成元画像に透明画素が存在することを確認し、透明余白を除いた頭部を最大540×354に収め、下端と影を揃えた。画像の輪郭・表情はimagegenで描いたものを使用し、コードで描き直していない。

同サイズの比較は `artifacts/manosaba-imagegen-sheet.png`。ブラウザの選択画面とゲーム画面は `artifacts/manosaba-picker-*.png` と `artifacts/manosaba-play-*.png`。

## 参考デザインに合わせた調整

エマは白い髪、ピンクの毛先、黒いベレー帽、白とピンクの花、クロスピンを維持した。初回生成で全員の目と笑顔が似すぎたため、各立ち絵を改めて参照し、目・眉・口を人物別に再生成した。

ヒロは鋭い赤い目と短い閉じた口、アンアンは伏し目、ミリアは驚いた丸い口、ナノカは平らなまぶた、シェリーは目を閉じた笑顔、ココは猫の瞳と牙、メルルは下がった目と不安な口。髪・帽子・装飾に加えて表情でも区別できるようにした。

## 制作元と再出力

- `art/imagegen/originals/*.png`: 採用した生成原本13枚。
- `art/imagegen/manosaba-prompts.json`: 各立ち絵の対応、初回生成と表情修正の実際のプロンプト。修正時は初回生成画像と立ち絵を参照画像として渡した。
- `node tools/import-manosaba-images.mjs`: 保存済み原本から表示用PNGを再出力。alphaの存在を確認して余白・サイズ・影を整えるだけの処理。
- `node tools/preview-manosaba-images.mjs`: 同サイズの比較画像を再出力。

画風そのものの再生成にはimagegenが必要。上記スクリプトだけで絵を生成することはできない。

当初のInkscape作画はComputer Useの入力エラーで進められなかった。その後のユーザー指定によりimagegen制作へ切り替えた。今回のPNGをInkscapeで描いた成果物とは扱わない。

ローカル起動は `npm run build` の後に `npm start`。`http://localhost:5177/` を開く。E2E検証で既存のChromiumを使う場合は、`PLAYWRIGHT_CHROMIUM_EXECUTABLE` にブラウザ実行ファイルを指定して `npm run test:e2e` を実行する。

## PNG差し替えの変更範囲

`src/animals.ts` のアセットURL指定、`src/scene.ts` の説明コメント、`tools/serve.mjs` のPNG MIME、制作用sharp依存、画像取り込み・比較スクリプト、関連E2Eテストを更新した。選択画面・塔・ボタンは従来の共通アセットURLをそのまま利用する。背景・ボタン配置・積み上げピッチ・ゲーム判定・タイマー・スコア処理の変更はない。

## 検証

PNG差し替え後、単体テスト45件とビルドが成功。全E2Eの初回は62成功・4失敗・16スキップ。失敗は、SVG拡張子固定の期待値と、画像読み込み前にdebug操作していたテストの2種類が各画面サイズで発生した。期待値を実際のアセット指定に合わせ、起動準備完了を待つよう修正した。

初回の全E2Eでは、40秒の実プレイ、スコア、ミス、入力、既存動物、画像混在、AutoReset、画面回転・小画面を確認した。スマートフォンはPixel 7相当のChromiumエミュレーションで、実機ではない。16スキップはローカル自動入力専用・実API接続専用・デスクトップでは対象外のモバイル専用ケース。Inkscapeでの作画と実APIへのスコア登録は今回の検証対象外。

修正後は、上記の失敗4件と人物関連4件、追加した全13人の左右表示2件を再実行し、10件すべて成功した。全員を左右それぞれに設定して塔の実PNG読み込みと横方向の見切れを確認。初回と再実行を合わせた異なるE2Eケースは68件成功で、全E2Eを再度一括実行した結果ではない。比較・選択・人物同士の積み上げ・既存動物との混在のスクリーンショットを目視確認した。スマートフォン実機は未検証。
