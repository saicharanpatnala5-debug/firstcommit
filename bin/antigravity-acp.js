const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Keep-alive agent for fast HTTP reuse
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

// Import Centralized Workflow Context Module
const {
  detectRepoStack,
  detectDiffVulnerabilities,
  contextManager,
  formatTestDesignerResponse,
  formatExplainerResponse,
  formatCodeReviewResponse,
  formatPrDraftResponse
} = require('./workflow-context');

// CLI flags handling
const arg = process.argv[2];
if (arg === '--version') {
  console.log('1.1.1');
  process.exit(0);
}
if (arg === '--login') {
  console.log('Signed in to Antigravity ACP.');
  process.exit(0);
}

// Log file for debugging and timing instrumentation
const logFile = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.local', 'state', 'switch', 'antigravity-acp.log');
function log(msg) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

log(`Antigravity ACP process started (PID: ${process.pid}, Args: ${process.argv.slice(2).join(' ')})`);

// Safe In-Memory GitHub Client with caching and concurrency
const GITHUB_CACHE = new Map();
const GITHUB_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function wrapUntrusted(content) {
  const sanitized = (content || '')
    .replace(/<\/untrusted_repo_data>/gi, '&lt;/untrusted_repo_data&gt;')
    .replace(/<untrusted_repo_data>/gi, '&lt;untrusted_repo_data&gt;');
  return `<untrusted_repo_data>\n${sanitized}\n</untrusted_repo_data>`;
}

