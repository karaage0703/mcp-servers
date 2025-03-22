import { Octokit } from "@octokit/rest";

/**
 * GitHub 操作を行うサービスクラス
 */
export class GitHubService {
  private octokit: Octokit;

  /**
   * GitHubService のコンストラクタ
   * @param token GitHub アクセストークン
   */
  constructor(token: string) {
    if (!token) {
      throw new Error("GitHub token is required");
    }
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * Pull Request を作成します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param title PRのタイトル
   * @param body PRの説明
   * @param head ヘッドブランチ
   * @param base ベースブランチ（デフォルト: main）
   * @returns 作成されたPRの情報
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string = "main",
  ) {
    try {
      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        body,
        head,
        base,
      });

      return {
        success: true,
        url: response.data.html_url,
        number: response.data.number,
        id: response.data.id,
      };
    } catch (error: any) {
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Pull Request の一覧を取得します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param state PRの状態（open, closed, all）
   * @returns PRの一覧
   */
  async listPullRequests(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
  ) {
    try {
      const response = await this.octokit.pulls.list({
        owner,
        repo,
        state,
      });

      return response.data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        user: pr.user?.login,
      }));
    } catch (error: any) {
      throw new Error(`Failed to list PRs: ${error.message}`);
    }
  }

  /**
   * Pull Request の詳細を取得します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param pull_number PR番号
   * @returns PRの詳細情報
   */
  async getPullRequest(owner: string, repo: string, pull_number: number) {
    try {
      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number,
      });

      return {
        number: response.data.number,
        title: response.data.title,
        body: response.data.body,
        state: response.data.state,
        url: response.data.html_url,
        head: {
          ref: response.data.head.ref,
          sha: response.data.head.sha,
        },
        base: {
          ref: response.data.base.ref,
          sha: response.data.base.sha,
        },
        user: response.data.user?.login,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
        merged: response.data.merged,
        mergeable: response.data.mergeable,
      };
    } catch (error: any) {
      throw new Error(`Failed to get PR: ${error.message}`);
    }
  }

  /**
   * Pull Request の差分を取得します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param pull_number PR番号
   * @returns PRの差分
   */
  async getPullRequestDiff(owner: string, repo: string, pull_number: number) {
    try {
      // diff 形式で PR の差分を取得
      const response = await this.octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner,
          repo,
          pull_number,
          headers: {
            accept: "application/vnd.github.v3.diff",
          },
        },
      );

      // response.data は string 型
      return String(response.data);
    } catch (error: any) {
      throw new Error(`Failed to get PR diff: ${error.message}`);
    }
  }

  /**
   * Pull Request にレビューコメントを追加します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param pull_number PR番号
   * @param body コメント内容
   * @param path ファイルパス
   * @param position 行番号
   * @param commit_id コミットID
   * @returns 作成されたコメントの情報
   */
  async createReviewComment(
    owner: string,
    repo: string,
    pull_number: number,
    body: string,
    path: string,
    position: number,
    commit_id: string,
  ) {
    try {
      const response = await this.octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number,
        body,
        path,
        position,
        commit_id,
      });

      return {
        success: true,
        id: response.data.id,
        url: response.data.html_url,
      };
    } catch (error: any) {
      throw new Error(`Failed to create review comment: ${error.message}`);
    }
  }

  /**
   * Pull Request のレビューコメント一覧を取得します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param pull_number PR番号
   * @returns レビューコメントの一覧
   */
  async listReviewComments(owner: string, repo: string, pull_number: number) {
    try {
      const response = await this.octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number,
      });

      return response.data.map((comment) => ({
        id: comment.id,
        body: comment.body,
        path: comment.path,
        position: comment.position,
        commit_id: comment.commit_id,
        user: comment.user?.login,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        url: comment.html_url,
      }));
    } catch (error: any) {
      throw new Error(`Failed to list review comments: ${error.message}`);
    }
  }

  /**
   * Pull Request にレビューを提出します
   * @param owner リポジトリのオーナー
   * @param repo リポジトリ名
   * @param pull_number PR番号
   * @param event レビューイベント（APPROVE, REQUEST_CHANGES, COMMENT）
   * @param body レビューコメント
   * @returns 提出されたレビューの情報
   */
  async createReview(
    owner: string,
    repo: string,
    pull_number: number,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    body: string,
  ) {
    try {
      const response = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        event,
        body,
      });

      return {
        success: true,
        id: response.data.id,
        state: response.data.state,
      };
    } catch (error: any) {
      throw new Error(`Failed to create review: ${error.message}`);
    }
  }

  /**
   * PRテンプレートを解析して自動入力します
   * @param template PRテンプレートの内容
   * @param prInfo PR作成に関する情報
   * @returns 入力済みのPRテンプレート
   */
  async fillPrTemplate(
    template: string,
    prInfo: {
      title: string;
      description: string;
      changes: {
        added?: string[];
        modified?: string[];
        removed?: string[];
      };
      reason?: string;
      testInfo?: string;
    },
  ): Promise<string> {
    // テンプレートのセクションを識別
    const sections = this.identifyTemplateSections(template);

    // 各セクションに適切な内容を埋め込む
    let filledTemplate = template;

    // 説明を先頭に追加
    if (prInfo.description) {
      filledTemplate = `${prInfo.description}\n\n${filledTemplate}`;
    }

    // 変更内容セクション
    if (sections.changes) {
      filledTemplate = this.fillChangesSection(
        filledTemplate,
        sections.changes,
        prInfo.changes,
      );
    }

    // 変更理由セクション
    if (sections.reason && prInfo.reason) {
      filledTemplate = this.fillSection(
        filledTemplate,
        sections.reason,
        prInfo.reason,
      );
    }

    // 影響範囲セクション
    if (sections.impact) {
      filledTemplate = this.fillImpactSection(
        filledTemplate,
        sections.impact,
        prInfo.changes,
      );
    }

    // 動作確認セクション
    if (sections.testing && prInfo.testInfo) {
      filledTemplate = this.fillSection(
        filledTemplate,
        sections.testing,
        prInfo.testInfo,
      );
    }

    // チェックリストセクション
    if (sections.checklist) {
      filledTemplate = this.fillChecklistSection(
        filledTemplate,
        sections.checklist,
      );
    }

    return filledTemplate;
  }

  /**
   * テンプレートのセクションを識別します
   * @param template PRテンプレートの内容
   * @returns 識別されたセクション
   */
  private identifyTemplateSections(template: string): {
    changes?: { start: number; end: number; content: string };
    reason?: { start: number; end: number; content: string };
    impact?: { start: number; end: number; content: string };
    testing?: { start: number; end: number; content: string };
    checklist?: { start: number; end: number; content: string };
  } {
    const sections: any = {};

    // テンプレートを行に分割
    const lines = template.split("\n");

    // セクション見出しの正規表現
    const changesSectionRegex = /##\s*(変更内容|Changes)/i;
    const reasonSectionRegex = /##\s*(変更理由|Reason|Why)/i;
    const impactSectionRegex = /##\s*(影響範囲|Impact)/i;
    const testingSectionRegex = /##\s*(動作確認|Testing)/i;
    const checklistSectionRegex = /##\s*(チェックリスト|Checklist)/i;

    // 次のセクション見出しを検索する関数
    const findNextSectionIndex = (startIndex: number): number => {
      for (let i = startIndex + 1; i < lines.length; i++) {
        if (lines[i].match(/^##\s+/)) {
          return i;
        }
      }
      return lines.length;
    };

    // 各セクションの開始と終了位置を特定
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(changesSectionRegex)) {
        const nextSectionIndex = findNextSectionIndex(i);
        sections.changes = {
          start: i,
          end: nextSectionIndex,
          content: lines.slice(i, nextSectionIndex).join("\n"),
        };
      } else if (line.match(reasonSectionRegex)) {
        const nextSectionIndex = findNextSectionIndex(i);
        sections.reason = {
          start: i,
          end: nextSectionIndex,
          content: lines.slice(i, nextSectionIndex).join("\n"),
        };
      } else if (line.match(impactSectionRegex)) {
        const nextSectionIndex = findNextSectionIndex(i);
        sections.impact = {
          start: i,
          end: nextSectionIndex,
          content: lines.slice(i, nextSectionIndex).join("\n"),
        };
      } else if (line.match(testingSectionRegex)) {
        const nextSectionIndex = findNextSectionIndex(i);
        sections.testing = {
          start: i,
          end: nextSectionIndex,
          content: lines.slice(i, nextSectionIndex).join("\n"),
        };
      } else if (line.match(checklistSectionRegex)) {
        const nextSectionIndex = findNextSectionIndex(i);
        sections.checklist = {
          start: i,
          end: nextSectionIndex,
          content: lines.slice(i, nextSectionIndex).join("\n"),
        };
      }
    }

    return sections;
  }

  /**
   * 変更内容セクションを入力します
   * @param template テンプレート
   * @param section セクション情報
   * @param changes 変更情報
   * @returns 入力済みのテンプレート
   */
  private fillChangesSection(
    template: string,
    section: { start: number; end: number; content: string },
    changes: { added?: string[]; modified?: string[]; removed?: string[] },
  ): string {
    const lines = template.split("\n");
    const sectionLines = section.content.split("\n");

    // 追加した機能、変更・修正した機能、削除した機能のサブセクションを検索
    const addedSectionIndex = sectionLines.findIndex((line) =>
      line.match(/(追加した機能|Added|Additions)/i),
    );
    const modifiedSectionIndex = sectionLines.findIndex((line) =>
      line.match(/(変更・修正した機能|Modified|Changes)/i),
    );
    const removedSectionIndex = sectionLines.findIndex((line) =>
      line.match(/(削除した機能|Removed|Deletions)/i),
    );

    // 変更内容を生成
    let newSectionContent = sectionLines.slice(0, 1).join("\n"); // セクション見出しを保持

    // 追加した機能
    if (addedSectionIndex !== -1) {
      newSectionContent += "\n\n" + sectionLines[addedSectionIndex];
      if (changes.added && changes.added.length > 0) {
        newSectionContent += "\n";
        for (const file of changes.added) {
          newSectionContent += `- ${file}\n`;
        }
      } else {
        newSectionContent += "\n- なし\n";
      }
    }

    // 変更・修正した機能
    if (modifiedSectionIndex !== -1) {
      newSectionContent += "\n\n" + sectionLines[modifiedSectionIndex];
      if (changes.modified && changes.modified.length > 0) {
        newSectionContent += "\n";
        for (const file of changes.modified) {
          newSectionContent += `- ${file}\n`;
        }
      } else {
        newSectionContent += "\n- なし\n";
      }
    }

    // 削除した機能
    if (removedSectionIndex !== -1) {
      newSectionContent += "\n\n" + sectionLines[removedSectionIndex];
      if (changes.removed && changes.removed.length > 0) {
        newSectionContent += "\n";
        for (const file of changes.removed) {
          newSectionContent += `- ${file}\n`;
        }
      } else {
        newSectionContent += "\n- なし\n";
      }
    }

    // テンプレートを更新
    const newLines = [
      ...lines.slice(0, section.start),
      ...newSectionContent.split("\n"),
      ...lines.slice(section.end),
    ];

    return newLines.join("\n");
  }

  /**
   * セクションを入力します
   * @param template テンプレート
   * @param section セクション情報
   * @param content 入力内容
   * @returns 入力済みのテンプレート
   */
  private fillSection(
    template: string,
    section: { start: number; end: number; content: string },
    content: string,
  ): string {
    const lines = template.split("\n");
    const sectionLines = section.content.split("\n");

    // セクション見出しを保持し、内容を追加
    const newSectionContent = sectionLines[0] + "\n" + content;

    // テンプレートを更新
    const newLines = [
      ...lines.slice(0, section.start),
      ...newSectionContent.split("\n"),
      ...lines.slice(section.end),
    ];

    return newLines.join("\n");
  }

  /**
   * 影響範囲セクションを入力します
   * @param template テンプレート
   * @param section セクション情報
   * @param changes 変更情報
   * @returns 入力済みのテンプレート
   */
  private fillImpactSection(
    template: string,
    section: { start: number; end: number; content: string },
    changes: { added?: string[]; modified?: string[]; removed?: string[] },
  ): string {
    const lines = template.split("\n");
    const sectionLines = section.content.split("\n");

    // チェックボックスを検索
    const checkboxLines = sectionLines.filter((line) => line.match(/- \[ \]/));

    // 影響範囲を評価
    const hasExistingFeatureImpact =
      changes.modified && changes.modified.length > 0;
    const hasPerformanceImpact = false; // 性能への影響は自動判定が難しいため、デフォルトでfalse
    const hasSecurityImpact = false; // セキュリティへの影響も自動判定が難しいため、デフォルトでfalse

    // 新しいセクション内容を生成
    let newSectionContent = sectionLines[0] + "\n"; // セクション見出しを保持
    newSectionContent += "この変更による影響範囲は以下の通りです：\n";

    // チェックボックスを更新
    for (const line of checkboxLines) {
      if (line.match(/(既存の機能|existing feature)/i)) {
        newSectionContent += hasExistingFeatureImpact
          ? line.replace("- [ ]", "- [x]") + " - 既存機能を修正\n"
          : line.replace("- [ ]", "- [ ]") + " - 影響なし\n";
      } else if (line.match(/(パフォーマンス|performance)/i)) {
        newSectionContent += hasPerformanceImpact
          ? line.replace("- [ ]", "- [x]") + " - 性能に影響あり\n"
          : line.replace("- [ ]", "- [ ]") + " - 影響なし\n";
      } else if (line.match(/(セキュリティ|security)/i)) {
        newSectionContent += hasSecurityImpact
          ? line.replace("- [ ]", "- [x]") + " - セキュリティに影響あり\n"
          : line.replace("- [ ]", "- [ ]") + " - 影響なし\n";
      } else {
        newSectionContent += line + "\n";
      }
    }

    // テンプレートを更新
    const newLines = [
      ...lines.slice(0, section.start),
      ...newSectionContent.split("\n"),
      ...lines.slice(section.end),
    ];

    return newLines.join("\n");
  }

  /**
   * チェックリストセクションを入力します
   * @param template テンプレート
   * @param section セクション情報
   * @returns 入力済みのテンプレート
   */
  private fillChecklistSection(
    template: string,
    section: { start: number; end: number; content: string },
  ): string {
    const lines = template.split("\n");
    const sectionLines = section.content.split("\n");

    // チェックボックスを検索してチェックを入れる
    let newSectionContent = sectionLines[0] + "\n"; // セクション見出しを保持

    for (let i = 1; i < sectionLines.length; i++) {
      const line = sectionLines[i];
      if (line.match(/- \[ \]/)) {
        newSectionContent += line.replace("- [ ]", "- [x]") + "\n";
      } else {
        newSectionContent += line + "\n";
      }
    }

    // テンプレートを更新
    const newLines = [
      ...lines.slice(0, section.start),
      ...newSectionContent.split("\n"),
      ...lines.slice(section.end),
    ];

    return newLines.join("\n");
  }
}
