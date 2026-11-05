import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../src/github.js";

test("Live Smoke Test - Public Repository Real Data", async () => {
  const client = new GitHubClient();
  const owner = "sandbox-quantum";
  const repo = "switch";

  console.log(`Running live smoke test on https://github.com/${owner}/${repo}...`);
  
  // 1. Live Overview
  const overview = await client.getRepoOverview(owner, repo);
  console.log(` - Repo: ${overview.owner}/${overview.repo}, Stars: ${overview.stars}, Default Branch: ${overview.default_branch}`);
  assert.equal(overview.owner.toLowerCase(), owner.toLowerCase());
  assert.equal(overview.repo.toLowerCase(), repo.toLowerCase());
  assert.ok(overview.stars >= 0);

  // 2. Live README
  const readme = await client.getReadme(owner, repo);
  console.log(` - README path: ${readme.path}, length: ${readme.content.length} chars`);
  assert.match(readme.content, /<untrusted_repo_data>/);
  assert.match(readme.content, /<\/untrusted_repo_data>/);

  // 3. Live File Tree
  const tree = await client.getFileTree(owner, repo);
  console.log(` - File tree item count: ${tree.tree.length}`);
  assert.ok(tree.tree.length > 0);

  // 4. Live Open Issues
  const issues = await client.getOpenIssues(owner, repo);
  console.log(` - Fetched ${issues.length} open issues`);
  assert.ok(Array.isArray(issues));
  if (issues.length > 0) {
    const first = issues[0];
    console.log(`   Issue #${first.number}: "${first.title}"`);
    assert.ok(first.number > 0);
    assert.ok(first.title.length > 0);
  }

  console.log("Live Smoke Test Passed Successfully!");
});
