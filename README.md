# FirstCommit 🚀
> **Empathetic Open-Source Contributor Onboarding inside Team Chat, Powered by Switch & Google Gemini.**

[![Flip the Switch Hackathon](https://img.shields.io/badge/Hackathon-Flip%20the%20Switch-blue.svg)](https://www.wemakedevs.org/hackathons/switch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Safety Tests](https://img.shields.io/badge/Safety%20Tests-Passing-brightgreen.svg)](#5-safety-model-and-limitations)
[![Switch Version](https://img.shields.io/badge/Switch%20Console-0.40.1-purple.svg)](https://switch.chat)

---

## 1. What FirstCommit Is

**FirstCommit** solves the "first contribution cliff": over 70% of aspiring open-source contributors abandon their first pull request due to daunting codebases, cryptic setup steps, and fear of negative feedback, while maintainers suffer burnout triaging low-quality PRs. FirstCommit pairs beginners with an encouraging, step-by-step AI onboarding mentor right inside their team chat (Mattermost via Switch). The mentor queries live GitHub data, recommends tailored beginner issues, formulates actionable plans through explicit human approval gates, reviews code diffs, and drafts clean PR descriptions.

- **Demo Video (3–5 min):** [Watch FirstCommit Demo Video on YouTube / Loom](https://youtu.be/placeholder-demo-video) *(Replace with recorded video link)*
- **FirstCommit Room in Action:**

![FirstCommit Room in Action](docs/img/room-in-action.png)

---

## 2. Why Switch Is Central

Switch is the foundational communication, event orchestration, and agent lifecycle engine of FirstCommit. Without Switch, FirstCommit ceases to function:
1. **Zero Custom Bridges:** Switch natively manages the bidirectional bridge between Mattermost (WebSocket events inbound, HTTP posts outbound) and the local agent runtime. Without Switch, the agent cannot receive chat events or post back into channels and threads.
2. **Agent Supervision & Lifecycle:** Switch Console runs, health-checks, and manages the Antigravity agent process on the host machine.
3. **Room Context & Placements:** Switch orchestrates room participants, roles, shared context, and message threads, enabling genuine human-agent pair programming.

### Message-Flow Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Contributor as Beginner Developer
    participant Mattermost as Mattermost (#first-commit)
    participant Switch as Switch Platform (Console & Relay)
    participant Agent as FirstCommit Mentor (Antigravity / Gemini)
    participant GitHubTools as Read-Only GitHub MCP Server
    participant GitHub as api.github.com

    Note over Contributor,Mattermost: 1. Onboarding & Repo Inspection
    Contributor->>Mattermost: @firstcommit-mentor I want to contribute to sandbox-quantum/switch!
    Mattermost->>Switch: Event forwarded via WebSocket
    Switch->>Agent: ACP session prompt with room context
    Agent->>GitHubTools: fetch_repo_overview & fetch_open_issues (labels: hackathon)
    GitHubTools->>GitHub: GET api.github.com (Read-only)
    GitHub-->>GitHubTools: Repo metadata & issues (stars, language, topics)
    GitHubTools-->>Agent: Quarantined data in <untrusted_repo_data>
    Agent->>Switch: post_message (ops/post_message)
    Switch-->>Mattermost: Mentor response: repo overview + 3 recommended beginner issues

    Note over Contributor,Mattermost: 2. Issue Selection & Action Plan
    Contributor->>Mattermost: @firstcommit-mentor I pick #842
    Switch->>Agent: Delivers issue selection
    Agent->>GitHubTools: fetch_issue_detail(#842)
    GitHubTools-->>Agent: Issue description & discussion
    Agent->>Switch: post_message: 4-step Action Plan + GATE 1 Prompt
    Switch-->>Mattermost: Action Plan: "Reply '@firstcommit-mentor approve plan' to proceed."

    Note over Contributor,Mattermost: GATE 1: Human Plan Approval
    Contributor->>Mattermost: @firstcommit-mentor approve plan
    Switch->>Agent: Delivers approval
    Agent->>Switch: Step-by-step local setup, reproduction commands, and test guide
    Switch-->>Mattermost: Mentor instructions: "Make changes locally and paste git diff"

    Note over Contributor,Mattermost: 3. Local Coding & Text Review
    Contributor->>Contributor: Edits code locally and runs tests on own machine
    Contributor->>Mattermost: @firstcommit-mentor here is my git diff for review: [pastes diff]
    Switch->>Agent: Delivers diff text
    Agent->>Switch: Diff text review + Drafted PR Title and Markdown Description
    Switch-->>Mattermost: GATE 2: "PR draft ready! Review and submit manually on GitHub."

    Note over Contributor,GitHub: GATE 2: Contributor Manual Submission
    Contributor->>GitHub: Contributor manually opens PR on GitHub (zero bot writes)
```

---

## 3. How Switch Is Used

### a. Agents Connected

| Name | Provider | Working Folder | Addressing | Job | Template File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `firstcommit-mentor` | **Antigravity** (Google Gemini 2.5 Flash via `agy` ACP) | `C:\Users\SAI CHARAN\Projects\FirstCommit-Agent` | `@firstcommit-mentor` | Empathetic contributor onboarding, live issue recommendation, action plan formulation, diff review, and PR description generation | [templates/firstcommit-agent.yaml](templates/firstcommit-agent.yaml) |

### b. Channel & Room Setup

- **Room Name:** `FirstCommit Room` (auto-bridged to channel `#first-commit`)
- **Chat Application:** Mattermost (bundled inside the local Switch Docker stack: `switchdash-local-mattermost-mattermost-1` on port `60922`)
- **Bridge:** Native Switch Mattermost Collaboration Bridge
- **Participants & Roles:**
  - `charan7` (Workspace Owner / Contributor)
  - `firstcommit-mentor` (AI Agent / Onboarding Mentor)
- **Kickoff Message:** `"Hey! Ping @firstcommit-mentor and I'll jump in."`
- **Native Switch Room Features Used:**
  - **Shared Context & Room Instructions:** Injected into the agent session to govern mentor personality, step-by-step teaching style, and safety boundaries.
  - **Roles:** Mentor role assigned to `firstcommit-mentor`.
  - **Decisions & Approval Gates:** Chat-based human confirmation gates preventing premature code guidance or unauthorized actions.

### c. Human Approval Gates

FirstCommit enforces two strict human-in-the-loop approval gates where execution pauses until the human explicitly confirms:

1. **Gate 1: Human Action Plan Approval**
   - **Where:** In the chat thread, immediately following the mentor's issue breakdown and proposed 4-step Action Plan.
   - **Exact Approval Phrase:** `@firstcommit-mentor approve plan` (or simply `approve plan`).
   - **Enforcement:** The mentor will **not** provide code locations, reproduction commands, or implementation steps until the contributor reviews and approves the plan.
2. **Gate 2: Contributor Manual Pull Request Submission**
   - **Where:** In the chat thread, following the contributor's pasted `git diff` and the mentor's text review.
   - **Enforcement:** FirstCommit performs **zero automated GitHub writes** (no branch creation, no commits, no automated PR submission). The agent drafts a complete PR title and Markdown description, and explicitly directs the contributor to review, copy, and submit the PR manually on GitHub.

---

## 4. How to Run It (Fresh Clone to Working Demo)

### Prerequisites with Tested Versions
- **Operating System:** Windows 11 / 10 (or macOS / Linux)
- **Docker Desktop:** Version 27.0+ (running locally for bundled Mattermost)
- **Switch Console:** Version `0.40.1` ([Download Switch Console](https://switch.chat))
- **Node.js:** Version 20+ (tested on Node v26.8.1 and v20.12.0)
- **Google Antigravity / Gemini:** `agy` CLI installed and signed in, or an OpenRouter Gemini API key.

---

### Step-by-Step Setup Guide

#### 1. Clone the Repository & Build MCP Tools
Open PowerShell and run:
```powershell
git clone https://github.com/saicharanpatnala/FirstCommit.git
cd FirstCommit\mcp-server
npm install
npm run build
```
*Expected Result:* Dependencies install cleanly and `dist/index.js` + `dist/github.js` are created without TypeScript errors.

#### 2. Run Automated Verification Tests
```powershell
# 1. Run Unit Tests (10/10 tests passing with mocked responses)
npm test

# 2. Run Live Smoke Test (fetches real public repo metadata from sandbox-quantum/switch)
npm run test:smoke

# 3. Run Safety Proof Tests (prompt injection, zero-write validation, secrets scan)
npm run test:safety
```
*Expected Result:* All test suites exit with code 0 (`PASS`).

#### 3. Environment Configuration
Copy the `.env.example` file:
```powershell
cd ..
cp .env.example .env
```
**`.env.example` Parameters Explained:**
- `GITHUB_TOKEN`: *(Optional)* Fine-grained read-only GitHub personal access token (`Public Repositories (read-only)`). Without a token, GitHub limits unauthenticated requests to 60/hr; with a token, the limit increases to 5,000/hr.
- `OPENROUTER_API_KEY`: *(Optional)* API key for Google Gemini 2.5 Flash inference.

#### 4. Launch Switch Console & Mattermost
1. Open **Switch Console** desktop application.
2. Navigate to **Settings -> Agent Providers** and confirm **Antigravity** is marked as `Signed in` / `Installed`.
3. In Switch Console, click **Start Server** on the local server card (or verify Docker container `switchdash-local-mattermost-mattermost-1` is running).
4. Click **Connectors -> Mattermost** and verify the connection is active.
5. In Switch Console, navigate to **Agents**, click **+ New Agent**, select **From Template**, and select `templates/firstcommit-agent.yaml`.
6. Navigate to **Rooms**, select the bridged `#first-commit` channel, and ensure `firstcommit-mentor` is added to the room.

---

### Verifying Success

1. Open Mattermost in your browser at `http://localhost:60922` (or your configured Mattermost port).
2. Go to channel `#first-commit`.
3. Send the onboarding prompt:
   ```text
   @firstcommit-mentor Hello! I want to contribute to https://github.com/sandbox-quantum/switch. I have basic TypeScript knowledge. Can you guide me?
   ```
4. **Expected Reply:**
   The bot responds within seconds, warmly acknowledging your skill level, describing the `sandbox-quantum/switch` repository using real GitHub metadata (stars, language, topics), and presenting 3 real open beginner issues (e.g., `#842 Add the Intercom connector`).

---

### Troubleshooting We Hit and Resolved

| Problem Hit | Root Cause | Solution Applied |
| :--- | :--- | :--- |
| **Switch Console showed Antigravity as "Not installed"** | Windows GUI processes do not inherit environment variable changes from existing terminal sessions. | Completely quit Switch Console from system tray/taskbar and relaunch it after adding `agy` to User PATH. |
| **Bot replied `**Worked for Xs.**` with no text** | The session turn completion card was updating, but room messages in Switch must be dispatched via `post_message`. | Configured the ACP adapter to invoke Switch's embedded Relay API (`POST /agents/{agentId}/ops/post_message`) with the active room placement session header `x-switch-session-id`. |
| **`thread_id not found in room` error** | Attempting to reply to an unindexed message ID. | Added automatic fallback in `antigravity-acp.js` to post as a top-level channel message if thread normalization fails. |
| **Unit test blocked absolute URLs** | `fetchGitHub` formed URL via `https://api.github.com/${path}`, allowing an absolute path like `/https://evil.com`. | Added strict URL parsing in `github.ts` that rejects any input containing `://` or protocol prefixes. |

**Tested on:** Windows 11 Pro, November 5, 2026.

---

## 5. Safety Model and Limitations

### What Is Enforced in Code & Configuration
1. **Network Boundary:** The GitHub client strictly validates destinations; all requests must target `https://api.github.com`. Non-GitHub hostnames, redirects, and arbitrary web fetches are hard-rejected.
2. **Zero Write Operations:** The MCP client interface contains **only GET methods**. No write verbs (`POST`, `PUT`, `DELETE`, `PATCH`), no Git CLI execution, and no branch or PR mutation tools exist in the codebase.
3. **Prompt Injection Quarantine:** Untrusted repository contents (README files, issue descriptions, user diffs) are wrapped inside `<untrusted_repo_data>` blocks with system-level quarantine instructions to prevent prompt injection attacks.
4. **Leak-Proof Secrets:** All sensitive credentials are kept in gitignored local files. Automated safety tests scan for token leaks in logs, mock fixtures, and template files.
5. **Rate-Limit & Truncation Guards:** Responses from GitHub are cached in-memory for 10 minutes and capped at 30,000 characters to prevent buffer overflow and token exhaustion.

### Limitations (MVP Scope)
- **Public Repositories Only:** Private repository support requires authenticated GitHub OAuth integration, which is omitted in the MVP to minimize credential exposure.
- **Manual PR Submission:** The contributor must manually open GitHub to paste the drafted PR description. Automated PR submission is deliberately unsupported to keep the human in total control.

---

## 6. Hackathon Info & Evaluation Criteria Mapping

- **Track:** **Best Business Workflow** (+ Best Blog post side track)
- **Official Evaluation Criteria Alignment:**

### 1. Use of Switch (30%)
Switch is the central architectural pillar. Switch coordinates the real-time collaboration between the human contributor and the AI mentor across Mattermost. Without Switch's agent controller, room bridging, and relay API, FirstCommit cannot operate.

### 2. Technical Execution (25%)
- Fully tested TypeScript codebase with 10 unit tests, live smoke tests, and prompt injection safety suites.
- Production-ready Docker + Switch Console local setup reproducible in under 10 minutes.
- Clean separation between presentation (Mattermost), orchestration (Switch), cognition (Gemini), and data (GitHub MCP).

### 3. Creativity & Impact (25%)
FirstCommit addresses a universal pain point in open source: bridging the gap for first-time contributors while eliminating maintainer burnout caused by poorly formatted PRs. By pairing automated guidance with human approval gates, it creates a sustainable onboarding pipeline.

### 4. Presentation (20%)
- Comprehensive, reproducible [README.md](README.md) answering all four judging criteria upfront.
- Architectural sequence diagram and step-by-step demo video script.
- Accompanying submission article in [BLOG_POST.md](BLOG_POST.md).

---

## 📸 Screenshots & Artifacts Checklist

Save your demo screenshots under `docs/img/`:
- `docs/img/room-in-action.png`: Full Mattermost `#first-commit` channel showing the conversation.
- `docs/img/gate1-plan-approval.png`: Chat view showing the proposed Action Plan and Gate 1 approval.
- `docs/img/gate2-pr-draft.png`: Chat view showing the diff review and drafted PR description.
- `docs/img/switch-console-status.png`: Switch Console displaying connected agents and local server health.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
