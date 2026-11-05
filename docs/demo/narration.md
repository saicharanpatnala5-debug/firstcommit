# FirstCommit Demo Narration Script (Voice-Over)

> **Total Estimated Read Time:** 2 minutes 45 seconds (approx. 380 words at natural speaking pace)

---

### [0:00 - 0:20] Scene 1: The Problem & Introduction
*(Visual: `docs/demo/cards/card-01-problem.html`)*

"Every software developer remembers the feeling of wanting to make their very first open-source contribution. But over 70% of beginners abandon the attempt. Cryptic setup steps, massive codebases, and fear of negative feedback stop them in their tracks. Meanwhile, maintainers burn out triaging malformed pull requests. 

To bridge this gap, we built **FirstCommit**—an empathetic 24/7 onboarding mentor that pairs with beginners right inside their team chat."

---

### [0:20 - 0:45] Scene 2: Switch Console & Centrality
*(Visual: Switch Console Window & `docs/demo/cards/card-02-switch.html`)*

"Switch is the central backbone of FirstCommit. 

Here in Switch Console, you can see `firstcommit-mentor` running natively with the Antigravity provider. Switch automatically bridges Mattermost events over WebSockets and delivers agent responses through its local Relay API. Without Switch, this human-agent pair programming workflow simply would not exist."

---

### [0:45 - 1:30] Scene 3: Live Discovery & Real Issues
*(Visual: Mattermost `#first-commit` channel & `docs/demo/cards/card-03-discovery.html`)*

"Let’s watch the live workflow in Mattermost. As a beginner, I mention `@firstcommit-mentor` with a link to `sandbox-quantum/switch`. 

Notice: FirstCommit immediately calls our custom read-only GitHub MCP server. It pulls live repository metadata—translating over 3,800 stars and the architecture into plain English—and recommends three real, open beginner issues labeled 'hackathon'."

---

### [1:30 - 2:15] Scene 4: Action Plan & Gate 1 Human Approval
*(Visual: Mattermost `#first-commit` channel & `docs/demo/cards/card-04-gate1.html`)*

"I pick issue #842 to add an Intercom connector. The mentor analyzes the issue description and generates a 4-step Action Plan covering files to edit, reproduction steps, local tests, and pitfalls. 

Crucially, the mentor stops at **Gate 1**. It will not give me fix instructions until I explicitly confirm: `@firstcommit-mentor approve plan`. 

Once I approve, it guides me step-by-step through local testing on my machine."

---

### [2:15 - 2:40] Scene 5: Two-Agent Hand-off & Gate 2 PR Draft
*(Visual: Mattermost `#first-commit` channel & `docs/demo/cards/card-05-gate2.html`)*

"After editing the code locally, I paste my `git diff` into the chat. Notice Switch's multi-agent coordination: the mentor hands off to our second agent by name: `@firstcommit-reviewer please review this diff against the approved plan.`

FirstCommit Reviewer reads the approved plan from Switch's shared room history, validates the diff as text, and gives a crisp verdict with suggested local tests—all under 200 words with zero infinite loops.

When I'm ready, the mentor drafts a complete Pull Request title and Markdown description. Notice **Gate 2**: FirstCommit enforces zero automated writes to GitHub. The contributor copies the description and manually submits the pull request on GitHub, keeping the human developer in complete control."

---

### [2:40 - 3:00] Scene 6: Safety Proof & Wrap-up
*(Visual: Terminal running `npm run test:safety` & `docs/demo/cards/card-06-safety.html`)*

"Safety is enforced in code, not just prompts. Our automated test suite proves that malicious prompt injection inside READMEs is quarantined inside `<untrusted_repo_data>`, zero write tools exist, and no secrets are leaked.

FirstCommit turns beginner intimidation into open-source confidence—and Switch makes it seamless. Check out the project at `github.com/saicharanpatnala5-debug/firstcommit`. Thank you!"