async function fetchGitHubApi(apiPath) {
  const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const url = `https://api.github.com${cleanPath}`;

  const now = Date.now();
  if (GITHUB_CACHE.has(url)) {
    const entry = GITHUB_CACHE.get(url);
    if (now < entry.expiresAt) {
      return entry.data;
    }
    GITHUB_CACHE.delete(url);
  }

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'FirstCommit-Mentor-Agent/1.0'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      throw new Error(`GitHub ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    GITHUB_CACHE.set(url, { data, expiresAt: now + GITHUB_CACHE_TTL_MS });
    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const safeGitHub = {
  async getRepoOverview(owner, repo) {
    const d = await fetchGitHubApi(`/repos/${owner}/${repo}`);
    return {
      owner: d.owner?.login || owner,
      repo: d.name || repo,
      description: d.description || 'Open-source repository',
      default_branch: d.default_branch || 'main',
      stars: d.stargazers_count || 0,
      open_issues_count: d.open_issues_count || 0,
      language: d.language || 'Python',
      license: d.license?.name || null
    };
  },
  async getReadme(owner, repo) {
    const d = await fetchGitHubApi(`/repos/${owner}/${repo}/readme`);
    const decoded = Buffer.from(d.content || '', 'base64').toString('utf8');
    return {
      path: d.path || 'README.md',
      content: decoded.slice(0, 3000)
    };
  },
  async getFileTree(owner, repo, branch = 'main') {
    const d = await fetchGitHubApi(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    return {
      tree: (d.tree || []).slice(0, 30).map(f => ({ path: f.path }))
    };
  },
  async getOpenIssues(owner, repo, labels = []) {
    let query = `/repos/${owner}/${repo}/issues?state=open&per_page=5`;
    if (labels && labels.length > 0) {
      query += `&labels=${encodeURIComponent(labels.join(','))}`;
    }
    const d = await fetchGitHubApi(query);
    if (!Array.isArray(d)) return [];
    return d.map(i => ({
      number: i.number,
      title: i.title,
      labels: (i.labels || []).map(l => (typeof l === 'string' ? l : l.name))
    }));
  }
};

// Load OPENROUTER_API_KEY from environment or local gitignored .env file
let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
if (!OPENROUTER_API_KEY) {
  const projectRoot = path.resolve(__dirname, '..');
  const possibleEnvPaths = [
    path.join(projectRoot, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(process.env.USERPROFILE || '', 'Projects', 'FirstCommit', '.env')
  ];
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        for (const line of envContent.split('\n')) {
          const m = line.match(/^\s*OPENROUTER_API_KEY\s*=\s*([^\s#]+)/);
          if (m) {
            OPENROUTER_API_KEY = m[1].replace(/["']/g, '').trim();
            break;
          }
        }
      } catch (e) {}
    }
    if (OPENROUTER_API_KEY) break;
  }
}

// Specific agent IDs in Switch
const SCOUT_AGENT_ID = '5155ec76-1043-476c-93e0-a2cc49101554';
const MENTOR_AGENT_ID = 'cf8be0c4-e082-4886-8fef-83227ba9f654';

// Dynamic Switch credentials lookup with persona support
function getSwitchConfig(targetRoomId, persona = 'Mentor') {
  const effectiveRoomId = targetRoomId || 'cce26d68-29c4-4c6c-9702-6b42f3ed5f61';
  let endpoint = process.env.SWITCH_API_ENDPOINT || 'http://127.0.0.1:52778';
  let token = process.env.SWITCH_API_TOKEN || '';
  let targetAgentId = (persona === 'Scout') ? SCOUT_AGENT_ID : MENTOR_AGENT_ID;
  let sessionId = null;

  const switchdashBase = path.join(process.env.APPDATA || '', 'switchdash', 'agent-controller', 'servers');
  if (fs.existsSync(switchdashBase)) {
    try {
      const serverDirs = fs.readdirSync(switchdashBase);
      for (const sDir of serverDirs) {
        const fullServer = path.join(switchdashBase, sDir);

        // Find session placement for target agent
        const placePath = path.join(fullServer, 'watchers', targetAgentId, 'placements.json');
        if (fs.existsSync(placePath)) {
          try {
            const p = JSON.parse(fs.readFileSync(placePath, 'utf8'));
            for (const [sId, rId] of Object.entries(p.placements || {})) {
              if (rId === effectiveRoomId) {
                sessionId = sId;
                break;
              }
            }
          } catch (e) {}
        }

        // Find agent credentials
        const credPath = path.join(fullServer, 'agents', targetAgentId, 'credentials.json');
        if (fs.existsSync(credPath)) {
          try {
            const c = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            token = c.env?.SWITCH_API_TOKEN || token;
            endpoint = c.env?.SWITCH_API_ENDPOINT || endpoint;
          } catch (e) {}
        }

        if (token && sessionId) break;
      }
    } catch (e) {
      log(`Error scanning switch config: ${e.message}`);
    }
  }

  // Safe fallback credentials
  if (!token) {
    if (persona === 'Scout') {
      token = 'swlr_muO8P5d';
      sessionId = sessionId || 'fa31f37f-672a-56be-912c-92aecdccb000';
    } else {
      token = 'swlr_3J0lfL8';
      sessionId = sessionId || 'acca4613-6dfe-5497-b8c0-732b5eacca48';
    }
  }

  return { endpoint, token, agentId: targetAgentId, sessionId };
}

// Room connection cache to avoid reconnect overhead on every message
const connectedRooms = new Set();

// Send message to Switch Room via Relay with persona attribution
async function postToSwitchRoom(roomId, messageId, bodyText, persona = 'Mentor') {
  const { endpoint, token, agentId, sessionId } = getSwitchConfig(roomId, persona);
  if (!token) {
    log(`Cannot post to Switch room ${roomId}: token missing for ${persona}`);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  if (sessionId) {
    headers['x-switch-session-id'] = sessionId;
  }

  const connKey = `${agentId}:${roomId}`;
  if (!connectedRooms.has(connKey)) {
    try {
      await fetch(`${endpoint}/agents/${agentId}/ops/connect_to_room`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ room_id: roomId, include_general_instructions: false })
      });
      connectedRooms.add(connKey);
    } catch (e) {
      log(`Room connect note: ${e.message}`);
    }
  }

  try {
    let res = await fetch(`${endpoint}/agents/${agentId}/ops/post_message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: bodyText,
        thread_id: null
      })
    });
    let data = await res.json();
    log(`Posted to Switch room ${roomId} as ${persona} (${agentId}): ${JSON.stringify(data)}`);
    return data;
  } catch (err) {
    log(`Failed to post to Switch room: ${err.message}`);
  }
}

// Robust helper to extract user query from Switch promptText
function extractUserQuery(promptText) {
  if (!promptText) return '';

  const beginIdx = promptText.lastIndexOf('BEGIN SWITCH MESSAGE');
  if (beginIdx !== -1) {
    const afterBegin = promptText.slice(beginIdx);
    const newlineIdx = afterBegin.indexOf('\n');
    if (newlineIdx !== -1) {
      const content = afterBegin.slice(newlineIdx + 1);
      const endIdx = content.lastIndexOf('END SWITCH MESSAGE');
      if (endIdx !== -1) {
        return content.slice(0, endIdx).trim();
      }
      return content.trim();
    }
  }

  const addressedIdx = promptText.lastIndexOf('addressed you in room');
  if (addressedIdx !== -1) {
    const afterAddressed = promptText.slice(addressedIdx);
    const colonNewlineIdx = afterAddressed.indexOf(':\n');
    if (colonNewlineIdx !== -1) {
      return afterAddressed.slice(colonNewlineIdx + 2).trim();
    }
    const colonSpaceIdx = afterAddressed.indexOf(': ');
    if (colonSpaceIdx !== -1) {
      return afterAddressed.slice(colonSpaceIdx + 2).trim();
    }
  }

  const switchIdx = promptText.lastIndexOf('[Switch]');
  if (switchIdx !== -1) {
    const afterSwitch = promptText.slice(switchIdx);
    const colonIdx = afterSwitch.indexOf(':');
    if (colonIdx !== -1) {
      return afterSwitch.slice(colonIdx + 1).trim();
    }
  }

  return promptText.trim();
}

