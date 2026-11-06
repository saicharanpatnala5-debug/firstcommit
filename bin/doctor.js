const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🩺 FirstCommit System Diagnostics & Health Check');
console.log('====================================================\n');

let allPassed = true;

function check(label, fn) {
  try {
    const result = fn();
    if (result === true || (result && result.pass)) {
      console.log(`[PASS] ${label}${result.detail ? ' — ' + result.detail : ''}`);
    } else {
      allPassed = false;
      console.log(`[FAIL] ${label}${result && result.detail ? ' — ' + result.detail : ''}`);
    }
  } catch (err) {
    allPassed = false;
    console.log(`[FAIL] ${label} — Error: ${err.message}`);
  }
}

async function asyncCheck(label, fn) {
  try {
    const result = await fn();
    if (result === true || (result && result.pass)) {
      console.log(`[PASS] ${label}${result.detail ? ' — ' + result.detail : ''}`);
    } else {
      allPassed = false;
      console.log(`[FAIL] ${label}${result && result.detail ? ' — ' + result.detail : ''}`);
    }
  } catch (err) {
    allPassed = false;
    console.log(`[FAIL] ${label} — Error: ${err.message}`);
  }
}

function checkDocker() {
  try {
    const out = execSync('docker ps --filter "name=switchdash-local-mattermost" --format "{{.Status}}"', { encoding: 'utf8', timeout: 5000 });
    if (out.trim().includes('Up')) {
      return { pass: true, detail: `Container running (${out.trim()})` };
    }
    return { pass: false, detail: 'Mattermost container is not running' };
  } catch (e) {
    return { pass: false, detail: 'Docker daemon unreachable' };
  }
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve({ pass: true, detail: `Port ${port} is open and listening` });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ pass: false, detail: `Connection to ${host}:${port} timed out` });
    });
    socket.on('error', (e) => {
      socket.destroy();
      resolve({ pass: false, detail: `Connection to ${host}:${port} refused (${e.message})` });
    });
    socket.connect(port, host);
  });
}

function checkHttp(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.get(u, { timeout: 3000 }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ pass: true, detail: `HTTP ${res.statusCode} OK` });
        } else {
          resolve({ pass: false, detail: `HTTP ${res.statusCode}` });
        }
      });
      req.on('error', (e) => resolve({ pass: false, detail: e.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ pass: false, detail: 'Request timed out' });
      });
    } catch (e) {
      resolve({ pass: false, detail: e.message });
    }
  });
}

async function checkSwitchApi() {
  const switchBase = path.join(process.env.APPDATA || '', 'switchdash', 'agent-controller', 'servers');
  if (!fs.existsSync(switchBase)) {
    return { pass: false, detail: 'Switch directory not found' };
  }
  let agentId = '';
  let token = '';
  let sessionId = '';
  let endpoint = 'http://127.0.0.1:63242';
  const targetRoomId = 'cce26d68-29c4-4c6c-9702-6b42f3ed5f61';

  for (const sDir of fs.readdirSync(switchBase)) {
    const fullServer = path.join(switchBase, sDir);
    const watchersDir = path.join(fullServer, 'watchers');
    if (fs.existsSync(watchersDir)) {
      for (const aDir of fs.readdirSync(watchersDir)) {
        const placePath = path.join(watchersDir, aDir, 'placements.json');
        if (fs.existsSync(placePath)) {
          const p = JSON.parse(fs.readFileSync(placePath, 'utf8'));
          for (const [sId, rId] of Object.entries(p.placements || {})) {
            if (rId === targetRoomId) {
              agentId = aDir;
              sessionId = sId;
              break;
            }
          }
        }
        if (sessionId) break;
      }
    }
    if (agentId) {
      const credPath = path.join(fullServer, 'agents', agentId, 'credentials.json');
      if (fs.existsSync(credPath)) {
        const c = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        token = c.env?.SWITCH_API_TOKEN || token;
        endpoint = c.env?.SWITCH_API_ENDPOINT || endpoint;
      }
      break;
    }
  }

  if (!endpoint) {
    const envPath = path.join(process.env.APPDATA || '', 'switchdash', 'local-switch-server', 'native', 'run', 'switch-core.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const m = envContent.match(/SERVER_PORT=(\d+)/);
      if (m && m[1]) {
        endpoint = `http://127.0.0.1:${m[1]}`;
      }
    }
  }

  if (!token) return { pass: false, detail: 'Switch API token not found' };

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    if (sessionId) {
      headers['x-switch-session-id'] = sessionId;
    }
    const res = await fetch(`${endpoint}/agents/${agentId}/ops/connect_to_room`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ room_id: targetRoomId, include_general_instructions: false })
    });
    if (res.ok) {
      return { pass: true, detail: 'Switch API bridge connected to room successfully' };
    }
    const errText = await res.text();
    if (res.status === 409 && errText.includes('managed_by_controller')) {
      return { pass: true, detail: 'Switch API active (agent managed by controller)' };
    }
    return { pass: false, detail: `Switch API error ${res.status}: ${errText.slice(0, 80)}` };
  } catch (e) {
    return { pass: false, detail: `Switch API unreachable (${e.message})` };
  }
}

