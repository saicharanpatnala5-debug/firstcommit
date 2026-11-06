import {
  RepoOverview,
  ReadmeResult,
  FileTreeResult,
  FileContentResult,
  IssueSummary,
  IssueDetailResult
} from "./types.js";

const MAX_TEXT_CHARS = 30000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  data: any;
  expiresAt: number;
}

export class GitHubClient {
  private token?: string;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
  }

  private wrapUntrusted(content: string): string {
    const sanitized = content
      .replace(/<\/untrusted_repo_data>/gi, "&lt;/untrusted_repo_data&gt;")
      .replace(/<untrusted_repo_data>/gi, "&lt;untrusted_repo_data&gt;");
    return `<untrusted_repo_data>\n${sanitized}\n</untrusted_repo_data>`;
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  private async fetchGitHub(path: string): Promise<any> {
    if (path.startsWith("http://") || path.startsWith("https://") || path.includes("://")) {
      throw new Error(`Security Violation: Target host must be api.github.com, absolute URLs not permitted: ${path}`);
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `https://api.github.com${cleanPath}`;

    // Security check: Must strictly target api.github.com
    const parsed = new URL(url);
    if (parsed.hostname !== "api.github.com") {
      throw new Error(`Security Violation: Target host must be api.github.com, got ${parsed.hostname}`);
    }

    const cached = this.getCache<any>(url);
    if (cached) {
      return cached;
    }

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "FirstCommit-Mentor-Agent/1.0"
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Only GET method is permitted
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`GitHub Request Timeout: Call to ${url} exceeded 15 seconds.`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) {
      throw new Error(`Not Found: The requested resource '${path}' was not found on GitHub.`);
    }

    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = response.headers.get("x-ratelimit-reset");
      const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : "soon";
      throw new Error(`GitHub Rate Limit Reached: Remaining calls: ${remaining || 0}. Resets at ${resetTime}. Please wait or configure a read-only GITHUB_TOKEN.`);
    }

    if (!response.ok) {
      throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    this.setCache(url, data);
    return data;
  }

  // Tool 1: Repo Overview
  public async getRepoOverview(owner: string, repo: string): Promise<RepoOverview> {
    const data = await this.fetchGitHub(`/repos/${owner}/${repo}`);
    return {
      owner: data.owner.login,
      repo: data.name,
      description: data.description,
      default_branch: data.default_branch,
      stars: data.stargazers_count,
      open_issues_count: data.open_issues_count,
      language: data.language,
      license: data.license?.name || null,
      topics: data.topics || []
    };
  }

  // Tool 2: README
  public async getReadme(owner: string, repo: string): Promise<ReadmeResult> {
    const data = await this.fetchGitHub(`/repos/${owner}/${repo}/readme`);
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    const truncated = decoded.length > MAX_TEXT_CHARS;
    const text = truncated ? decoded.substring(0, MAX_TEXT_CHARS) + "\n\n... [TRUNCATED DUE TO SIZE LIMIT] ..." : decoded;

    return {
      owner,
      repo,
      path: data.path || "README.md",
      content: this.wrapUntrusted(text),
      truncated
    };
  }

  // Tool 3: File Tree (capped at 300 entries for safety)
  public async getFileTree(owner: string, repo: string, branch?: string): Promise<FileTreeResult> {
    const targetBranch = branch || (await this.getRepoOverview(owner, repo)).default_branch;
    const data = await this.fetchGitHub(`/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`);
    
    const tree = (data.tree || []).slice(0, 300).map((item: any) => ({
      path: item.path,
      type: item.type === "tree" ? ("tree" as const) : ("blob" as const),
      size: item.size
    }));

    return {
      owner,
      repo,
      branch: targetBranch,
      tree,
      truncated: (data.tree || []).length > 300
    };
  }

  // Tool 4: One File Content
  public async getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<FileContentResult> {
    const query = branch ? `?ref=${branch}` : "";
    const data = await this.fetchGitHub(`/repos/${owner}/${repo}/contents/${path}${query}`);
    
    if (data.type !== "file") {
      throw new Error(`Target '${path}' is not a file (it is a ${data.type}).`);
    }

    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    const truncated = decoded.length > MAX_TEXT_CHARS;
    const text = truncated ? decoded.substring(0, MAX_TEXT_CHARS) + "\n\n... [TRUNCATED DUE TO SIZE LIMIT] ..." : decoded;

    return {
      owner,
      repo,
      path: data.path,
      content: this.wrapUntrusted(text),
      size: data.size,
      truncated
    };
  }

  // Tool 5: Open Issues with Deterministic Beginner Scoring & Claim Detection
  public async getOpenIssues(owner: string, repo: string, labels?: string[]): Promise<IssueSummary[]> {
    let path = `/repos/${owner}/${repo}/issues?state=open&per_page=25`;
    if (labels && labels.length > 0) {
      path += `&labels=${encodeURIComponent(labels.join(","))}`;
    }

    const data = await this.fetchGitHub(path);
    
    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const issuesOnly = (data || []).filter((item: any) => !item.pull_request);

    const scoredIssues = issuesOnly.map((item: any) => {
      const itemLabels = (item.labels || []).map((l: any) => typeof l === "string" ? l : l.name);
      const isClaimed = Boolean(item.assignee || (item.assignees && item.assignees.length > 0));

      // Deterministic Scoring for beginner suitability
      let score = 50;
      const lowerLabels = itemLabels.map((l: string) => l.toLowerCase());
      if (lowerLabels.some((l: string) => l.includes("good first issue") || l.includes("beginner") || l.includes("starter") || l.includes("easy"))) {
        score += 30;
      }
      if (lowerLabels.some((l: string) => l.includes("help wanted") || l.includes("documentation") || l.includes("docs"))) {
        score += 15;
      }
      if (isClaimed) {
        score -= 25; // Deprioritize already claimed issues
      }
      if (item.comments === 0) {
        score += 5; // Uncontested
      } else if (item.comments > 10) {
        score -= 10; // High contention
      }

      return {
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state,
        labels: itemLabels,
        author: item.user?.login || "unknown",
        comments_count: item.comments || 0,
        created_at: item.created_at,
        is_claimed: isClaimed,
        score
      };
    });

    // Sort by deterministic score descending
    scoredIssues.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    return scoredIssues.slice(0, 10);
  }

  // Tool 6: One Issue + Comments
  public async getIssueDetail(owner: string, repo: string, issueNumber: number): Promise<IssueDetailResult> {
    const issue = await this.fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    const commentsData = await this.fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=15`);

    const comments = (commentsData || []).map((c: any) => {
      const rawBody = c.body || "";
      const truncated = rawBody.length > 5000 ? rawBody.substring(0, 5000) + "... [TRUNCATED]" : rawBody;
      return {
        author: c.user?.login || "unknown",
        created_at: c.created_at,
        body: this.wrapUntrusted(truncated)
      };
    });

    const rawBody = issue.body || "No description provided.";
    const bodyTruncated = rawBody.length > 10000 ? rawBody.substring(0, 10000) + "... [TRUNCATED]" : rawBody;

    return {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      author: issue.user?.login || "unknown",
      state: issue.state,
      labels: (issue.labels || []).map((l: any) => typeof l === "string" ? l : l.name),
      body: this.wrapUntrusted(bodyTruncated),
      comments
    };
  }

  // Tool 7: Contribution Readiness Check
  public async getContributionReadiness(owner: string, repo: string): Promise<{
    hasContributingGuide: boolean;
    hasLicense: boolean;
    hasCodeOfConduct: boolean;
    licenseName: string | null;
  }> {
    const overview = await this.getRepoOverview(owner, repo);
    let hasContributingGuide = false;
    let hasCodeOfConduct = false;

    try {
      const tree = await this.getFileTree(owner, repo);
      const paths = tree.tree.map(t => t.path.toLowerCase());
      hasContributingGuide = paths.some(p => p.includes("contributing"));
      hasCodeOfConduct = paths.some(p => p.includes("code_of_conduct") || p.includes("conduct"));
    } catch (e) {}

    return {
      hasContributingGuide,
      hasLicense: Boolean(overview.license),
      hasCodeOfConduct,
      licenseName: overview.license
    };
  }
}
