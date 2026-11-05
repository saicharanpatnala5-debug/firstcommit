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
FirstCommit is an empathetic, 24/7 contribution mentor embedded directly into a **Mattermost** channel via **Switch**. 

Instead of struggling alone, a newcomer enters the `#first-commit` channel, tags `@firstcommit-mentor`, and shares a public repository URL and their experience level. FirstCommit:
1. Translates the project's architecture and `CONTRIBUTING.md` into plain English.
2. Queries the GitHub API for verified, open beginner issues (`good first issue`, `help wanted`).
3. Formulates a 4-step Action Plan for the selected issue.
4. Pauses for **Human Plan Approval** before guiding the fix step by step.
5. Performs a gentle pre-submission review of the contributor's code diff and drafts a verified Pull Request description for manual submission.

Crucially, **the human remains the author**. The AI never touches the user's local code, never writes to GitHub, and never submits pull requests automatically.

---

## Why Switch Made This Possible
Before Switch, bridging an AI agent into an enterprise chat application required building and maintaining brittle custom WebSocket listeners, managing authentication tokens, and constantly restarting failed processes.

With **Switch**, the entire collaboration model flipped:
- **Switch Console** runs the agent runtime locally on our machine.
- The built-in **Antigravity / Gemini** agent provider connects directly without custom networking boilerplate.
- The **Bundled Mattermost Server** spins up in Docker with a single click, providing an instant collaborative space.
- Switch's **Room Templates** allow declarative setup of shared context, contributor guidelines, and kickoff greetings.

---

## Architectural Safety by Design
Building AI agents that handle external public data requires uncompromising security:
- **Prompt Injection Defense:** Malicious contributors or compromised repos could plant hidden instructions in READMEs or issue comments. FirstCommit wraps all external content in `<untrusted_repo_data>` boundaries, ensuring Gemini analyzes it strictly as passive data.
- **Zero Write Operations:** The custom TypeScript MCP server exposes strictly `GET` operations against `api.github.com`. It has zero capability to push code or create branches.
- **In-Memory Caching:** A 10-minute cache prevents hitting GitHub rate limits during live demonstrations.

---

## The Result
With FirstCommit, the contributor learns by doing in a safe, supportive environment. The maintainer receives clean, pre-reviewed pull requests that adhere to project guidelines. And human developers stay in complete control of their code.

That is the power of human-agent collaboration with Switch: technology that empowers people to take their first step with confidence.

---
*Explore the project, test suite, and templates on GitHub: [FirstCommit Repository](https://github.com/saicharanpatnala/FirstCommit)*
