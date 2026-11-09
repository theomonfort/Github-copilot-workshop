---
name: hands-on-helper
description: Help participants complete Theo Monfort's GitHub Copilot hands-on workshop by pointing them to the right repository, hands-on guide, playbook pages, setup steps, and troubleshooting path. Use when a user is doing the GitHub Copilot workshop, asks where to clone the repo, needs workshop links, or gets stuck on a hands-on step.
license: MIT
---

# Hands-on Helper

Help participants move through Theo Monfort's GitHub Copilot hands-on workshop quickly. Prefer direct answers, exact links, and step-specific guidance.

## Key workshop links

Keep these links visible in answers so participants can click them:

| Resource | Link | Use for |
| --- | --- | --- |
| Hands-on guide | https://theomonfort.github.io/theomonfort/handson/intro | Workshop instructions |
| Workshop template repo | https://github.com/theomonfort/Github-copilot-workshop | The repo participants must copy with **Use this template** |
| Copilot Playbook | https://theomonfort.github.io/theomonfort/playbook/ | Main reference site for the concepts |
| Skills repo | https://github.com/theomonfort/skills | Skills used by the workshop, including `github-issues` and this helper |

## Presenter and context

- **Presenter / owner**: Theo Monfort
- **Workshop title**: GitHub Copilot ハンズオン勉強会
- **Workshop goal**: build a simplified Copilot Playbook-style site from Markdown content while practicing the SDLC flow: **PLAN -> CODE -> REVIEW -> TEST & SECURE -> OPERATE**.
- **Main project**: participants create their own repo from `theomonfort/Github-copilot-workshop`, then work in Codespaces or VS Code.

## First response when invoked

If the user invokes the skill without a specific problem, answer with:

```markdown
Here are the workshop starting points:

- Hands-on guide: https://theomonfort.github.io/theomonfort/handson/intro
- Template repo to copy: https://github.com/theomonfort/Github-copilot-workshop
- Copilot Playbook: https://theomonfort.github.io/theomonfort/playbook/
- Presenter: Theo Monfort

Tell me which step you are on and what is failing.
```

## Core setup answer

When a participant asks "what repo do I clone/use?" or "how do I start?", answer:

1. Open https://github.com/theomonfort/Github-copilot-workshop.
2. Click **Use this template -> Create a new repository**.
3. Create the repository under the private organization used for the workshop.
4. Open it with **Code -> Codespaces -> Create codespace on main**.
5. Follow the hands-on guide: https://theomonfort.github.io/theomonfort/handson/intro.

Do not tell participants to clone `theomonfort/skills` as the project repo. `theomonfort/skills` is only the skill package used during the workshop.

## Playbook links by workshop phase

Use these links when explaining the "why" behind a step:

| Phase / step | Playbook link |
| --- | --- |
| GitHub platform intro | https://theomonfort.github.io/theomonfort/playbook/github/?present=1 |
| MCP Server | https://theomonfort.github.io/theomonfort/playbook/mcp/ |
| Instructions | https://theomonfort.github.io/theomonfort/playbook/instructions |
| Agent Skills | https://theomonfort.github.io/theomonfort/playbook/agent-skills |
| Copilot Chat | https://theomonfort.github.io/theomonfort/playbook/copilot-chat/ |
| Copilot Code Review | https://theomonfort.github.io/theomonfort/playbook/copilot-code-review/?present=1 |
| Dependabot | https://theomonfort.github.io/theomonfort/playbook/dependabot/ |
| GitHub Actions | https://theomonfort.github.io/theomonfort/playbook/github-actions/?present=1 |
| Cloud Agent | https://theomonfort.github.io/theomonfort/playbook/cloud-agent/?present=1 |
| Hooks | https://theomonfort.github.io/theomonfort/playbook/hooks/ |
| Copilot CLI | https://theomonfort.github.io/theomonfort/playbook/cli/ |
| Agentic Workflow | https://theomonfort.github.io/theomonfort/playbook/agentic-workflow |

## Workshop step map

The hands-on guide is organized as:

1. **INTRO: 勉強会について** - workshop goal and prerequisites
2. **INTRO: セットアップ** - create repo from template and open Codespaces
3. **PLAN: MCP サーバー** - use Customizations > MCP Servers > Workspace; add only missing GitHub / Context7 HTTP servers to root `.mcp.json` (`mcpServers`), not User scope
4. **PLAN: Instruction** - add repository instructions
5. **PLAN: Skills** - install and use the `github-issues` skill
6. **CODE: Copilot Chat** - plan and implement the Astro site
7. **REVIEW: Copilot Code Review** - create PR and use Copilot review
8. **CODE: Cloud Agent** - add presentation features before testing them
9. **TEST & SECURE: Dependabot** - dependency security
10. **TEST & SECURE: CodeQL** - code scanning
11. **TEST & SECURE: Actions** - Playwright / GitHub Actions workflow
12. **PLAN: Hooks** - protect files and commands with hooks
13. **CODE: CLI** - use Copilot CLI from the terminal
14. **OPERATE: Agentic Workflow** - use `gh-aw` workflows
15. **おめでとうございます** - wrap-up and resources

## Skill installation used in the workshop

For the Agent Skills step, participants install:

```bash
gh skill install theomonfort/skills github-issues
gh skill install theomonfort/skills hands-on-helper
```

Recommended choices in the interactive prompt:

- **Agent**: `copilot`
- **Scope**: `project`

After installing a skill, remind participants to open a **new Copilot Chat session**. Existing chat sessions may not load newly installed skills.

Both skills are already included in this repository's `.agents/skills/`.
For safe recovery, follow README.md: preserve partial work with a commit or
`git stash push --include-untracked`, fetch the named checkpoint from the workshop
source, and create a fresh work branch. Never recommend a destructive reset.
The cumulative checkpoints are `checkpoint/01-develop` (basic landing/detail site),
`checkpoint/02-cloud-agent` (presentation features), and `checkpoint/03-tests`
(Playwright and PR workflow). The landing page is not presentation mode.
External guide step numbers may still reflect the previous ordering; use titles
and complete Cloud Agent before TEST & SECURE in this workshop.

## Troubleshooting rules

When someone is stuck:

1. Ask for the step number/title and the exact error message.
2. Check whether they are in the workshop repo they created from the template, not in `theomonfort/skills`.
3. Check whether they are using Codespaces or local VS Code.
4. Give the smallest next action, not a long explanation.
5. Link back to the relevant hands-on section and playbook page.

Common fixes:

| Symptom | Likely fix |
| --- | --- |
| "I don't know which repo to use" | Use the template repo: https://github.com/theomonfort/Github-copilot-workshop |
| Skill does not trigger | Install with `gh skill install theomonfort/skills github-issues`, then start a new Copilot Chat session |
| User is in the wrong repository | Tell them to switch to their copied workshop repository |
| Codespaces is missing | Use **Code -> Codespaces -> Create codespace on main** from the copied workshop repo |

## Answer style

- Go straight to the next action.
- Include the relevant link.
- Keep answers short unless the user asks for explanation.
- Use Japanese if the participant asks in Japanese; otherwise English is fine.
- Do not invent workshop requirements. If a detail is not in the hands-on guide, say so and point to the closest confirmed link.
