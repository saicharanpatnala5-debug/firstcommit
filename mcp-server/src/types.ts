export interface RepoOverview {
  owner: string;
  repo: string;
  description: string | null;
  default_branch: string;
  stars: number;
  open_issues_count: number;
  language: string | null;
  license: string | null;
  topics: string[];
}

export interface ReadmeResult {
  owner: string;
  repo: string;
  path: string;
  content: string; // Wrapped in <untrusted_repo_data>
  truncated: boolean;
}

export interface FileTreeItem {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export interface FileTreeResult {
  owner: string;
  repo: string;
  branch: string;
  tree: FileTreeItem[];
  truncated: boolean;
}

export interface FileContentResult {
  owner: string;
  repo: string;
  path: string;
  content: string; // Wrapped in <untrusted_repo_data>
  size: number;
  truncated: boolean;
}

export interface IssueSummary {
  number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  author: string;
  comments_count: number;
  created_at: string;
  is_claimed?: boolean;
  score?: number;
}

export interface ContributionReadiness {
  hasContributingGuide: boolean;
  hasLicense: boolean;
  hasCodeOfConduct: boolean;
  licenseName: string | null;
}

export interface IssueDetailResult {
  number: number;
  title: string;
  url: string;
  author: string;
  state: string;
  labels: string[];
  body: string; // Wrapped in <untrusted_repo_data>
  comments: Array<{
    author: string;
    created_at: string;
    body: string; // Wrapped in <untrusted_repo_data>
  }>;
}
