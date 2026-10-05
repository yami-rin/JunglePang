# 公開運用

- ゲームURL: https://yami-rin.github.io/JunglePang/
- ソース: https://github.com/yami-rin/JunglePang
- 配信先: GitHub Pages、公開・ログイン不要、HTTPS
- 配信対象: `npm run build` の出力 `dist/` のみ。Nodeサーバーやローカルの検証資料はゲームサイトへ配置しない
- 自動更新: `.github/workflows/pages.yml`。`main` のゲーム・検証・ビルド設定変更、または手動起動で実行
- 公開前のcheck: `npm ci` → `npm test` → `npm run build`。失敗したビルドは公開しない

スマホは縦画面でURLを開き、スタート後に左右の動物ボタンをタップする。PCや同じWi-Fiへの接続は不要。音は最初の操作で有効化される。端末内のベストに加え、任意でニックネームと完走記録を全国ランキングへ登録できる。

## ランキングAPI

- API: https://jungle-pang-ranking.y4m1r1n.workers.dev
- Worker名: `jungle-pang-ranking`
- DB: 同名のCloudflare D1。`wrangler.toml` の専用DBへ接続し、他のアプリのDBは利用しない
- API反映: 認証済みの環境で `npm run deploy:api`。未適用migrationを実行してからWorkerを配信
- ゲームURLは維持する。公開APIの設定は `src/ranking-config.json`
- NGネーム辞書は `src/ng-names.json`。語・例外・照合方式を変更したら辞書の `version` を増やし、APIを先に配信してフロントも再ビルド・公開する。編集時の確認は [name-policy.md](name-policy.md) を参照。既存名は取得時にNG部分だけを半角 `*` にするため、DBのUPDATEや得点の削除は不要
- API反映後に `/api/health`、`/api/ranking` と、通常の40秒ラウンドからの登録を確認する
- 0.3.0のmigrationは既存の得点を残したまま端末別の表を追加する。APIを先に更新し、`/api/ranking?category=all|mobile|pc` の取得を確認してからゲームを公開する
- 0.3.4では `0003_round_rules.sql` でラウンドのルール版を追加する。既存ラウンドは版2のまま、更新後の発行は版3（最大4連続）になる。最高記録の書換・削除は行わない。APIの `/api/health` が版3になったことを確認してからフロントを配信する
- 0.3.5はAPIを先に配信し、`/api/health` の `autoResetVersion: 1` を確認してからフロントを配信する。AutoResetの試行番号から並びを再生できることを単体・完走登録で確認する。DBのmigrationや既存記録の書換は不要
- 0.4.1で自動入力ツールを公開版から削除。ローカルの開発サーバーだけに残す。`npm run build` は公開HTML・JS・CSSへの自動入力の混入も検査する。公開URLの `?tool=auto-input` が通常画面になり、ボタン・ダイアログがなく、自動採点が発生せず、手動入力・自己ベスト・AutoReset・ランキングが維持されることを確認する。Worker・DBの変更は不要
- `tests/ranking.test.ts` は実際のSQLをインメモリSQLiteへ実行して保存・並び順・改ざん・再送・期限・制限を検証する
- 通常の自動試験は公開得点を作らない。実配信への書込試験を明示有効化した際は、検証用IDだけの `device_scores`、`rounds`、`players` を確認・削除する

参加トークンを画面・ログ・Gitへ出さない。管理はCloudflareの既存認証から行い、アプリに管理APIや管理トークンは置かない。公開するデータと不正対策の限界は [仕様](specification.md) を参照。

Cloudflareの公式資料: [D1のWorker API](https://developers.cloudflare.com/d1/worker-api/)。

## 反映確認

Actionsの成功だけで完了とせず、公開URLを認証なしで読み込み、通常モードの開始・入力・画面サイズを確認する。`PANG_E2E_URL` を公開URLにすると、既存のPlaywright試験を公開サイトへ実行できる。URL末尾の `/` を含める。

## 復旧と公開停止

不具合が出た場合は変更したcommitを `git revert` して `main` に通常pushし、前のゲーム内容を再公開する。履歴を改変しない。以前のバージョンを試すだけなら、ソースを別の作業ディレクトリへcheckoutしてローカルでビルドする。

APIだけを戻す場合は以前のソースで `wrangler deploy`、またはCloudflareのWorkerバージョンからロールバックする。DBを削除しない。migrationの巻戻しは得点が失われる可能性があるため、Time Travelなどのバックアップと対象を確認して別途行う。停止する場合はWorkerの配信を停止し、フロントのAPI URLを空文字にして再ビルドすれば端末内だけで遊べる。

公開を止める場合は、このrepositoryの Settings → Pages → Unpublish site を実行し、自動更新workflowを無効化する。公開URLは利用不能になる。再開時はPagesのSourceをGitHub Actionsに設定し、workflowを有効化して手動実行する。

GitHub Pagesの公式手順: [カスタムworkflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。無料の標準URLを使用し、独自ドメイン・有料サービスは設定しない。
