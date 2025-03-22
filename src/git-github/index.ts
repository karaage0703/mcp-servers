#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GitService } from "./git-service.js";
import { GitHubService } from "./github-service.js";
import { simpleGit } from "simple-git";
import * as path from "path";

/**
 * Git と GitHub 操作のための MCP サーバー
 */
class GitGitHubServer {
  private server: Server;
  private gitService: GitService;
  private githubService: GitHubService | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "git-github-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.gitService = new GitService();

    // GitHub トークンは環境変数から取得
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      this.githubService = new GitHubService(githubToken);
    } else {
      console.error(
        "Warning: GITHUB_TOKEN not provided. GitHub operations will not be available.",
      );
    }

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * ツールハンドラーを設定します
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        // Git 操作ツール
        {
          name: "git_status",
          description: "リポジトリの状態を確認します",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
            },
            required: ["path"],
          },
        },
        {
          name: "git_remote",
          description: "リモートリポジトリの情報を取得します (git remote -v)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
            },
            required: ["path"],
          },
        },
        {
          name: "git_set_upstream",
          description:
            "ブランチの追跡設定を行います (git branch --set-upstream-to)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              local_branch: {
                type: "string",
                description: "ローカルブランチ名",
              },
              remote_branch: {
                type: "string",
                description: "リモートブランチ名（例: origin/main）",
              },
            },
            required: ["path", "local_branch", "remote_branch"],
          },
        },
        {
          name: "git_add",
          description: "ファイルをステージングに追加します (git add)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              files: {
                oneOf: [
                  { type: "string" },
                  { type: "array", items: { type: "string" } },
                ],
                description: "追加するファイルパス（単一のパスまたは配列）",
              },
            },
            required: ["path", "files"],
          },
        },
        {
          name: "git_commit",
          description: "変更をコミットします (git commit)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              message: {
                type: "string",
                description: "コミットメッセージ",
              },
            },
            required: ["path", "message"],
          },
        },
        {
          name: "git_push",
          description: "変更をリモートにプッシュします (git push)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              branch: {
                type: "string",
                description: "ブランチ名",
              },
              remote: {
                type: "string",
                description: "リモート名",
                default: "origin",
              },
            },
            required: ["path", "branch"],
          },
        },
        {
          name: "git_move",
          description: "ファイルを移動します (git mv)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              source: {
                type: "string",
                description: "移動元ファイルパス",
              },
              destination: {
                type: "string",
                description: "移動先ファイルパス",
              },
            },
            required: ["path", "source", "destination"],
          },
        },
        {
          name: "git_remove",
          description: "ファイルを削除します (git rm)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              file: {
                type: "string",
                description: "削除するファイルパス",
              },
            },
            required: ["path", "file"],
          },
        },
        {
          name: "git_branch_create",
          description: "新しいブランチを作成します (git checkout -b)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              branch: {
                type: "string",
                description: "ブランチ名",
              },
            },
            required: ["path", "branch"],
          },
        },
        {
          name: "git_checkout",
          description: "ブランチを切り替えます (git checkout)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              branch: {
                type: "string",
                description: "ブランチ名",
              },
            },
            required: ["path", "branch"],
          },
        },
        {
          name: "git_fetch",
          description: "リモートリポジトリから最新の情報を取得します (git fetch)",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "リポジトリのパス",
              },
              remote: {
                type: "string",
                description: "リモート名（指定しない場合はすべてのリモート）",
              },
              branch: {
                type: "string",
                description: "ブランチ名（指定しない場合はすべてのブランチ）",
              },
            },
            required: ["path"],
          },
        },
      ];

      // GitHub トークンが設定されている場合のみ GitHub 操作ツールを追加
      if (this.githubService) {
        tools.push(
          {
            name: "github_create_pr",
            description: "Pull Requestを作成します",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "リポジトリのパス",
                },
                title: {
                  type: "string",
                  description: "PRのタイトル",
                },
                body: {
                  type: "string",
                  description: "PRの説明",
                },
                head: {
                  type: "string",
                  description: "ヘッドブランチ",
                },
                base: {
                  type: "string",
                  description: "ベースブランチ",
                  default: "main",
                },
                use_template: {
                  type: "boolean",
                  description: "PRテンプレートを使用するかどうか",
                  default: true,
                },
                auto_fill: {
                  type: "boolean",
                  description: "PRテンプレートを自動入力するかどうか",
                  default: true,
                },
                reason: {
                  type: "string",
                  description: "変更理由（自動入力用）",
                },
                test_info: {
                  type: "string",
                  description: "動作確認情報（自動入力用）",
                },
              },
              required: ["path", "title", "head"],
            },
          } as any,
          {
            name: "github_list_prs",
            description: "Pull Requestの一覧を取得します",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "リポジトリのパス",
                },
                state: {
                  type: "string",
                  enum: ["open", "closed", "all"],
                  description: "PRの状態",
                  default: "open",
                },
              },
              required: ["path"],
            },
          } as any,
          {
            name: "github_get_pr",
            description: "Pull Requestの詳細を取得します",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "リポジトリのパス",
                },
                pr_number: {
                  type: "number",
                  description: "PR番号",
                },
              },
              required: ["path", "pr_number"],
            },
          } as any,
          {
            name: "github_get_pr_diff",
            description: "Pull Requestの差分を取得します",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "リポジトリのパス",
                },
                pr_number: {
                  type: "number",
                  description: "PR番号",
                },
              },
              required: ["path", "pr_number"],
            },
          } as any,
          {
            name: "github_add_review_comment",
            description: "Pull Requestにレビューコメントを追加します",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "リポジトリのパス",
                },
                pr_number: {
                  type: "number",
                  description: "PR番号",
                },
                body: {
                  type: "string",
                  description: "コメント内容",
                },
                file_path: {
                  type: "string",
                  description: "コメントするファイルパス",
                },
                position: {
                  type: "number",
                  description: "コメント位置（行番号）",
                },
              },
              required: ["path", "pr_number", "body", "file_path", "position"],
            },
          } as any,
          {
            name: "github_submit_review",
            description: "Pull Requestにレビューを提出します",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "リポジトリのパス",
                },
                pr_number: {
                  type: "number",
                  description: "PR番号",
                },
                event: {
                  type: "string",
                  enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
                  description: "レビューイベント",
                },
                body: {
                  type: "string",
                  description: "レビューコメント",
                },
              },
              required: ["path", "pr_number", "event", "body"],
            },
          } as any,
        );
      }

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          // Git 操作ツール
          case "git_status":
            return this.handleGitStatus(request.params.arguments);
          case "git_add":
            return this.handleGitAdd(request.params.arguments);
          case "git_commit":
            return this.handleGitCommit(request.params.arguments);
          case "git_push":
            return this.handleGitPush(request.params.arguments);
          case "git_move":
            return this.handleGitMove(request.params.arguments);
          case "git_remove":
            return this.handleGitRemove(request.params.arguments);
          case "git_branch_create":
            return this.handleGitBranchCreate(request.params.arguments);
          case "git_checkout":
            return this.handleGitCheckout(request.params.arguments);
          case "git_remote":
            return this.handleGitRemote(request.params.arguments);
          case "git_set_upstream":
            return this.handleGitSetUpstream(request.params.arguments);
          case "git_fetch":
            return this.handleGitFetch(request.params.arguments);

          // GitHub 操作ツール
          case "github_create_pr":
            return this.handleGitHubCreatePR(request.params.arguments);
          case "github_list_prs":
            return this.handleGitHubListPRs(request.params.arguments);
          case "github_get_pr":
            return this.handleGitHubGetPR(request.params.arguments);
          case "github_get_pr_diff":
            return this.handleGitHubGetPRDiff(request.params.arguments);
          case "github_add_review_comment":
            return this.handleGitHubAddReviewComment(request.params.arguments);
          case "github_submit_review":
            return this.handleGitHubSubmitReview(request.params.arguments);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`,
            );
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: error.message,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Git ステータスを取得するハンドラー
   */
  /**
   * パスの検証を行う共通メソッド
   * @param args 引数オブジェクト
   * @param paramName パラメータ名（デフォルト: 'path'）
   * @throws エラー（パスが無効な場合）
   */
  private validatePath(args: any, paramName: string = "path"): void {
    // 引数の検証
    if (!args || typeof args[paramName] !== "string") {
      throw new Error(
        `パスは文字列で指定してください。例: {"${paramName}": "/path/to/repo"} のように引用符で囲んでください。`,
      );
    }

    // 相対パスのチェック - 先頭が / で始まるかどうかで判断
    const pathStr = args[paramName];
    if (pathStr.charAt(0) !== "/") {
      throw new Error(
        `MCPサーバーでは絶対パスを使用する必要があります。\n` +
          `相対パス "${pathStr}" ではなく、絶対パス（例: "/Users/username/path/to/repo"）を指定してください。`,
      );
    }
  }

  /**
   * Gitエラーを処理する共通メソッド
   * @param error エラーオブジェクト
   * @param path パス
   * @throws 整形されたエラー
   */
  private handleGitError(error: any, path: string): never {
    // Gitリポジトリではないエラーの場合、より親切なメッセージを表示
    if (error.message.includes("not a git repository")) {
      throw new Error(
        `指定されたパス "${path}" はGitリポジトリではありません。\n` +
          `有効なGitリポジトリの絶対パスを指定してください。`,
      );
    }
    throw error;
  }

  private async handleGitStatus(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      try {
        const status = await this.gitService.getStatus(args.path);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git status error: ${error.message}`);
    }
  }

  /**
   * Git add を実行するハンドラー
   */
  private async handleGitAdd(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // filesパラメータの検証
      if (!args.files) {
        throw new Error("追加するファイルを指定してください。");
      }

      try {
        const result = await this.gitService.addFiles(args.path, args.files);
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git add error: ${error.message}`);
    }
  }

  /**
   * Git commit を実行するハンドラー
   */
  private async handleGitCommit(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // messageパラメータの検証
      if (!args.message || typeof args.message !== "string") {
        throw new Error("コミットメッセージを文字列で指定してください。");
      }

      try {
        const result = await this.gitService.commit(args.path, args.message);
        return {
          content: [
            {
              type: "text",
              text: `${result.message} (${result.commitHash})`,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git commit error: ${error.message}`);
    }
  }

  /**
   * Git push を実行するハンドラー
   */
  private async handleGitPush(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // branchパラメータの検証
      if (!args.branch || typeof args.branch !== "string") {
        throw new Error("ブランチ名を文字列で指定してください。");
      }

      try {
        const result = await this.gitService.push(
          args.path,
          args.branch,
          args.remote,
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git push error: ${error.message}`);
    }
  }

  /**
   * Git mv を実行するハンドラー
   */
  private async handleGitMove(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // sourceとdestinationパラメータの検証
      if (!args.source || typeof args.source !== "string") {
        throw new Error("移動元ファイルパスを文字列で指定してください。");
      }
      if (!args.destination || typeof args.destination !== "string") {
        throw new Error("移動先ファイルパスを文字列で指定してください。");
      }

      try {
        const result = await this.gitService.moveFile(
          args.path,
          args.source,
          args.destination,
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git move error: ${error.message}`);
    }
  }

  /**
   * Git rm を実行するハンドラー
   */
  private async handleGitRemove(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // fileパラメータの検証
      if (!args.file || typeof args.file !== "string") {
        throw new Error("削除するファイルパスを文字列で指定してください。");
      }

      try {
        const result = await this.gitService.removeFile(args.path, args.file);
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git remove error: ${error.message}`);
    }
  }

  /**
   * Git ブランチ作成を実行するハンドラー
   */
  private async handleGitBranchCreate(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // branchパラメータの検証
      if (!args.branch || typeof args.branch !== "string") {
        throw new Error("ブランチ名を文字列で指定してください。");
      }

      try {
        const result = await this.gitService.createBranch(
          args.path,
          args.branch,
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git branch creation error: ${error.message}`);
    }
  }

  /**
   * Git checkout を実行するハンドラー
   */
  private async handleGitCheckout(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // branchパラメータの検証
      if (!args.branch || typeof args.branch !== "string") {
        throw new Error("ブランチ名を文字列で指定してください。");
      }

      try {
        const result = await this.gitService.checkout(args.path, args.branch);
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Git checkout error: ${error.message}`);
    }
  }

  /**
   * GitHub PR 作成を実行するハンドラー
   */
  private async handleGitHubCreatePR(args: any) {
    if (!this.githubService) {
      throw new Error(
        "GitHub operations are not available. GITHUB_TOKEN not provided.",
      );
    }

    try {
      // パスの検証
      this.validatePath(args);

      // リポジトリ情報を取得
      const repoInfo = await this.gitService.getRepoInfo(args.path);
      const { owner, repo } = repoInfo.github;

      if (!owner || !repo) {
        throw new Error("Could not determine GitHub repository information");
      }

      // PR テンプレートを取得
      let body = args.body || "";
      let template = "";

      if (args.use_template !== false) {
        template = this.gitService.getPrTemplate(args.path);

        // テンプレートが存在し、自動入力が有効な場合
        if (template && args.auto_fill !== false) {
          // 変更情報を取得（git diffなどから）
          const changes = await this.getChangesInfo(
            args.path,
            args.base || "main",
            args.head,
          );

          // PRテンプレートを自動入力
          body = await this.githubService.fillPrTemplate(template, {
            title: args.title,
            description: body,
            changes: changes,
            reason: args.reason || `${args.title}の実装`,
            testInfo: args.test_info,
          });
        } else if (template && body) {
          body = `${body}\n\n${template}`;
        } else if (template) {
          body = template;
        }
      }

      // PR を作成
      const result = await this.githubService.createPullRequest(
        owner,
        repo,
        args.title,
        body,
        args.head,
        args.base || "main",
      );

      return {
        content: [
          {
            type: "text",
            text: `Pull Request created successfully: ${result.url} (PR #${result.number})`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`GitHub PR creation error: ${error.message}`);
    }
  }

  /**
   * 変更情報を取得します
   * @param repoPath リポジトリのパス
   * @param base ベースブランチ
   * @param head ヘッドブランチ
   * @returns 変更情報
   */
  private async getChangesInfo(repoPath: string, base: string, head: string) {
    try {
      const git = simpleGit(repoPath);

      // 追加されたファイル
      const addedFilesResult = await git.diff([
        `${base}...${head}`,
        "--name-only",
        "--diff-filter=A",
      ]);
      const addedFiles = addedFilesResult
        .split("\n")
        .filter((file) => file.trim() !== "");

      // 変更されたファイル
      const modifiedFilesResult = await git.diff([
        `${base}...${head}`,
        "--name-only",
        "--diff-filter=M",
      ]);
      const modifiedFiles = modifiedFilesResult
        .split("\n")
        .filter((file) => file.trim() !== "");

      // 削除されたファイル
      const removedFilesResult = await git.diff([
        `${base}...${head}`,
        "--name-only",
        "--diff-filter=D",
      ]);
      const removedFiles = removedFilesResult
        .split("\n")
        .filter((file) => file.trim() !== "");

      return {
        added: addedFiles,
        modified: modifiedFiles,
        removed: removedFiles,
      };
    } catch (error: any) {
      console.error("Failed to get changes info:", error.message);
      return {};
    }
  }

  /**
   * GitHub PR 一覧を取得するハンドラー
   */
  private async handleGitHubListPRs(args: any) {
    if (!this.githubService) {
      throw new Error(
        "GitHub operations are not available. GITHUB_TOKEN not provided.",
      );
    }

    try {
      // パスの検証
      this.validatePath(args);

      // リポジトリ情報を取得
      const repoInfo = await this.gitService.getRepoInfo(args.path);
      const { owner, repo } = repoInfo.github;

      if (!owner || !repo) {
        throw new Error("Could not determine GitHub repository information");
      }

      // PR 一覧を取得
      const prs = await this.githubService.listPullRequests(
        owner,
        repo,
        args.state as "open" | "closed" | "all",
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(prs, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`GitHub list PRs error: ${error.message}`);
    }
  }

  /**
   * GitHub PR 詳細を取得するハンドラー
   */
  private async handleGitHubGetPR(args: any) {
    if (!this.githubService) {
      throw new Error(
        "GitHub operations are not available. GITHUB_TOKEN not provided.",
      );
    }

    try {
      // パスの検証
      this.validatePath(args);

      // リポジトリ情報を取得
      const repoInfo = await this.gitService.getRepoInfo(args.path);
      const { owner, repo } = repoInfo.github;

      if (!owner || !repo) {
        throw new Error("Could not determine GitHub repository information");
      }

      // PR 詳細を取得
      const pr = await this.githubService.getPullRequest(
        owner,
        repo,
        args.pr_number,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pr, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`GitHub get PR error: ${error.message}`);
    }
  }

  /**
   * GitHub PR 差分を取得するハンドラー
   */
  private async handleGitHubGetPRDiff(args: any) {
    if (!this.githubService) {
      throw new Error(
        "GitHub operations are not available. GITHUB_TOKEN not provided.",
      );
    }

    try {
      // パスの検証
      this.validatePath(args);

      // リポジトリ情報を取得
      const repoInfo = await this.gitService.getRepoInfo(args.path);
      const { owner, repo } = repoInfo.github;

      if (!owner || !repo) {
        throw new Error("Could not determine GitHub repository information");
      }

      // PR 差分を取得
      const diff = await this.githubService.getPullRequestDiff(
        owner,
        repo,
        args.pr_number,
      );

      return {
        content: [
          {
            type: "text",
            text: diff,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`GitHub get PR diff error: ${error.message}`);
    }
  }

  /**
   * GitHub PR レビューコメントを追加するハンドラー
   */
  private async handleGitHubAddReviewComment(args: any) {
    if (!this.githubService) {
      throw new Error(
        "GitHub operations are not available. GITHUB_TOKEN not provided.",
      );
    }

    try {
      // パスの検証
      this.validatePath(args);

      // リポジトリ情報を取得
      const repoInfo = await this.gitService.getRepoInfo(args.path);
      const { owner, repo } = repoInfo.github;

      if (!owner || !repo) {
        throw new Error("Could not determine GitHub repository information");
      }

      // PR 詳細を取得してコミット ID を取得
      const pr = await this.githubService.getPullRequest(
        owner,
        repo,
        args.pr_number,
      );
      const commit_id = pr.head.sha;

      // レビューコメントを追加
      const result = await this.githubService.createReviewComment(
        owner,
        repo,
        args.pr_number,
        args.body,
        args.file_path,
        args.position,
        commit_id,
      );

      return {
        content: [
          {
            type: "text",
            text: `Review comment added successfully: ${result.url}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`GitHub add review comment error: ${error.message}`);
    }
  }

  /**
   * GitHub PR レビューを提出するハンドラー
   */
  private async handleGitHubSubmitReview(args: any) {
    if (!this.githubService) {
      throw new Error(
        "GitHub operations are not available. GITHUB_TOKEN not provided.",
      );
    }

    try {
      // パスの検証
      this.validatePath(args);

      // リポジトリ情報を取得
      const repoInfo = await this.gitService.getRepoInfo(args.path);
      const { owner, repo } = repoInfo.github;

      if (!owner || !repo) {
        throw new Error("Could not determine GitHub repository information");
      }

      // レビューを提出
      const result = await this.githubService.createReview(
        owner,
        repo,
        args.pr_number,
        args.event as "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
        args.body,
      );

      return {
        content: [
          {
            type: "text",
            text: `Review submitted successfully with state: ${result.state}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`GitHub submit review error: ${error.message}`);
    }
  }

  /**
   * リモートリポジトリの情報を取得するハンドラー (git remote -v)
   */
  private async handleGitRemote(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      try {
        const remotes = await this.gitService.getRemotes(args.path);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(remotes, null, 2),
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Failed to get remotes: ${error.message}`);
    }
  }

  /**
   * ブランチの追跡設定を行うハンドラー (git branch --set-upstream-to)
   */
  private async handleGitSetUpstream(args: any) {
    try {
      // パスの検証
      this.validatePath(args);

      // local_branchとremote_branchパラメータの検証
      if (!args.local_branch || typeof args.local_branch !== "string") {
        throw new Error("ローカルブランチ名を文字列で指定してください。");
      }
      if (!args.remote_branch || typeof args.remote_branch !== "string") {
        throw new Error("リモートブランチ名を文字列で指定してください。");
      }

      try {
        const result = await this.gitService.setUpstreamBranch(
          args.path,
          args.local_branch,
          args.remote_branch,
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } catch (gitError: any) {
        this.handleGitError(gitError, args.path);
      }
    } catch (error: any) {
      throw new Error(`Failed to set upstream branch: ${error.message}`);
    }
  }
/**
 * リモートリポジトリから最新の情報を取得するハンドラー (git fetch)
 */
private async handleGitFetch(args: any) {
  try {
    // パスの検証
    this.validatePath(args);

    try {
      const result = await this.gitService.fetch(
        args.path,
        args.remote,
        args.branch
      );
      return {
        content: [
          {
            type: "text",
            text: result.message,
          },
        ],
      };
    } catch (gitError: any) {
      this.handleGitError(gitError, args.path);
    }
  } catch (error: any) {
    throw new Error(`Git fetch error: ${error.message}`);
  }
}

/**
 * MCP サーバーを実行します
   * MCP サーバーを実行します
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Git/GitHub MCP server running on stdio");
  }
}

// サーバーを起動
const server = new GitGitHubServer();
server.run().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
