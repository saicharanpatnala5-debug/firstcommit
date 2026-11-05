# FirstCommit Demo Narration Script (Voice-Over)

> **Total Estimated Read Time:** 2 minutes 45 seconds (approx. 380 words at natural speaking pace)

---

### [0:00 - 0:20] Scene 1: The Problem & Introduction
*(Visual: `docs/demo/cards/card-01-problem.html`)*

"Every software developer remembers the feeling of wanting to make their very first open-source contribution. But over 70% of beginners abandon the attempt. Cryptic setup steps, massive codebases, and fear of negative feedback stop them in their tracks. Meanwhile, maintainers burn out triaging malformed pull requests. 

To bridge this gap, we built **FirstCommit**—an empathetic 24/7 onboarding mentor that pairs with beginners right inside their team chat."

---

### [0:20 - 0:45] Scene 2: Switch Console & Multi-Provider Architecture
*(Visual: Switch Console Window & `docs/demo/cards/card-02-switch.html`)*

"Switch is the central backbone of FirstCommit. 

Here in Switch Console, you can see our multi-agent team running together in one room: Scout and Mentor powered by Google Gemini, Test Designer on OpenAI GPT-4o, Reviewer on Anthropic Claude, and Explainer on Meta Llama. Switch automatically bridges Mattermost events over WebSockets and delivers agent responses through its local Relay API. Without Switch, this multi-provider collaboration workflow simply would not exist."

---

### [0:45 - 1:25] Scene 3: Live Discovery & Scout Intelligence (Google Gemini)
*(Visual: Mattermost `#first-commit` channel & `docs/demo/cards/card-03-discovery.html`)*

"Let’s watch the live workflow in Mattermost. As a beginner, I mention `@firstcommit-scout` with a link to `sandbox-quantum/switch`. 

Notice our least-privilege architecture: FirstCommit Scout is the only agent with GitHub MCP tools. It inspects the repo, translates over 3,890 stars and the architecture into plain English, and recommends three real beginner issues labeled 'hackathon'—then directs me to the mentor."

---

### [1:25 - 2:05] Scene 4: Action Plan & Gate 1 Human Approval (Google Gemini)
*(Visual: Mattermost `#first-commit` channel & `docs/demo/cards/card-04-gate1.html`)*

"I pick issue #842 to add an Intercom connector. The mentor analyzes the issue description and generates a 4-step Action Plan covering files to edit, reproduction steps, local tests, and pitfalls. 

Crucially, the mentor stops at **Gate 1**. It will not give me fix instructions until I explicitly confirm: `@firstcommit-mentor approve plan`. 

Once I approve, it guides me step-by-step through local testing on my machine."

---

### [2:05 - 2:40] Scene 5: Multi-Provider Collaboration & Gate 2 PR Draft
*(Visual: Mattermost `#first-commit` channel & `docs/demo/cards/card-05-gate2.html`)*

"Switch makes multi-provider collaboration effortless. I can ask `@firstcommit-test-designer`, powered by OpenAI GPT-4o, to formulate edge-case test scenarios and local pytest commands. If I get confused by git terminology, `@firstcommit-explainer`, running on Meta Llama 3.3, demystifies concepts like rebase with simple real-world analogies.

When I paste my code diff into chat, the mentor hands off to Anthropic Claude: `@firstcommit-reviewer-claude please review this diff against the approved plan.`

Claude provides an independent, cross-model second opinion against the approved plan, validating scope and suggesting tests—under 200 words with zero infinite loops.

Finally, the mentor drafts a complete PR title and Markdown description. Notice **Gate 2**: FirstCommit enforces zero automated writes to GitHub. The contributor copies the description and manually submits the pull request on GitHub, keeping the human developer in complete control."

---

### [2:40 - 3:00] Scene 6: Safety Proof & Wrap-up
*(Visual: Terminal running `npm run test:safety` & `docs/demo/cards/card-06-safety.html`)*

"Safety is enforced in code, not just prompts. Our automated test suite proves that malicious prompt injection inside READMEs is quarantined inside `<untrusted_repo_data>`, zero write tools exist, all 5 agent templates pass anti-loop and least privilege checks, and no secrets are leaked.

FirstCommit turns beginner intimidation into open-source confidence—and Switch makes it seamless. Check out the project at `github.com/saicharanpatnala5-debug/firstcommit`. Thank you!"
