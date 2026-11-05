import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../src/github.js";

test("GitHubClient - Unit Tests with Mocked Responses", async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("Tool 1: getRepoOverview returns structured repo metadata", async () => {
    const mockRepoData = {
      owner: { login: "testowner" },
      name: "testrepo",
      description: "A great open source repo",
      default_branch: "main",
      stargazers_count: 1500,
      open_issues_count: 12,
      language: "TypeScript",
      license: { name: "MIT License" },
      topics: ["hackathon", "first-timers"]
    };

    globalThis.fetch = async (url: any) => {
      assert.match(url.toString(), /repos\/testowner\/testrepo$/);
      return new Response(JSON.stringify(mockRepoData), { status: 200 });
    };

    const client = new GitHubClient();
    const overview = await client.getRepoOverview("testowner", "testrepo");

    assert.equal(overview.owner, "testowner");
    assert.equal(overview.repo, "testrepo");
    assert.equal(overview.stars, 1500);
    assert.equal(overview.default_branch, "main");
    assert.equal(overview.license, "MIT License");
  });

  await t.test("Tool 2: getReadme wraps content in <untrusted_repo_data>", async () => {
    const rawContent = "# Welcome\nThis is a sample project.";
    const base64Content = Buffer.from(rawContent).toString("base64");

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ path: "README.md", content: base64Content }), { status: 200 });
    };

    const client = new GitHubClient();
    const readme = await client.getReadme("testowner", "testrepo");

    assert.equal(readme.path, "README.md");
    assert.match(readme.content, /<untrusted_repo_data>/);
    assert.match(readme.content, /# Welcome/);
    assert.match(readme.content, /<\/untrusted_repo_data>/);
    assert.equal(readme.truncated, false);
  });

  await t.test("Tool 3: getFileTree handles recursive tree", async () => {
    const mockTree = {
      tree: [
        { path: "README.md", type: "blob", size: 100 },
        { path: "src", type: "tree" },
        { path: "src/index.ts", type: "blob", size: 500 }
      ]
    };

    globalThis.fetch = async (url: any) => {
      if (url.toString().includes("/repos/testowner/testrepo/git/trees/main")) {
        return new Response(JSON.stringify(mockTree), { status: 200 });
      }
      return new Response(JSON.stringify({ owner: { login: "testowner" }, name: "testrepo", default_branch: "main" }), { status: 200 });
    };

    const client = new GitHubClient();
    const result = await client.getFileTree("testowner", "testrepo", "main");

    assert.equal(result.tree.length, 3);
    assert.equal(result.tree[0].path, "README.md");
    assert.equal(result.tree[1].type, "tree");
  });

  await t.test("Tool 4: getFileContent wraps code in <untrusted_repo_data>", async () => {
    const code = "console.log('hello world');";
    const base64 = Buffer.from(code).toString("base64");

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ path: "src/index.ts", type: "file", content: base64, size: code.length }), { status: 200 });
    };

    const client = new GitHubClient();
    const file = await client.getFileContent("testowner", "testrepo", "src/index.ts");

    assert.equal(file.path, "src/index.ts");
    assert.match(file.content, /<untrusted_repo_data>/);
    assert.match(file.content, /console\.log\('hello world'\);/);
  });

  await t.test("Tool 5: getOpenIssues filters out Pull Requests", async () => {
    const mockIssues = [
      { number: 1, title: "Real issue", html_url: "https://...", state: "open", labels: ["good first issue"], comments: 2, created_at: "2026-11-01" },
      { number: 2, title: "A PR", html_url: "https://...", state: "open", pull_request: {}, labels: [], comments: 0, created_at: "2026-11-02" }
    ];

    globalThis.fetch = async () => {
      return new Response(JSON.stringify(mockIssues), { status: 200 });
    };

    const client = new GitHubClient();
    const issues = await client.getOpenIssues("testowner", "testrepo", ["good first issue"]);

    assert.equal(issues.length, 1);
    assert.equal(issues[0].number, 1);
    assert.equal(issues[0].title, "Real issue");
  });

  await t.test("Tool 6: getIssueDetail includes issue body and discussion comments", async () => {
    const mockIssue = {
      number: 42,
      title: "Typo in CLI help",
      html_url: "https://github.com/testowner/testrepo/issues/42",
      user: { login: "maintainer" },
      state: "open",
      labels: [{ name: "beginner" }],
      body: "Please fix the typo in options.py"
    };
    const mockComments = [
      { user: { login: "contributor1" }, created_at: "2026-11-03", body: "I would like to take this!" }
    ];

    globalThis.fetch = async (url: any) => {
      if (url.toString().endsWith("/comments?per_page=15")) {
        return new Response(JSON.stringify(mockComments), { status: 200 });
      }
      return new Response(JSON.stringify(mockIssue), { status: 200 });
    };

    const client = new GitHubClient();
    const detail = await client.getIssueDetail("testowner", "testrepo", 42);

    assert.equal(detail.number, 42);
    assert.match(detail.body, /<untrusted_repo_data>/);
    assert.match(detail.body, /Please fix the typo/);
    assert.equal(detail.comments.length, 1);
    assert.match(detail.comments[0].body, /I would like to take this!/);
  });

  await t.test("Security & Cache: Re-request uses cache without additional network call", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(JSON.stringify({
        owner: { login: "testowner" },
        name: "testrepo",
        default_branch: "main",
        stargazers_count: 10,
        open_issues_count: 1,
        language: "Python"
      }), { status: 200 });
    };

    const client = new GitHubClient();
    await client.getRepoOverview("testowner", "testrepo");
    assert.equal(callCount, 1);

    // Second call should hit the in-memory 10-minute cache
    await client.getRepoOverview("testowner", "testrepo");
    assert.equal(callCount, 1);
  });

  await t.test("Security: Blocks non-api.github.com destinations", async () => {
    const client = new GitHubClient();
    // Private method test via injection
    await assert.rejects(
      async () => {
        // @ts-ignore
        await client.fetchGitHub("https://evil.com/data");
      },
      /Security Violation/
    );
  });

  await t.test("Error Handling: 404 returns clean Not Found message", async () => {
    globalThis.fetch = async () => {
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    };

    const client = new GitHubClient();
    await assert.rejects(
      async () => {
        await client.getRepoOverview("nonexistent", "repo");
      },
      /Not Found: The requested resource/
    );
  });
});
