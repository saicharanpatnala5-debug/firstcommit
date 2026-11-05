# Flipping the Switch on Open-Source Onboarding: How We Built FirstCommit

**By Sai Charan**  
*Submitted to the Flip the Switch Hackathon (Track: Best Business Workflow)*

---

## The First-Contribution Cliff
Every software engineer remembers the feeling of wanting to contribute to open-source for the first time. You find an exciting project, clone the repo, and are immediately confronted with a wall of complexity: 50-page contribution guidelines, failing local environments, obscure issue descriptions, and the paralyzing fear of posting something foolish in front of seasoned maintainers.

At the same time, project maintainers face unprecedented burnout. They spend countless hours triaging duplicate questions, answering *"how do I set this up?"*, and politely rejecting pull requests that violate basic project formatting.

When the **Flip the Switch Hackathon** challenged us to build a workflow where humans and AI agents work together in a team chat using **Switch**, we immediately knew what we had to build: **FirstCommit**.

---

## What is FirstCommit?
FirstCommit is a multi-agent onboarding companion embedded directly into a **Mattermost** channel via **Switch**. 

Instead of struggling alone, a newcomer enters the `#first-commit` channel where a team of five specialist agents across **four frontier model families** collaborate to guide them:
1. **FirstCommit Scout (Google Gemini 2.5 Flash):** The ONLY agent equipped with GitHub tools. Queries `api.github.com`, inspects repository architecture, and surfaces high-signal beginner issues.
2. **FirstCommit Mentor (Google Gemini 2.5 Flash):** Breaks down the chosen issue and formulates a 4-step Action Plan, halting at **Gate 1** for human approval.
3. **FirstCommit Test Designer (OpenAI GPT-4o):** Proposes happy-path and edge-case test cases along with exact local `pytest` run commands as static text.
4. **FirstCommit Reviewer (Anthropic Claude Haiku 4.5):** Conducts independent, cross-model code diff reviews against the approved plan, flagging scope drift and edge cases under 200 words.
5. **FirstCommit Explainer (Meta Llama 3.3 70B):** Demystifies intimidating open-source jargon (rebase, squash, CLA) in plain English with everyday analogies.

Crucially, **the human remains the author**. The AI never touches the user's local code, never writes to GitHub, and never submits pull requests automatically.

---

## Why Switch Made This Possible
Before Switch, coordinating multiple AI agents from different model providers in an enterprise chat application required building and maintaining brittle custom WebSocket listeners, managing disparate API interfaces, and constantly restarting failed processes.

With **Switch**, the entire collaboration model flipped:
- **True Agent-Agnosticism:** Agents running on Google Gemini, OpenAI GPT-4o, Anthropic Claude, and Meta Llama interact seamlessly in one shared room without custom glue code.
- **Switch Console** runs the agent runtime locally on our machine with full lifecycle supervision.
- **The Bundled Mattermost Server** spins up in Docker with a single click, providing an instant collaborative space.
- **Room Templates (V2)** allow declarative, reproducible setup of shared context, contributor guidelines, and multi-agent kickoff greetings.

---

## Architectural Safety by Design (10/10 Proofs)
Building AI agents that handle external public data requires uncompromising security:
- **Prompt Injection Defense:** Malicious contributors or compromised repos could plant hidden instructions in READMEs or issue comments. FirstCommit wraps all external content in `<untrusted_repo_data>` boundaries, ensuring agents analyze it strictly as passive data.
- **Single Tool Surface & Zero Write Operations:** Only Scout has tools; the remaining 4 specialist agents have zero tools. The custom TypeScript MCP server exposes strictly read-only `GET` operations against `api.github.com`. It has zero capability to push code or create branches.
- **Strict Anti-Loop Constraints:** Agents only speak when addressed by name or human, make at most one hand-off per message, and never reply to peer acknowledgements.
- **In-Memory Caching:** A 10-minute cache prevents hitting GitHub rate limits during live demonstrations.
- **Automated Verification:** 10/10 unit tests and 10/10 automated safety proofs verify every invariant before code touches production.

---

## The Result
With FirstCommit, the contributor learns by doing in a safe, supportive environment. The maintainer receives clean, pre-reviewed pull requests that adhere to project guidelines. And human developers stay in complete control of their code.

That is the power of human-agent collaboration with Switch: technology that empowers people to take their first step with confidence.

---
*Explore the project, test suite, and templates on GitHub: [FirstCommit Repository](https://github.com/saicharanpatnala5-debug/firstcommit)*
