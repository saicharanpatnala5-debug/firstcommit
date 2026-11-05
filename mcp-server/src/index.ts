import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { GitHubClient } from "./github.js";
import * as dotenv from "dotenv";

dotenv.config();

const client = new GitHubClient();

const server = new Server(
  {
    name: "firstcommit-github-tools",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const TOOLS: Tool[] = [
  {
    name: "github_repo_overview",
    description: "Fetch basic repository overview including description, default branch, primary language, license, and stars count.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub repository owner/organization (e.g. 'pallets' or 'sandbox-quantum')" },
        repo: { type: "string", description: "Repository name (e.g. 'click' or 'switch')" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_readme",
    description: "Fetch the repository README content securely wrapped in <untrusted_repo_data> tags.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub repository owner/organization" },
        repo: { type: "string", description: "Repository name" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_file_tree",
    description: "Fetch recursive file tree of the repository up to 300 entries.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub repository owner/organization" },
        repo: { type: "string", description: "Repository name" },
        branch: { type: "string", description: "Optional branch name. Defaults to the repository's default branch." }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_file_content",
    description: "Fetch the content of a single text file (e.g. CONTRIBUTING.md, pyproject.toml, package.json) wrapped in <untrusted_repo_data>.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub repository owner/organization" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path in the repository (e.g. 'CONTRIBUTING.md' or 'src/index.ts')" },
        branch: { type: "string", description: "Optional branch name" }
      },
      required: ["owner", "repo", "path"]
    }
  },
  {
    name: "github_open_issues",
    description: "Fetch open issues from the repository with optional label filtering (e.g. 'good first issue', 'hackathon', 'beginner').",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub repository owner/organization" },
        repo: { type: "string", description: "Repository name" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of labels to filter by (e.g. ['good first issue', 'help wanted'])"
        }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_issue_detail",
    description: "Fetch detailed information for a specific issue including its body and discussion comments, wrapped in <untrusted_repo_data>.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub repository owner/organization" },
        repo: { type: "string", description: "Repository name" },
        issue_number: { type: "number", description: "Issue number (e.g. 1234)" }
      },
      required: ["owner", "repo", "issue_number"]
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "github_repo_overview": {
        const { owner, repo } = args as { owner: string; repo: string };
        const result = await client.getRepoOverview(owner, repo);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "github_readme": {
        const { owner, repo } = args as { owner: string; repo: string };
        const result = await client.getReadme(owner, repo);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "github_file_tree": {
        const { owner, repo, branch } = args as { owner: string; repo: string; branch?: string };
        const result = await client.getFileTree(owner, repo, branch);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "github_file_content": {
        const { owner, repo, path, branch } = args as { owner: string; repo: string; path: string; branch?: string };
        const result = await client.getFileContent(owner, repo, path, branch);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "github_open_issues": {
        const { owner, repo, labels } = args as { owner: string; repo: string; labels?: string[] };
        const result = await client.getOpenIssues(owner, repo, labels);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "github_issue_detail": {
        const { owner, repo, issue_number } = args as { owner: string; repo: string; issue_number: number };
        const result = await client.getIssueDetail(owner, repo, issue_number);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FirstCommit GitHub Tools MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error running MCP server:", err);
  process.exit(1);
});
