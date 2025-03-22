import { simpleGit, SimpleGit } from "simple-git";
import fs from "fs";
import path from "path";

/**
 * Git 操作を行うサービスクラス
 */
export class GitService {
  /**
   * パスを絶対パスに変換します
   * @param repoPath リポジトリのパス
   * @returns 絶対パス
   */
  private resolveRepoPath(repoPath: string): string {
    // 相対パスの場合は絶対パスに変換
    if (!path.isAbsolute(repoPath)) {
      return path.resolve(process.cwd(), repoPath);
    }
    return repoPath;
  }
  /**
   * 指定されたパスの Git リポジトリのステータスを取得します
   * @param repoPath リポジトリのパス
   * @returns Git ステータス情報
   */
  async getStatus(repoPath: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      return await git.status();
    } catch (error: any) {
      throw new Error(`Git status error: ${error.message}`);
    }
  }

  /**
   * ファイルを Git 管理下で移動します (git mv)
   * @param repoPath リポジトリのパス
   * @param source 移動元ファイルパス
   * @param destination 移動先ファイルパス
   * @returns 操作結果
   */
  async moveFile(repoPath: string, source: string, destination: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      await git.mv(source, destination);
      return {
        success: true,
        message: `Successfully moved ${source} to ${destination}`,
      };
    } catch (error: any) {
      throw new Error(`Git move error: ${error.message}`);
    }
  }

  /**
   * ファイルを Git 管理下で削除します (git rm)
   * @param repoPath リポジトリのパス
   * @param filePath 削除するファイルパス
   * @returns 操作結果
   */
  async removeFile(repoPath: string, filePath: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      await git.rm(filePath);
      return { success: true, message: `Successfully removed ${filePath}` };
    } catch (error: any) {
      throw new Error(`Git remove error: ${error.message}`);
    }
  }

  /**
   * 変更をステージングに追加します (git add)
   * @param repoPath リポジトリのパス
   * @param files 追加するファイルパス（配列または単一のパス）
   * @returns 操作結果
   */
  async addFiles(repoPath: string, files: string | string[]) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      await git.add(files);
      return { success: true, message: `Successfully added files to staging` };
    } catch (error: any) {
      throw new Error(`Git add error: ${error.message}`);
    }
  }

  /**
   * 変更をコミットします (git commit)
   * @param repoPath リポジトリのパス
   * @param message コミットメッセージ
   * @returns 操作結果
   */
  async commit(repoPath: string, message: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      const result = await git.commit(message);
      return {
        success: true,
        message: `Successfully committed changes`,
        commitHash: result.commit,
      };
    } catch (error: any) {
      throw new Error(`Git commit error: ${error.message}`);
    }
  }

  /**
   * 変更をリモートにプッシュします (git push)
   * @param repoPath リポジトリのパス
   * @param remote リモート名（デフォルト: origin）
   * @param branch ブランチ名
   * @returns 操作結果
   */
  async push(repoPath: string, branch: string, remote: string = "origin") {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);

      // GitHubトークンを取得
      const githubToken = process.env.GITHUB_TOKEN;

      if (githubToken) {
        // リモートURLを取得
        const remotes = await git.getRemotes(true);
        let remoteUrl = "";

        for (const r of remotes) {
          if (r.name === remote) {
            remoteUrl = r.refs.push;
            break;
          }
        }

        if (remoteUrl && remoteUrl.startsWith("https://github.com")) {
          console.log(
            `Using GitHub token for authentication when pushing to ${remote}/${branch}`,
          );

          // 一時的にリモートURLを変更（トークンを含む）
          const tokenUrl = remoteUrl.replace(
            "https://github.com",
            `https://${githubToken}@github.com`,
          );

          // 一時的なリモートを追加
          const tempRemote = `${remote}-temp`;
          await git.removeRemote(tempRemote).catch(() => {}); // 既存の一時リモートを削除（存在する場合）
          await git.addRemote(tempRemote, tokenUrl);

          // 一時リモートにプッシュ
          await git.push(tempRemote, branch);

          // 一時リモートを削除
          await git.removeRemote(tempRemote);

          return {
            success: true,
            message: `Successfully pushed to ${remote}/${branch} using GitHub token`,
          };
        }
      }

      // トークンがない場合や、リモートURLがGitHubでない場合は通常のプッシュを試みる
      await git.push(remote, branch);
      return {
        success: true,
        message: `Successfully pushed to ${remote}/${branch}`,
      };
    } catch (error: any) {
      throw new Error(`Git push error: ${error.message}`);
    }
  }

  /**
   * ブランチを作成します (git checkout -b)
   * @param repoPath リポジトリのパス
   * @param branchName ブランチ名
   * @returns 操作結果
   */
  async createBranch(repoPath: string, branchName: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      await git.checkoutLocalBranch(branchName);
      return {
        success: true,
        message: `Successfully created and checked out branch ${branchName}`,
      };
    } catch (error: any) {
      throw new Error(`Git branch creation error: ${error.message}`);
    }
  }

  /**
   * ブランチを切り替えます (git checkout)
   * @param repoPath リポジトリのパス
   * @param branchName ブランチ名
   * @returns 操作結果
   */
  async checkout(repoPath: string, branchName: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      await git.checkout(branchName);
      return {
        success: true,
        message: `Successfully checked out branch ${branchName}`,
      };
    } catch (error: any) {
      throw new Error(`Git checkout error: ${error.message}`);
    }
  }

  /**
   * リポジトリの情報を取得します
   * @param repoPath リポジトリのパス
   * @returns リポジトリ情報
   */
  async getRepoInfo(repoPath: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      const remotes = await git.getRemotes(true);
      const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

      // GitHub リポジトリ情報を抽出
      let owner = "";
      let repo = "";

      for (const remote of remotes) {
        if (remote.name === "origin") {
          const url = remote.refs.fetch;
          const match = url.match(/github\.com[:/]([^/]+)\/([^.]+)(?:\.git)?$/);
          if (match) {
            [, owner, repo] = match;
            break;
          }
        }
      }

      return {
        currentBranch,
        remotes,
        github: { owner, repo },
      };
    } catch (error: any) {
      throw new Error(`Failed to get repo info: ${error.message}`);
    }
  }

  /**
   * PR テンプレートを読み取ります
   * @param repoPath リポジトリのパス
   * @returns PR テンプレートの内容
   */
  getPrTemplate(repoPath: string): string {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      // GitHubがチェックする可能性のあるすべての場所をチェック
      const possibleTemplatePaths = [
        // ルートディレクトリ
        path.join(resolvedPath, "pull_request_template.md"),
        path.join(resolvedPath, "PULL_REQUEST_TEMPLATE.md"),
        // .githubディレクトリ
        path.join(resolvedPath, ".github", "pull_request_template.md"),
        path.join(resolvedPath, ".github", "PULL_REQUEST_TEMPLATE.md"),
        // docsディレクトリ
        path.join(resolvedPath, "docs", "pull_request_template.md"),
        path.join(resolvedPath, "docs", "PULL_REQUEST_TEMPLATE.md"),
      ];

      // .github/PULL_REQUEST_TEMPLATEディレクトリ内のマークダウンファイル
      const templateDir = path.join(
        resolvedPath,
        ".github",
        "PULL_REQUEST_TEMPLATE",
      );
      if (
        fs.existsSync(templateDir) &&
        fs.statSync(templateDir).isDirectory()
      ) {
        try {
          const files = fs.readdirSync(templateDir);
          for (const file of files) {
            if (file.endsWith(".md")) {
              possibleTemplatePaths.push(path.join(templateDir, file));
            }
          }
        } catch (err) {
          console.error(`Failed to read template directory: ${err}`);
        }
      }

      // 最初に見つかったテンプレートを使用
      for (const templatePath of possibleTemplatePaths) {
        if (fs.existsSync(templatePath)) {
          return fs.readFileSync(templatePath, "utf8");
        }
      }

      return "";
    } catch (error: any) {
      console.error(`Failed to read PR template: ${error.message}`);
      return "";
    }
  }

  /**
   * リモートリポジトリの情報を取得します (git remote -v)
   * @param repoPath リポジトリのパス
   * @returns リモートリポジトリ情報
   */
  async getRemotes(repoPath: string) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);
      const remotes = await git.getRemotes(true);

      // 結果を整形
      const formattedRemotes = remotes.map((remote) => ({
        name: remote.name,
        fetch: remote.refs.fetch,
        push: remote.refs.push,
      }));

      return formattedRemotes;
    } catch (error: any) {
      throw new Error(`Failed to get remotes: ${error.message}`);
    }
  }

  /**
   * ブランチの追跡設定を行います (git branch --set-upstream-to)
   * @param repoPath リポジトリのパス
   * @param localBranch ローカルブランチ名
   * @param remoteBranch リモートブランチ名（例: origin/main）
   * @returns 操作結果
   */
  async setUpstreamBranch(
    repoPath: string,
    localBranch: string,
    remoteBranch: string,
  ) {
    try {
      const resolvedPath = this.resolveRepoPath(repoPath);
      const git = simpleGit(resolvedPath);

      // 現在のブランチを保存
      const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

      // 指定されたブランチに切り替え
      if (currentBranch !== localBranch) {
        await git.checkout(localBranch);
      }

      // ブランチの追跡設定
      await git.raw(["branch", "--set-upstream-to", remoteBranch, localBranch]);

      // 元のブランチに戻す
      if (currentBranch !== localBranch) {
        await git.checkout(currentBranch);
      }

      return {
        success: true,
        message: `Branch '${localBranch}' set up to track '${remoteBranch}'.`,
      };
    } catch (error: any) {
      throw new Error(`Failed to set upstream branch: ${error.message}`);
    }
  }
}
