# Git/GitHub MCP Server

Git と GitHub 操作のための Model Context Protocol (MCP) サーバー

## 概要

このパッケージは、Claude などの AI アシスタントが Git および GitHub の操作を実行できるようにするための MCP サーバーを提供します。Git リポジトリの管理や GitHub の Pull Request 作成・レビューなどの機能を AI アシスタントから直接利用できるようになります。

## 機能

### Git 操作

- リポジトリのステータス確認 (`git status`)
- ファイルのステージング追加 (`git add`)
- 変更のコミット (`git commit`)
- リモートへのプッシュ (`git push`)
- ファイルの移動 (`git mv`)
- ファイルの削除 (`git rm`)
- ブランチの作成 (`git checkout -b`)
- ブランチの切り替え (`git checkout`)

### GitHub 操作

- Pull Request の作成
- Pull Request の一覧取得
- Pull Request の詳細取得
- Pull Request の差分取得
- Pull Request へのレビューコメント追加
- Pull Request へのレビュー提出

## インストール

このパッケージはローカルからインストールします：

```bash
# リポジトリのディレクトリに移動
cd /path/to/git-github

# 依存関係をインストール
npm install

# ビルド
npm run build

# グローバルにインストール
npm install -g .
```

## 使い方

### 1. GitHub トークンの取得

GitHub API を使用するには、個人アクセストークンが必要です。以下の手順で取得してください：

1. GitHub にログイン
2. 右上のプロフィールアイコン → Settings
3. 左メニューの Developer settings → Personal access tokens → Tokens (classic)
4. Generate new token → 適切な権限を選択（repo, pull_requests など）
5. トークンを生成してコピー

### 2. MCP 設定ファイルの編集

Claude デスクトップアプリの場合は `~/Library/Application Support/Claude/claude_desktop_config.json` を、VSCode の Roo Cline 拡張機能の場合は `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json` を編集します。

```json
{
  "mcpServers": {
    "git-github": {
      "command": "git-github",
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

### 3. AI アシスタントでの使用例

Claude などの AI アシスタントで以下のように使用できます：

```
リポジトリのステータスを確認してください。

use_mcp_tool
server_name: git-github
tool_name: git_status
arguments: {
  "path": "/path/to/your/repo"
}
```

```
main ブランチから feature ブランチを作成してください。

use_mcp_tool
server_name: git-github
tool_name: git_branch_create
arguments: {
  "path": "/path/to/your/repo",
  "branch": "feature/new-feature"
}
```

```
Pull Request を作成してください。

use_mcp_tool
server_name: git-github
tool_name: github_create_pr
arguments: {
  "path": "/path/to/your/repo",
  "title": "新機能の追加",
  "body": "このPRでは新機能を追加しています。",
  "head": "feature/new-feature",
  "base": "main",
  "use_template": true
}
```

## 開発

### 前提条件

- Node.js 16.0.0 以上
- npm または yarn

### セットアップ

```bash
git clone https://github.com/karaage0703/mcp-servers.git
cd mcp-servers/src/git-github
npm install
```

### ビルド

```bash
npm run build
```

### ローカルでの実行

```bash
GITHUB_TOKEN=your-token-here npm start
```

## ライセンス

MIT

## 貢献

バグ報告や機能リクエストは GitHub Issues で受け付けています。プルリクエストも歓迎します！