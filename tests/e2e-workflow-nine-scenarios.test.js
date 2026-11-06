/**
 * Comprehensive Automated End-to-End Test Suite for FirstCommit Multi-Agent Workflows
 * Verifies all 9 Test Scenarios (TC-01 through TC-09) and Context Isolation
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  detectRepoStack,
  detectDiffVulnerabilities,
  contextManager,
  formatTestDesignerResponse,
  formatExplainerResponse,
  formatCodeReviewResponse,
  formatPrDraftResponse
} = require('../bin/workflow-context');

const {
  processUserPrompt,
  extractUserQuery
} = require('../bin/antigravity-acp');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('   FIRSTCOMMIT WORKFLOW VERIFICATION SUITE (ALL 9 SCENARIOS)   ');
  console.log('================================================================\n');

  const testRoomId = 'test-room-' + Date.now();
  const testUserId = 'test-user-alice';

  // -----------------------------------------------------------------
  // 1. REPO STACK DETECTION UNIT TESTS
  // -----------------------------------------------------------------
  console.log('--- Subsystem: Repository Tech Stack & Native Test Runner Detection ---');

  runTest('Detects Python repository with pytest', () => {
    const stack = detectRepoStack({ language: 'Python' }, ['tests/test_main.py', 'requirements.txt']);
    assert.strictEqual(stack.language, 'Python');
    assert.strictEqual(stack.testFramework, 'pytest');
    assert.strictEqual(stack.testCommand, 'pytest tests/ -v');
  });

  runTest('Detects TypeScript / Node repository with Jest', () => {
    const stack = detectRepoStack({ language: 'TypeScript' }, ['jest.config.js', 'package.json']);
    assert.strictEqual(stack.testFramework, 'Jest');
    assert.strictEqual(stack.testCommand, 'npm test');
  });

  runTest('Detects TypeScript / Node repository with Vitest', () => {
    const stack = detectRepoStack({ language: 'TypeScript' }, ['vitest.config.ts', 'package.json']);
    assert.strictEqual(stack.testFramework, 'Vitest');
    assert.strictEqual(stack.testCommand, 'npx vitest run');
  });

  runTest('Detects Go repository with go test', () => {
    const stack = detectRepoStack({ language: 'Go' }, ['go.mod', 'main.go']);
    assert.strictEqual(stack.testFramework, 'go test');
    assert.strictEqual(stack.testCommand, 'go test ./...');
  });

  runTest('Detects Rust repository with cargo test', () => {
    const stack = detectRepoStack({ language: 'Rust' }, ['Cargo.toml', 'src/main.rs']);
    assert.strictEqual(stack.testFramework, 'cargo test');
    assert.strictEqual(stack.testCommand, 'cargo test');
  });

  // -----------------------------------------------------------------
  // 2. VULNERABILITY DETECTION ENGINE UNIT TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Subsystem: Static Security Analysis & Vulnerability Scanner ---');

  runTest('Flags Command Injection (os.system)', () => {
    const diff = `--- a/connector.py\n+++ b/connector.py\n@@ -10,1 +10,2 @@\n+    os.system(f"echo {user_input}")`;
    const findings = detectDiffVulnerabilities(diff);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].name, 'Command Injection');
    assert.strictEqual(findings[0].severity, 'Critical');
    assert.strictEqual(findings[0].filePath, 'connector.py');
    assert.strictEqual(findings[0].lineRange, 'line 10');
  });

  runTest('Flags SQL Injection (raw SELECT format string)', () => {
    const diff = `--- a/db.py\n+++ b/db.py\n@@ -25,1 +25,2 @@\n+    cursor.execute(f"SELECT * FROM users WHERE email = '{user_email}'")`;
    const findings = detectDiffVulnerabilities(diff);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].name, 'SQL Injection');
    assert.strictEqual(findings[0].severity, 'Critical');
  });

  runTest('Flags Path Traversal (open user file)', () => {
    const diff = `--- a/files.py\n+++ b/files.py\n@@ -40,1 +40,2 @@\n+    with open(f"/tmp/{filename}", "r") as f:`;
    const findings = detectDiffVulnerabilities(diff);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].name, 'Path Traversal');
    assert.strictEqual(findings[0].severity, 'High');
  });

  runTest('Flags Hardcoded Secrets', () => {
    const diff = `--- a/config.py\n+++ b/config.py\n@@ -5,1 +5,2 @@\n+    api_key = "sk_live_12345678901234"`;
    const findings = detectDiffVulnerabilities(diff);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].name, 'Hardcoded Secret');
    assert.strictEqual(findings[0].severity, 'High');
  });

  runTest('Passes Clean, Safe Diff with Zero Findings', () => {
    const diff = `--- a/connector.py\n+++ b/connector.py\n@@ -10,2 +10,3 @@\n def format_payload(msg):\n+    sanitized = str(msg).strip()\n+    return {"body": sanitized}`;
    const findings = detectDiffVulnerabilities(diff);
    assert.strictEqual(findings.length, 0);
  });

  // -----------------------------------------------------------------
  // 3. NINE CORE SCENARIO TESTS (TC-01 through TC-09)
  // -----------------------------------------------------------------
  console.log('\n--- End-to-End Scenario Suite: TC-01 through TC-09 ---');

  // Initialize context for the workflow
  contextManager.resetRepo(testRoomId, testUserId, 'sandbox-quantum', 'switch', {
    language: 'Python',
    default_branch: 'main',
    treeFiles: ['switch_core/main.py', 'switch_core/bridges/mattermost.py', 'tests/test_bridge.py'],
    readmeExcerpt: 'Open-source AI teammates in Slack, Teams, Discord, Telegram and Mattermost.'
  });

  // TC-01: Repository Discovery
  await runAsyncTest('TC-01: Repository Discovery (Scout inspects valid repo)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-scout inspect https://github.com/sandbox-quantum/switch`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('<untrusted_repo_data>'), 'Output must wrap repo data in untrusted data tag');
    assert(res.includes('FirstCommit Scout'), 'Must identify as Scout');
    assert(res.includes('sandbox-quantum/switch'), 'Must identify repository name');
    assert(res.includes('Next Step'), 'Must guide user to next step');
  });

  // TC-02: Invalid Repository
  await runAsyncTest('TC-02: Invalid Repository Handling (404 Not Found)', async () => {
    const invalidRoomId = 'invalid-room-' + Date.now();
    const prompt = `[Switch] ${testUserId} in ${invalidRoomId} says:\n@firstcommit-scout inspect https://github.com/sandbox-quantum/this-repo-does-not-exist-xyz-999`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('Could not find') || res.includes('does not exist') || res.includes('404') || res.includes('Repository Not Found'), 'Must cleanly notify user repo is unavailable');
  });

  // TC-03: Issue Selection
  await runAsyncTest('TC-03: Issue Selection (Mentor binds selected issue to context)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-mentor I pick #842`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('#842'), 'Response must acknowledge Issue #842');
    assert(res.includes('Targeted Breakdown') || res.includes('Next Step') || res.includes('approve plan'), 'Must provide issue details and next steps');

    // Verify context state updated
    const ctx = contextManager.get(testRoomId, testUserId);
    assert.strictEqual(ctx.selectedIssue.number, 842, 'Workflow context must record selected issue #842');
  });

  // TC-04: Action Plan Generation
  await runAsyncTest('TC-04: Action Plan Generation (Mentor delivers 4-step plan with Gate 1)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-mentor Explain what this repo does and how I can start contributing.`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('4-Step Action Plan'), 'Must include 4-Step Action Plan');
    assert(res.includes('Step 1: Local Setup'), 'Must include Step 1');
    assert(res.includes('Step 2: Codebase Exploration'), 'Must include Step 2');
    assert(res.includes('Step 3: Implementation'), 'Must include Step 3');
    assert(res.includes('Step 4: Diff Review & PR'), 'Must include Step 4');
    assert(res.includes('GATE 1: Human Plan Approval'), 'Must conclude with Gate 1 approval requirement');
    assert(res.includes('`approve plan`'), 'Must provide exact keyword for approval');
  });

  // TC-05: Gate 1 Approval
  await runAsyncTest('TC-05: Gate 1 Approval (Human approves plan, triggers environment setup)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-mentor approve plan`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('Plan Approved'), 'Must confirm Plan Approved');
    assert(res.includes('pytest tests/ -v'), 'Must supply repo-specific native test command');

    // Verify context status
    const ctx = contextManager.get(testRoomId, testUserId);
    assert.strictEqual(ctx.actionPlan.approved, true, 'Action plan approved flag must be true');
    assert.strictEqual(ctx.actionPlan.approvedBy, testUserId, 'Approver must match user ID');
  });

  // TC-06: Test Designer
  await runAsyncTest('TC-06: Test Designer (Contextual test strategy matching issue and tech stack)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-test-designer design tests for issue #842`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');

    // Required sections
    assert(res.includes('### 🧪 Test Strategy by FirstCommit Test Designer'), 'Must contain header');
    assert(res.includes('**Test Strategy**'), 'Must contain Test Strategy');
    assert(res.includes('**Test Cases**'), 'Must contain Test Cases');
    assert(res.includes('**Execution Instructions**'), 'Must contain Execution Instructions');
    assert(res.includes('**Coverage Gaps**'), 'Must contain Coverage Gaps');

    // Required 4 test cases
    assert(res.includes('TC-01: Happy Path'), 'Must contain TC-01 Happy Path');
    assert(res.includes('TC-02: Negative Test'), 'Must contain TC-02 Negative Test');
    assert(res.includes('TC-03: Boundary & Falsy Input Test'), 'Must contain TC-03 Boundary Test');
    assert(res.includes('TC-04: Scope & Regression Defense'), 'Must contain TC-04 Scope Test');

    // Required test case attributes
    assert(res.includes('- **Test ID**:'), 'Must specify Test ID');
    assert(res.includes('- **Test Name**:'), 'Must specify Test Name');
    assert(res.includes('- **Objective**:'), 'Must specify Objective');
    assert(res.includes('- **Preconditions**:'), 'Must specify Preconditions');
    assert(res.includes('- **Input**:'), 'Must specify Input');
    assert(res.includes('- **Expected Output**:'), 'Must specify Expected Output');
    assert(res.includes('- **Edge Cases**:'), 'Must specify Edge Cases');
    assert(res.includes('- **Relevant Source File**:'), 'Must specify Relevant Source File');

    // Must use native test command for Python
    assert(res.includes('pytest tests/ -v'), 'Must use detected native test command');
  });

  // TC-07: Explainer
  await runAsyncTest('TC-07: Explainer (Architectural rationale, diff, and verification)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-explainer what are we solving and what needs to be changed?`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');

    // All 6 required sections
    assert(res.includes('**What are we solving?**'), 'Must include "What are we solving?"');
    assert(res.includes('**Why is this change necessary?**'), 'Must include "Why is this change necessary?"');
    assert(res.includes('**How does the implementation work?**'), 'Must include "How does the implementation work?"');
    assert(res.includes('**What changed?**'), 'Must include "What changed?"');
    assert(res.includes('**How can I verify it?**'), 'Must include "How can I verify it?"');
    assert(res.includes('**What should I understand as a contributor?**'), 'Must include "What should I understand as a contributor?"');

    // Grounded in issue #842 and repo
    assert(res.includes('842'), 'Must reference selected issue #842');
    assert(res.includes('pytest tests/ -v'), 'Must provide native verification command');
  });

  // TC-08: Code Reviewer – Vulnerable Diff
  await runAsyncTest('TC-08: Code Reviewer (Detects vulnerability, returns REQUEST CHANGES, remediation & test)', async () => {
    const vulnerableDiff = `--- a/connector.py\n+++ b/connector.py\n@@ -20,3 +20,4 @@\n def execute_event(payload):\n+    import os\n+    os.system(f"curl https://events.local/{payload['id']}")`;
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-reviewer review this diff:\n${vulnerableDiff}`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');

    // Rigorous security assertions
    assert(res.includes('Overall verdict**: `REQUEST CHANGES`'), 'Verdict MUST be REQUEST CHANGES');
    assert(!res.includes('Verdict: looks good'), 'Verdict MUST NOT say looks good');
    assert(!res.includes('APPROVE'), 'Verdict MUST NOT approve vulnerable diff');
    assert(res.includes('Command Injection'), 'Must identify Command Injection');
    assert(res.includes('connector.py'), 'Must identify affected file');
    assert(res.includes('line 22'), 'Must identify affected line');
    assert(res.includes('subprocess with a list of arguments and shell=False'), 'Must provide concrete fix guidance');
    assert(res.includes('pytest tests/ -k'), 'Must provide suggested regression test');
    assert(res.includes('DO NOT MERGE'), 'Must give clear DO NOT MERGE recommendation');
  });

  // TC-08 (b): Code Reviewer – Clean Safe Diff
  await runAsyncTest('TC-08 (b): Code Reviewer (Safe diff returns APPROVE)', async () => {
    const safeDiff = `--- a/connector.py\n+++ b/connector.py\n@@ -15,2 +15,4 @@\n def format_payload(msg):\n+    if not msg:\n+        return {}\n+    return {"body": str(msg).strip()}`;
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-reviewer review this diff:\n${safeDiff}`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('Overall verdict**: `APPROVE`'), 'Safe diff should receive APPROVE');
  });

  // TC-09: PR Description
  await runAsyncTest('TC-09: PR Description (Structured description grounded in issue with Gate 2)', async () => {
    const prompt = `[Switch] ${testUserId} in ${testRoomId} says:\n@firstcommit-mentor draft PR`;
    const res = await processUserPrompt(prompt);
    assert(res, 'Response should not be null');
    assert(res.includes('### 🚀 PR Draft Ready for Submission!'), 'Must include PR draft header');
    assert(res.includes('PR Title**: `feat(connector): resolve #842'), 'Must include issue-grounded PR title');
    assert(res.includes('## Summary'), 'Must include Summary');
    assert(res.includes('## Key Changes'), 'Must include Key Changes');
    assert(res.includes('## Verification'), 'Must include Verification');
    assert(res.includes('GATE 2: Contributor Manual Submission'), 'Must conclude with Gate 2 notice');
    assert(res.includes('FirstCommit Mentor performs zero automated writes'), 'Must state read-only boundary');
  });

  // -----------------------------------------------------------------
  // 4. CONTEXT ISOLATION & RESET TESTS
  // -----------------------------------------------------------------
  console.log('\n--- Multi-User Context Isolation & Repo Switching ---');

  runTest('Context Isolation: User A and User B maintain independent workflows', () => {
    const userA = 'user-alice';
    const userB = 'user-bob';

    contextManager.resetRepo(testRoomId, userA, 'sandbox-quantum', 'switch');
    contextManager.setSelectedIssue(testRoomId, userA, { number: 842, title: 'Intercom Connector' });
    contextManager.approvePlan(testRoomId, userA);

    contextManager.resetRepo(testRoomId, userB, 'facebook', 'react');
    contextManager.setSelectedIssue(testRoomId, userB, { number: 101, title: 'Fix Hook Order' });

    const ctxA = contextManager.get(testRoomId, userA);
    const ctxB = contextManager.get(testRoomId, userB);

    assert.strictEqual(ctxA.repo.repo, 'switch');
    assert.strictEqual(ctxA.selectedIssue.number, 842);
    assert.strictEqual(ctxA.actionPlan.approved, true);

    assert.strictEqual(ctxB.repo.repo, 'react');
    assert.strictEqual(ctxB.selectedIssue.number, 101);
    assert.strictEqual(ctxB.actionPlan.approved, false);
  });

  runTest('Repo Reset: Switching repositories resets issue and approval gates cleanly', () => {
    const user = 'user-charlie';
    contextManager.resetRepo(testRoomId, user, 'sandbox-quantum', 'switch');
    contextManager.setSelectedIssue(testRoomId, user, { number: 842 });
    contextManager.approvePlan(testRoomId, user);

    // Switch repo
    const reset = contextManager.resetRepo(testRoomId, user, 'google', 'jax', { language: 'Python' });
    assert.strictEqual(reset.repo.repo, 'jax');
    assert.strictEqual(reset.selectedIssue, null);
    assert.strictEqual(reset.actionPlan.approved, false);
    assert.strictEqual(reset.status, 'DISCOVERY');
  });

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})   `);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner encountered unhandled error:', err);
  process.exit(1);
});