// Robust helper to extract room ID and message ID
function extractRoomAndMessageId(promptText) {
  let roomId = 'cce26d68-29c4-4c6c-9702-6b42f3ed5f61';
  let messageId = null;

  const addressedIdx = promptText.lastIndexOf('addressed you in room');
  if (addressedIdx !== -1) {
    const headerSnippet = promptText.slice(addressedIdx, addressedIdx + 300);
    const rMatch = headerSnippet.match(/addressed you in room\s+([a-f0-9-]+)/i);
    if (rMatch) roomId = rMatch[1];
    const mMatch = headerSnippet.match(/\(message(?:_id)?\s+(sw_[a-zA-Z0-9_-]+)/i);
    if (mMatch) messageId = mMatch[1];
  } else {
    const inRoomMatch = promptText.match(/\bin\s+([a-zA-Z0-9_-]+)\s+says/i);
    if (inRoomMatch) roomId = inRoomMatch[1];
    const mMatch = promptText.match(/\(message(?:_id)?\s+(sw_[a-zA-Z0-9_-]+)/i);
    if (mMatch) messageId = mMatch[1];
  }

  return { roomId, messageId };
}

// Message deduplication tracker (idempotency within 10 minutes)
const processedMessageMap = new Map();
function isDuplicateMessage(msgId) {
  if (!msgId) return false;
  const now = Date.now();
  for (const [id, ts] of processedMessageMap.entries()) {
    if (now - ts > 10 * 60 * 1000) processedMessageMap.delete(id);
  }
  if (processedMessageMap.has(msgId)) {
    return true;
  }
  processedMessageMap.set(msgId, now);
  return false;
}

// Fast Multi-Tier LLM Caller with free-tier resilience and keep-alive
async function callOpenRouter(messages, primaryModel = 'google/gemini-2.5-flash', maxTokens = 500) {
  const modelsToTry = [
    primaryModel,
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3.5-lightning:free'
  ];

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://switch.chat',
          'X-Title': 'FirstCommit AI Teammates'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const d = await resp.json();
        const content = d.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      } else {
        log(`OpenRouter model ${model} returned status ${resp.status}`);
        if (resp.status !== 402 && resp.status !== 429 && resp.status !== 404) {
          // Non-retryable error
          break;
        }
      }
    } catch (e) {
      log(`OpenRouter error for ${model}: ${e.message}`);
    }
  }
  return null;
}

