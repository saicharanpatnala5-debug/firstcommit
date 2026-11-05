# FirstCommit — 3-Minute Demo Video Script & Timed Shot List

> **Target Duration:** 3 minutes (180 seconds)  
> **Speaker:** Solo developer (Sai Charan)  
> **Audience:** Judges of the *Flip the Switch Hackathon* (WeMakeDevs & SandboxAQ)  
> **Core Message:** *"Switch is the backbone that enables AI agents and humans to collaborate safely inside real chat tools, turning intimidating open-source repositories into confident first pull requests."*

---

## Timed Shot List

| Time | Scene / Visual | Narration / Action |
| :--- | :--- | :--- |
| **0:00 - 0:25** (25s) | **The Hook & Problem**<br>• Show slides / web browser on GitHub | *"Every year, thousands of developers abandon their dream of contributing to open source because of the 'first-contribution cliff'—daunting codebases, cryptic setup steps, and fear of negative feedback. Meanwhile, maintainers burn out triaging malformed pull requests. To solve this, I built **FirstCommit**—a 24/7 empathetic onboarding mentor that lives right inside Mattermost, powered by Switch and Google Gemini."* |
| **0:25 - 0:50** (25s) | **Switch Console & Centrality**<br>• Switch Console desktop window<br>• Show connected agent: `firstcommit-mentor`<br>• Show local Mattermost server running | *"Switch is central to FirstCommit. Here in **Switch Console**, you can see `firstcommit-mentor` running locally with the Antigravity provider. Switch automatically bridges Mattermost events over WebSockets and routes agent responses via its local Relay API without us writing any custom network bridges. Without Switch, this entire workflow would stop working."* |
| **0:50 - 1:25** (35s) | **Stage 1: Live Discovery & Issues**<br>• Switch to Mattermost `#first-commit`<br>• Send `@firstcommit-mentor I want to contribute to sandbox-quantum/switch...` | *"Let's jump into Mattermost. As a beginner, I mention `@firstcommit-mentor` with a repo link. Watch: the mentor uses our custom read-only GitHub MCP server to inspect the repository live. It fetches real stars—over 3,865—and recommends three real, open hackathon beginner issues, suggesting issue #842 for Intercom."* |
| **1:25 - 1:55** (30s) | **Stage 2: Action Plan & Gate 1 Approval**<br>• Send: `@firstcommit-mentor I pick #842`<br>• Show 4-step Action Plan<br>• Send: `@firstcommit-mentor approve plan` | *"I pick issue #842. The mentor deep-dives into the issue description, explains the connector pattern, and outlines a 4-step Action Plan. But notice: it **stops** and demands explicit human approval—**Gate 1**. Only when I type `@firstcommit-mentor approve plan` does it proceed to give me reproduction commands and local testing guidance."* |
| **1:55 - 2:30** (35s) | **Stage 3: Diff Review & Gate 2 Manual PR**<br>• Paste a git diff into Mattermost<br>• Show mentor review and PR draft | *"I make the fix locally on my own machine and paste my `git diff` into chat. The mentor performs a gentle text review, confirms the connector methods, and generates a production-ready Pull Request title and Markdown description. Notice **Gate 2**: the mentor enforces zero automated GitHub writes—it instructs me to review and submit the PR manually on GitHub."* |
| **2:30 - 2:50** (20s) | **Safety Proof: Prompt Injection Quarantined**<br>• Terminal running `npm run test:safety`<br>• Show malicious README injection test | *"Safety is enforced in code, not just prompts. Running `npm run test:safety` proves that malicious instructions hidden in repo text are quarantined inside `<untrusted_repo_data>` and rejected, zero write operations exist, and no secrets are leaked."* |
| **2:50 - 3:00** (10s) | **Closing & Switch Pitch**<br>• Back to Mattermost `#first-commit` | *"FirstCommit turns first-time contributors into confident open-source builders. And Switch made it all possible with native chat bridging and agent orchestration. Thank you!"* |

---

## Recording Tips for the Presenter
1. **Screen Resolution:** 1080p (1920x1080) at 100% or 125% Windows scaling.
2. **Audio:** Clear microphone, quiet room.
3. **Tools to Record:** Windows Snipping Tool (Win + Shift + R), OBS Studio, or Loom.
4. **Fallback:** If live GitHub API or OpenRouter latency occurs, refer to the already recorded outputs in `#first-commit` channel history shown in the window.
