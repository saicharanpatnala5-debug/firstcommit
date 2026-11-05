# FirstCommit — Complete Demo Recording Script

> **Maximum Target Duration:** 3:00  
> **Resolution:** 1080p (1920x1080), browser zoomed to ~125% for high readability  
> **Precondition:** Docker is running, Switch Console is open, and Mattermost is reachable at `http://localhost:60922`

---

## Timed Scene-by-Scene Script

### Scene 1 [0:00 - 0:20] The Problem
- **Visual:** Open `docs/demo/cards/card-01-problem.html` in browser full-screen (F11).
- **Duration:** 20 seconds.
- **Switch Point Proved:** Frames the business workflow problem: solving the "first contribution cliff" for junior developers while saving maintainers from burnout.

---

### Scene 2 [0:20 - 0:45] Switch Console & Centrality
- **Visual:** Show **Switch Console** window on desktop (Agents list showing `firstcommit-mentor`, local server status green), then show `docs/demo/cards/card-02-switch.html`.
- **Duration:** 25 seconds (Switch is prominently visible before 0:45).
- **Switch Point Proved:** Switch is the central operational backbone. Without Switch's agent lifecycle manager, WebSocket room bridge, and Relay API, the agent has no presence in team chat.

---

### Scene 3 [0:45 - 1:30] Live Discovery & Scout Intelligence
- **Visual:** Mattermost browser window (`http://localhost:60922/charan7/channels/first-commit`). Zoomed to 125%.
- **Action (Exact Message to Type):**
  ```text
  @firstcommit-scout inspect https://github.com/sandbox-quantum/switch. I have basic TypeScript knowledge.
  ```
- **Expected Scout Reply:**
  - Explains `sandbox-quantum/switch` using live GitHub metadata (over 3,890 stars, Python).
  - Presents 3 real open beginner issues:
    1. `#842: Add the Intercom connector` *(recommended easy)*
    2. `#843: Add the Zendesk connector`
    3. `#841: Add the BigQuery connector`
  - Concludes with hand-off direction:
    `"👉 Mention @firstcommit-mentor with your chosen issue (e.g. '@firstcommit-mentor I pick #842') to build your action plan!"`
- **Switch Point Proved:** Least privilege in action: Scout is the ONLY agent with GitHub MCP tools, querying live data and posting findings to the shared room.

---

### Scene 4 [1:30 - 2:15] Issue Deep Dive & GATE 1 Plan Approval
- **Visual:** Same Mattermost thread.
- **Action 1 (Exact Message to Type):**
  ```text
  @firstcommit-mentor I pick #842
  ```
- **Expected Agent Reply:**
  - Breaks down issue `#842 (Add the Intercom connector)` in beginner-friendly terms.
  - Outlines 4-step Action Plan (file location `connections/catalog/intercom/`, local reproduction, test commands, pitfalls).
  - **Pauses at GATE 1**: Requests explicit approval before giving code guidance:
    `"Reply '@firstcommit-mentor approve plan' to proceed."`
- **Action 2 (Gate 1 Approval Message to Type):**
  ```text
  @firstcommit-mentor approve plan
  ```
- **Expected Agent Reply:**
  - Celebrates approval!
  - Gives reproduction steps and local test commands (`pytest tests/connectors/`).
  - Instructs contributor to make changes and paste their `git diff`.
- **Switch Point Proved:** Human-in-the-loop pair programming with an explicit chat approval gate.

---

### Scene 5 [2:15 - 2:45] Two-Agent Hand-off, Diff Review & GATE 2 PR Draft
- **Visual:** Same Mattermost thread.
- **Action 1 (Contributor pastes diff to Mentor):**
  ```text
  @firstcommit-mentor here is my git diff for review:
  ```
  *(Paste the following diff snippet)*:
  ```diff
  diff --git a/core/switch_core/connections/catalog/intercom/connector.py b/core/switch_core/connections/catalog/intercom/connector.py
  new file mode 100644
  index 0000000..f28b491
  --- /dev/null
  +++ b/core/switch_core/connections/catalog/intercom/connector.py
  @@ -0,0 +1,15 @@
  +"""Intercom connector implementation for Switch."""
  +from switch_core.connections.contract import BaseConnector
  +
  +class IntercomConnector(BaseConnector):
  +    id = "intercom"
  +    name = "Intercom"
  +    description = "Intercom messaging connector"
  +
  +    async def test_connection(self) -> bool:
  +        return True
  ```
- **Expected Mentor Reply (Hand-off by Name):**
  `@firstcommit-reviewer please review this diff against the approved plan.`
- **Expected Reviewer Reply (Static Review & Suggested Tests):**
  - **Verdict:** `looks good`
  - **Observations:** Confirms scope matches the approved plan, notes clean typing and zero out-of-scope edits.
  - **Suggested Tests:** Suggests running `pytest tests/connectors/test_intercom.py -v`.
  - Stays under 200 words and stops (no agent ping-pong loop).
- **Action 2 (Contributor requests PR draft):**
  ```text
  @firstcommit-mentor draft my PR description
  ```
- **Expected Mentor Reply (GATE 2 PR Draft):**
  - Generates ready-to-use Pull Request Title: `feat(connectors): add Intercom connector implementation (#842)`.
  - Generates ready-to-use Markdown PR description.
  - **GATE 2**: Instructs the contributor to copy and submit manually on GitHub (enforcing zero automated bot writes).
- **Switch Point Proved:** Multi-agent collaboration in one room: Switch routes the hand-off between Mentor and Reviewer by name, while shared room history provides instant context without custom plumbing.

---

### Scene 6 [2:40 - 3:00] Safety Proof & Closing
- **Visual:** Terminal running `npm run test:safety` in `FirstCommit/mcp-server`, followed by `docs/demo/cards/card-07-disclosure.html`.
- **Action:** Run `npm run test:safety` in terminal to show 5/5 passing safety tests (injection fixture quarantined, zero writes, zero secret leaks).
- **Closing Card:** Show `card-07-disclosure.html` with project URL.
- **Switch Point Proved:** Rigorous safety model and reproducibility.
