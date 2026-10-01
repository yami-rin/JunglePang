# 公開運用

- ゲームURL: https://yami-rin.github.io/JunglePang/
- ソース: https://github.com/yami-rin/JunglePang
- 配信先: GitHub Pages、公開・ログイン不要、HTTPS
- 配信対象: `npm run build` の出力 `dist/` のみ。Nodeサーバーやローカルの検証資料はゲームサイトへ配置しない
- 自動更新: `.github/workflows/pages.yml`。`main` のゲーム・検証・ビルド設定変更、または手動起動で実行
- 公開前のcheck: `npm ci` → `npm test` → `npm run build`。失敗したビルドは公開しない

スマホは縦画面でURLを開き、スタート後に左右の動物ボタンをタップする。PCや同じWi-Fiへの接続は不要。音は最初の操作で有効化される。記録は各端末・ブラウザ内に保存され、共有ランキングはない。

## 反映確認

Actionsの成功だけで完了とせず、公開URLを認証なしで読み込み、通常モードの開始・入力・画面サイズを確認する。`PANG_E2E_URL` を公開URLにすると、既存のPlaywright試験を公開サイトへ実行できる。URL末尾の `/` を含める。

## 復旧と公開停止

不具合が出た場合は変更したcommitを `git revert` して `main` に通常pushし、前のゲーム内容を再公開する。履歴を改変しない。以前のバージョンを試すだけなら、ソースを別の作業ディレクトリへcheckoutしてローカルでビルドする。

公開を止める場合は、このrepositoryの Settings → Pages → Unpublish site を実行し、自動更新workflowを無効化する。公開URLは利用不能になる。再開時はPagesのSourceをGitHub Actionsに設定し、workflowを有効化して手動実行する。

GitHub Pagesの公式手順: [カスタムworkflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。無料の標準URLを使用し、独自ドメイン・有料サービスは設定しない。