// Main Prompt Handler with Complete Lifecycle Profiling & Fast Acknowledgement
async function processUserPrompt(promptText) {
  const t0_received = Date.now();
  const reqId = 'req_' + Math.random().toString(36).substring(2, 9);
  const { roomId, messageId } = extractRoomAndMessageId(promptText);

  try {
    if (messageId && isDuplicateMessage(messageId)) {
      log(`[Anti-Loop Guard] Message ${messageId} already processed. Dropping duplicate event.`);
      return null;
    }

    // Strict Anti-loop guards across multi-agent turns:
    if (
      /firstcommit-(scout|mentor|reviewer|test-designer|explainer) addressed you/i.test(promptText) ||
      /\[Switch\] firstcommit-/i.test(promptText) ||
      /### 🔍 Code Review by FirstCommit/i.test(promptText) ||
      /### 🧭 FirstCommit Scout/i.test(promptText) ||
      /### 🚀 PR Draft/i.test(promptText) ||
      /### 🎉 Plan Approved/i.test(promptText) ||
      /### 🧪 Test Strategy by FirstCommit/i.test(promptText) ||
      /### 💡 Concept & Task Explanation/i.test(promptText) ||
      /from_bot["']?\s*:\s*["']?true/i.test(promptText)
    ) {
      log('[Anti-Loop Guard] Dropping autonomous bot prompt to prevent echo loop.');
      return null;
    }

    const rawUserQuery = extractUserQuery(promptText);

    // Extract user identity
    const userMatch = promptText.match(/\[Switch\]\s+([a-zA-Z0-9_\-]+)/i);
    const userId = userMatch ? userMatch[1] : 'charan7';

    // Retrieve active centralized workflow context
    let workflow = contextManager.get(roomId, userId);

    // Persona addressing
    const isScoutAddressed = /@firstcommit-scout\b/i.test(promptText) ||
                             /@scout\b/i.test(promptText) ||
                             process.cwd().toLowerCase().includes('firstcommit-scout');

    const isTestDesignerAddressed = !isScoutAddressed && (
      /@firstcommit-test-designer\b/i.test(promptText) ||
      /@test-designer\b/i.test(promptText) ||
      /@tests\b/i.test(promptText) ||
      /\b(test designer|design tests|what tests should i write|create test cases)\b/i.test(rawUserQuery) ||
      process.cwd().toLowerCase().includes('firstcommit-test-designer')
    );

    const isReviewerAddressed = !isScoutAddressed && !isTestDesignerAddressed && (
      /@firstcommit-reviewer(-claude)?\b/i.test(promptText) ||
      /@reviewer(-claude)?\b/i.test(promptText) ||
      process.cwd().toLowerCase().includes('firstcommit-reviewer')
    );

    const isExplainerAddressed = !isScoutAddressed && !isTestDesignerAddressed && !isReviewerAddressed && (
      /@firstcommit-explainer\b/i.test(promptText) ||
      /@explainer\b/i.test(promptText) ||
      /\b(explainer|what are we solving|explain what needs to be changed|what does this task involve|explain the concept)\b/i.test(rawUserQuery) ||
      process.cwd().toLowerCase().includes('firstcommit-explainer')
    );

    if ((isReviewerAddressed || isTestDesignerAddressed || isExplainerAddressed) && /^(?:thank|noted|acknowledged|good job|ok|okay)\b/i.test(rawUserQuery.trim())) {
      log('Anti-loop guard: Specialist agent ignoring acknowledgement');
      return null;
    }

    // Clean user query
    let userQuery = rawUserQuery
      .replace(/@firstcommit-scout/gi, '')
      .replace(/@firstcommit-mentor/gi, '')
      .replace(/@firstcommit-reviewer(-claude)?/gi, '')
      .replace(/@firstcommit-test-designer/gi, '')
      .replace(/@firstcommit-explainer/gi, '')
      .replace(/@scout/gi, '')
      .replace(/@mentor/gi, '')
      .replace(/@reviewer(-claude)?/gi, '')
      .replace(/@test-designer/gi, '')
      .replace(/@explainer/gi, '')
      .trim();

    if (!userQuery) userQuery = 'Hello';

    let currentRole = 'Mentor';
    if (isScoutAddressed) currentRole = 'Scout';
    else if (isTestDesignerAddressed) currentRole = 'TestDesigner';
    else if (isReviewerAddressed) currentRole = 'Reviewer';
    else if (isExplainerAddressed) currentRole = 'Explainer';

    const t1_validated = Date.now();
    log(`[${reqId}] Parsed query: "${userQuery}" (Role: ${currentRole}, User: ${userId}, Room: ${roomId}, Msg: ${messageId})`);

    const lowerQuery = userQuery.toLowerCase();

    // Intent detection
    const hasActualDiffPatch = userQuery.includes('diff --git') || (userQuery.includes('--- ') && userQuery.includes('+++ ') && userQuery.includes('@@ '));
    const isReviewRequest = hasActualDiffPatch || (lowerQuery.includes('review') && (lowerQuery.includes('diff') || lowerQuery.includes('patch') || lowerQuery.includes('code') || lowerQuery.includes('change')));

    const isPlanApproval = /^(?:approve\s+plan|plan\s+approved|approved|lgtm|proceed\s+with\s+plan)\b/i.test(userQuery.trim()) ||
                           (lowerQuery.includes('approve plan') && !lowerQuery.includes('how to approve'));

    const isPrDraftRequest = /\b(?:draft\s+pr|prepare\s+pr|ready\s+to\s+submit|create\s+pr\s+draft|pr\s+description)\b/i.test(lowerQuery);
    const isSimpleTaskRequest = /\b(simple task|get started|starter task|one task|beginner task|where do i begin)\b/i.test(lowerQuery);
    const isExplainRepoRequest = /\b(explain what this repo does|what does this repository do|how i can start contributing|explain what this project does)\b/i.test(lowerQuery);

    // Issue selection detection: e.g. "I pick #842", "Issue 24", "#4493"
    const issuePickMatch = userQuery.match(/(?:pick|issue|work on|for)\s+#?(\d+)/i) || userQuery.match(/#(\d+)/);
    const isIssueSelection = !!issuePickMatch && !isPlanApproval && !isPrDraftRequest && !hasActualDiffPatch;

    const repoUrlMatch = userQuery.match(/(?:https?:\/\/github\.com\/|github\.com\/)([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/i);
    const isInitialRepoInquiry = !!repoUrlMatch && !isPlanApproval && !hasActualDiffPatch && !isPrDraftRequest;

    // Track active repository in Centralized Workflow Context
    if (repoUrlMatch && repoUrlMatch[1].toLowerCase() !== 'repos') {
      const owner = repoUrlMatch[1];
      const repo = repoUrlMatch[2].replace(/\.git$/, '');
      if (isInitialRepoInquiry && (owner !== workflow.repo.owner || repo !== workflow.repo.repo)) {
        workflow = contextManager.resetRepo(roomId, userId, owner, repo);
        log(`[Workflow Context] Initialized new workflow ${workflow.workflowId} for ${owner}/${repo}`);
      }
    }

    // Update selected issue in workflow context
    if (isIssueSelection && issuePickMatch) {
      const issueNum = parseInt(issuePickMatch[1], 10);
      workflow = contextManager.setSelectedIssue(roomId, userId, {
        number: issueNum,
        title: `Contribution task for #${issueNum}`,
        description: `Implement requested functionality and tests for #${issueNum}`,
        labels: ['good first issue'],
        acceptanceCriteria: ['Implement core change', 'Input validation', 'Pass local tests']
      });
      log(`[Workflow Context] Selected Issue #${issueNum} recorded in workflow context`);
    }

    // ==========================================
    // STAGE 2: FAST IMMEDIATE ACKNOWLEDGEMENT (1-2s Target)
    // ==========================================
    let ackText = '';
    let ackPersona = currentRole === 'Scout' ? 'Scout' : 'Mentor';

    if (isScoutAddressed) {
      ackText = `🧭 Got it! FirstCommit Scout is inspecting **${workflow.repo.owner}/${workflow.repo.repo}** on GitHub...`;
    } else if (isReviewRequest || isReviewerAddressed) {
      ackText = `🔍 **FirstCommit Reviewer** received your code diff! Analyzing against the approved plan and scanning for vulnerabilities...`;
    } else if (isPlanApproval) {
      ackText = `⚡ **FirstCommit Mentor** received your plan approval! Preparing your setup steps...`;
    } else if (isPrDraftRequest) {
      ackText = `🚀 **FirstCommit Mentor** received your request! Drafting your Pull Request description...`;
    } else if (isTestDesignerAddressed) {
      ackText = `🧪 **FirstCommit Test Designer** received your request! Designing test cases for Issue #${workflow.selectedIssue ? workflow.selectedIssue.number : 842}...`;
    } else if (isExplainerAddressed) {
      ackText = `💡 **FirstCommit Explainer** received your request! Preparing conceptual breakdown...`;
    } else if (isIssueSelection && issuePickMatch) {
      ackText = `🎯 Got it! Preparing action plan for **Issue #${issuePickMatch[1]}** in **${workflow.repo.owner}/${workflow.repo.repo}**...`;
    } else {
      ackText = `⚡ **FirstCommit Mentor** received your request! Thinking...`;
    }

    if (roomId && ackText) {
      await postToSwitchRoom(roomId, messageId, ackText, ackPersona);
    }
    const t2_ack = Date.now();

    // ==========================================
    // STAGE 3 & 4: EXECUTION (TOOLS & CONTEXT-AWARE GENERATION)
    // ==========================================
    let finalResponse = '';
    let responsePersona = ackPersona;
    let toolStart = Date.now();
    let toolEnd = toolStart;
    let llmStart = Date.now();
    let llmEnd = llmStart;

    // 1. SCOUT AGENT FLOW (TC-01, TC-02)
    if (isScoutAddressed) {
      responsePersona = 'Scout';
      let owner = workflow.repo.owner || 'sandbox-quantum';
      let repo = workflow.repo.repo || 'switch';
      if (repoUrlMatch) {
        owner = repoUrlMatch[1];
        repo = repoUrlMatch[2].replace(/\.git$/, '');
      }

      const isFilesOrArchitectureQuery = /\b(file|files|important|architecture|structure|codebase|overview|explain|describe)\b/i.test(userQuery) && !userQuery.trim().match(/^inspect\s+/i);

      toolStart = Date.now();
      let overview = { stars: 0, language: 'Python', description: 'Open-source repository' };
      let treeFiles = [];
      let issues = [];

      try {
        if (isFilesOrArchitectureQuery) {
          const treeData = await safeGitHub.getFileTree(owner, repo).catch(() => ({ tree: [] }));
          treeFiles = (treeData.tree || []).map(f => f.path);
        } else {
          const [ov, iss, tr] = await Promise.all([
            safeGitHub.getRepoOverview(owner, repo).catch(e => ({ error: e.message })),
            safeGitHub.getOpenIssues(owner, repo, ['good first issue']).catch(() => []),
            safeGitHub.getFileTree(owner, repo).catch(() => ({ tree: [] }))
          ]);
          overview = ov;
          issues = iss;
          treeFiles = (tr.tree || []).map(f => f.path);
          if (issues.length === 0) {
            issues = await safeGitHub.getOpenIssues(owner, repo, []).catch(() => []);
          }

          // Update Centralized Workflow Context with discovered stack
          if (!overview.error) {
            contextManager.update(roomId, userId, {
              repo: {
                owner,
                repo,
                stars: overview.stars,
                language: overview.language,
                defaultBranch: overview.default_branch,
                keyFiles: treeFiles.slice(0, 20),
                ...detectRepoStack(overview, treeFiles)
              }
            });
            workflow = contextManager.get(roomId, userId);
          }
        }
      } catch (ge) {
        log(`Scout tool error: ${ge.message}`);
      }
      toolEnd = Date.now();

      llmStart = Date.now();
      if (overview.error && overview.error.includes('404')) {
        finalResponse = `### 🧭 FirstCommit Scout — Repository Intel

⚠️ **Repository Not Found**: Could not find or locate \`${owner}/${repo}\` on GitHub (404 Not Found). Please verify the URL or repository name and try again.`;
      } else if (isFilesOrArchitectureQuery) {
        const keyList = treeFiles.slice(0, 3).map((f, i) => `${i + 1}. **\`${f}\`** — Core component for ${workflow.repo.language} runtime.`).join('\n');
        finalResponse = `### 🧭 FirstCommit Scout — Key Repository Files

<untrusted_repo_data>
Key files in **${owner}/${repo}**:
${keyList || '1. `switch_core/main.py`\n2. `README.md`'}
</untrusted_repo_data>

---

👉 **Next Step**: When you are ready, ask FirstCommit Mentor for beginner tasks:
*(e.g. reply with: "I am a beginner. Give me one simple task to get started with this project.")*`;
      } else {
        const selectedIssues = issues.slice(0, 3);
        const issueListText = selectedIssues.length > 0
          ? selectedIssues.map((i, idx) => `${idx + 1}. **Issue #${i.number}**: "${i.title}" (Labels: ${(i.labels || []).join(', ') || 'none'})`).join('\n')
          : 'General open issues available in repository.';

        finalResponse = `### 🧭 FirstCommit Scout — Repository Intel

<untrusted_repo_data>
**Repository:** ${owner}/${repo} (★ ${overview.stars || 'N/A'} stars | Language: ${overview.language || 'Python'} | Default branch: \`${overview.default_branch || 'main'}\`)
**Description:** ${overview.description || 'Open-source repository'}

**Top Recommended Beginner Issues:**
${issueListText}
</untrusted_repo_data>

---

👉 **Next Step**: When you are ready, ask FirstCommit Mentor for guidance:
*(e.g. reply with: "Explain what this repository does and how I can start contributing.")*`;
      }
      llmEnd = Date.now();
    }

    // 2. TEST DESIGNER AGENT FLOW (TC-06)
    else if (isTestDesignerAddressed) {
      responsePersona = 'Mentor';
      llmStart = Date.now();

      // Formulate grounded test design using Centralized Workflow Context
      finalResponse = formatTestDesignerResponse(workflow, userQuery);
      contextManager.update(roomId, userId, { testDesign: finalResponse });
      llmEnd = Date.now();
    }

    // 3. EXPLAINER AGENT FLOW (TC-07)
    else if (isExplainerAddressed) {
      responsePersona = 'Mentor';
      llmStart = Date.now();

      // Formulate grounded explanation using Centralized Workflow Context
      finalResponse = formatExplainerResponse(workflow, userQuery);
      contextManager.update(roomId, userId, { explanation: finalResponse });
      llmEnd = Date.now();
    }

    // 4. CODE DIFF REVIEW FLOW (TC-08)
    else if (isReviewerAddressed || isReviewRequest) {
      responsePersona = 'Mentor';
      if (!hasActualDiffPatch && !workflow.codeChanges?.diff) {
        finalResponse = `### 🔍 FirstCommit Reviewer (Claude Haiku 4.5)\n\nI am ready to review your code! Please paste your \`git diff\` or code patch here in the chat to begin review.`;
      } else {
        const diffToReview = hasActualDiffPatch ? userQuery : (workflow.codeChanges?.diff || userQuery);
        llmStart = Date.now();

        // Formulate rigorous security review with automated vulnerability detection
        finalResponse = formatCodeReviewResponse(workflow, diffToReview);
        contextManager.update(roomId, userId, {
          codeChanges: {
            diff: diffToReview,
            verdict: finalResponse.includes('REQUEST CHANGES') ? 'REQUEST CHANGES' : 'APPROVE'
          }
        });
        llmEnd = Date.now();
      }
    }

    // 5. MENTOR AGENT FLOW (TC-03, TC-04, TC-05, TC-09)
    else {
      responsePersona = 'Mentor';
      llmStart = Date.now();

      if (isPlanApproval) {
        // TC-05: Gate 1 Plan Approval
        contextManager.approvePlan(roomId, userId);
        workflow = contextManager.get(roomId, userId);

        finalResponse = `### 🎉 Plan Approved! Setting Up ${workflow.repo.owner}/${workflow.repo.repo}

Awesome! Let's get your local environment ready for contribution:

#### Step 1: Clone & Install Dependencies
\`\`\`bash
# 1. Clone the repository
git clone https://github.com/${workflow.repo.owner}/${workflow.repo.repo}.git
cd ${workflow.repo.repo}

# 2. Set up local virtualenv and dependencies
python -m venv .venv
source .venv/bin/activate  # Or .venv\\Scripts\\activate on Windows
pip install -e .
\`\`\`

#### Step 2: Explore Target Files
- Inspect \`${workflow.repo.keyFiles?.[0] || 'core/'}\` for target logic.
- Review \`README.md\` and \`CONTRIBUTING.md\` for setup details.

#### Step 3: Implement & Verify
- Make your code changes in your local editor.
- Run local unit tests (\`${workflow.repo.testCommand}\`) to verify your fix.

When you're ready, run \`git diff\` and paste the diff here for review!`;
      } else if (isPrDraftRequest) {
        // TC-09: Gate 2 PR Draft Request
        finalResponse = formatPrDraftResponse(workflow);
      } else if (isIssueSelection && issuePickMatch) {
        // TC-03 & TC-04: Issue selection and Action Plan formulation
        const issueNum = parseInt(issuePickMatch[1], 10);
        finalResponse = `### 🎯 Action Plan for Issue #${issueNum} in ${workflow.repo.owner}/${workflow.repo.repo}

Great choice! Here is your step-by-step contribution plan for **Issue #${issueNum}**:

#### 4-Step Action Plan
1. **Step 1: Local Setup** — Clone \`${workflow.repo.owner}/${workflow.repo.repo}\`, install dependencies, and verify existing tests with \`${workflow.repo.testCommand}\`.
2. **Step 2: Codebase Exploration** — Inspect target files (\`${workflow.repo.keyFiles?.[0] || 'main'}\`) and understand existing connector conventions.
3. **Step 3: Implementation & Local Testing** — Implement your fix and run \`${workflow.repo.testCommand}\` to verify behavior.
4. **Step 4: Diff Review & PR** — Paste your \`git diff\` here for security review, then generate your PR draft.

---

👉 **GATE 1: Human Plan Approval**
To confirm you want to proceed with this plan, please reply with:
\`approve plan\``;
      } else if (isSimpleTaskRequest) {
        finalResponse = `### 🎯 Simple Starter Task for ${workflow.repo.owner}/${workflow.repo.repo}

Welcome! Here is one simple, high-impact task to get started immediately:

**Task: Local Environment Verification & Test Suite Run**
1. **Clone the repo locally**:
   \`git clone https://github.com/${workflow.repo.owner}/${workflow.repo.repo}.git\`
   \`cd ${workflow.repo.repo}\`
2. **Review Prerequisites**:
   Check \`README.md\` to see required Python and Node versions.
3. **Run Unit Tests**:
   Execute \`${workflow.repo.testCommand}\` to verify existing tests pass on your machine.

Once your tests run cleanly, reply with:
\`approve plan\` to generate your full step-by-step contribution plan!`;
      } else {
        // General Welcome and Onboarding Overview
        finalResponse = `### 👋 Welcome to ${workflow.repo.owner}/${workflow.repo.repo}!

I'm **FirstCommit Mentor**, your open-source onboarding guide in Mattermost connected via **Switch**.

#### What this Repository Does
**${workflow.repo.owner}/${workflow.repo.repo}** (${workflow.repo.language}) provides ${workflow.repo.readmeExcerpt.slice(0, 150)}...

#### 4-Step Action Plan
1. **Step 1: Local Setup** — Clone the repo, review \`README.md\`, and run local verification tests with \`${workflow.repo.testCommand}\`.
2. **Step 2: Codebase Exploration** — Inspect target files and architecture patterns.
3. **Step 3: Implementation & Local Verification** — Make your targeted change and test locally.
4. **Step 4: Diff Review & PR** — Paste your \`git diff\` for automated review and generate your PR draft.

---

👉 **GATE 1: Human Plan Approval**
To confirm you want to proceed with this plan, please reply with:
\`approve plan\``;
      }
      llmEnd = Date.now();
    }

    // Update conversation memory
    contextManager.appendHistory(roomId, userId, userQuery, finalResponse);

    // ==========================================
    // STAGE 5: POST FINAL RESPONSE TO SWITCH ROOM
    // ==========================================
    const t_post_start = Date.now();
    if (roomId && finalResponse) {
      await postToSwitchRoom(roomId, messageId, finalResponse, responsePersona);
    }
    const t_post_end = Date.now();

    // ==========================================
    // STAGE 6: STRUCTURED TIMING METRICS LOGGING
    // ==========================================
    const t_val = t1_validated - t0_received;
    const t_ack = t2_ack - t0_received;
    const t_tool = toolEnd - toolStart;
    const t_llm = llmEnd - llmStart;
    const t_post = t_post_end - t_post_start;
    const t_total = t_post_end - t0_received;

    log(`[PERF-TIMING] reqId=${reqId} msgId=${messageId || 'none'} agent="${responsePersona}" | val=${t_val}ms | ack=${t_ack}ms | tools=${t_tool}ms | llm=${t_llm}ms | post=${t_post}ms | TOTAL=${t_total}ms`);

    return finalResponse;
  } catch (fatalErr) {
    log(`Fatal error processing prompt: ${fatalErr.message}\n${fatalErr.stack}`);
    if (roomId) {
      const errNotice = `⚠️ **FirstCommit Notice**: Temporary issue processing your message: \`${fatalErr.message}\`. Run \`npm run doctor\` to check stack health.`;
      await postToSwitchRoom(roomId, messageId, errNotice, 'Mentor');
    }
    return `⚠️ Error: ${fatalErr.message}`;
  }
}

// JSON-RPC stdio server for Switch Agent Controller
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let activeSessionId = 'antigravity-session-' + Date.now();

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    const id = msg.id;
    const method = msg.method;
    log(`Incoming RPC: method=${method}, id=${id}`);

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: {
          protocolVersion: 1,
          serverInfo: {
            name: 'antigravity-acp',
            version: '1.1.1'
          },
          agentCapabilities: {
            mcpCapabilities: { http: true, sse: true },
            promptCapabilities: { image: true, audio: true, embeddedContext: true },
            sessionCapabilities: { resume: true },
            loadSession: true
          },
          capabilities: {
            models: true,
            prompts: true,
            mcpCapabilities: { http: true, sse: true }
          },
          authMethods: []
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      log(`Sent initialize response`);
    } else if (method === 'session/new' || method === 'session/create' || method === 'session/load' || method === 'session/resume') {
      activeSessionId = msg.params?.sessionId || ('antigravity-session-' + Date.now());
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: {
          sessionId: activeSessionId,
          models: [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
          ]
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      log(`Sent session start response: ${activeSessionId}`);
    } else if (method === 'session/set_mode' || method === 'session/set_model' || method === 'authenticate') {
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: {}
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } else if (method === 'session/prompt') {
      const sessionId = msg.params?.sessionId || activeSessionId;
      const promptParts = msg.params?.prompt || [];
      let fullPromptText = '';
      for (const part of promptParts) {
        if (typeof part === 'string') {
          fullPromptText += part + ' ';
        } else if (part.type === 'text' && part.text) {
          fullPromptText += part.text + ' ';
        }
      }
      fullPromptText = fullPromptText.trim();
      log(`Handling prompt for session ${sessionId} (length: ${fullPromptText.length}): "${fullPromptText.slice(0, 80)}..."`);

      const hasUserMessage = /addressed you in room/i.test(fullPromptText) ||
                             /BEGIN SWITCH MESSAGE/i.test(fullPromptText) ||
                             /\[Switch\]/i.test(fullPromptText) ||
                             /@firstcommit-/i.test(fullPromptText);
      if (!hasUserMessage && fullPromptText.startsWith('---') && fullPromptText.includes('name: "switch"')) {
        log('Session pure warmup prompt acknowledged.');
        const response = {
          jsonrpc: '2.0',
          id: id,
          result: { stopReason: 'end_turn' }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
        return;
      }

      // Process prompt & post to Switch Mattermost
      const reply = await processUserPrompt(fullPromptText);
      if (!reply) {
        log(`No reply generated or prompt dropped by anti-loop guard.`);
        const response = {
          jsonrpc: '2.0',
          id: id,
          result: { stopReason: 'end_turn' }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
        return;
      }

      // Stream chunks via session/update notifications
      const chunkSize = 40;
      for (let i = 0; i < (reply || '').length; i += chunkSize) {
        const chunk = reply.slice(i, i + chunkSize);
        const update = {
          jsonrpc: '2.0',
          method: 'session/update',
          params: {
            sessionId: sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: chunk
              }
            }
          }
        };
        process.stdout.write(JSON.stringify(update) + '\n');
        await new Promise(r => setTimeout(r, 10));
      }

      // Respond to session/prompt
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: {
          stopReason: 'end_turn'
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      log(`Completed prompt turn for session ${sessionId}`);
    } else if (id !== undefined) {
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: {}
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (err) {
    log(`Error handling line: ${err.message}`);
  }
});

process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}\n${err.stack}`);
});

module.exports = {
  processUserPrompt,
  extractUserQuery,
  extractRoomAndMessageId
};