async function checkGitHub() {
  return new Promise((resolve) => {
    const req = https.get('https://api.github.com/zen', {
      headers: { 'User-Agent': 'FirstCommit-Doctor/1.0' },
      timeout: 4000
    }, (res) => {
      const remaining = res.headers['x-ratelimit-remaining'] || 'N/A';
      if (res.statusCode === 200) {
        resolve({ pass: true, detail: `GitHub API reachable (Rate limit remaining: ${remaining})` });
      } else {
        resolve({ pass: false, detail: `GitHub returned status ${res.statusCode}` });
      }
    });
    req.on('error', (e) => resolve({ pass: false, detail: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ pass: false, detail: 'Timeout reaching GitHub' }); });
  });
}

function checkOpenRouterKey() {
  const possiblePaths = [
    path.join(__dirname, '..', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.env.USERPROFILE || '', 'Projects', 'FirstCommit', '.env')
  ];
  let key = process.env.OPENROUTER_API_KEY || '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const m = content.match(/^\s*OPENROUTER_API_KEY\s*=\s*([^\s#]+)/m);
      if (m) {
        key = m[1].replace(/["']/g, '').trim();
        break;
      }
    }
  }
  if (key && key.startsWith('sk-or-')) {
    return { pass: true, detail: `Key configured (${key.slice(0, 10)}...)` };
  }
  return { pass: false, detail: 'OPENROUTER_API_KEY missing or invalid in .env' };
}

function checkAcpProcess() {
  try {
    const out = execSync('Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id', { shell: 'powershell.exe', encoding: 'utf8' });
    const pids = out.trim().split(/\r?\n/).filter(Boolean);
    if (pids.length > 0) {
      return { pass: true, detail: `Node agent process active (PIDs: ${pids.join(', ')})` };
    }
    return { pass: false, detail: 'No node ACP process currently running' };
  } catch (e) {
    return { pass: false, detail: 'Failed to inspect processes' };
  }
}

async function run() {
  check('1. Docker & Mattermost Container', checkDocker);
  await asyncCheck('2. PostgreSQL Port (60923)', () => checkPort(60923));
  await asyncCheck('3. Mattermost HTTP Endpoint (60922)', () => checkHttp('http://127.0.0.1:60922'));
  await asyncCheck('4. Switch Platform API & Room Bridge', checkSwitchApi);
  check('5. AI Provider API Key (OpenRouter / Gemini)', checkOpenRouterKey);
  check('6. ACP Background Agent Process', checkAcpProcess);
  await asyncCheck('7. Public GitHub API Reachability', checkGitHub);

  console.log('\n----------------------------------------------------');
  if (allPassed) {
    console.log('✅ ALL SYSTEMS OPERATIONAL: FirstCommit is ready for Hackathon demo!');
  } else {
    console.log('⚠️ ONE OR MORE CHECKS FAILED: See details above for troubleshooting.');
  }
  console.log('----------------------------------------------------');
  process.exit(allPassed ? 0 : 1);
}

run();
