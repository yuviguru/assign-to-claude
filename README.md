# assign-to-claude

> Connect any PM tool to Claude Code. Assign a ticket, get a PR.

Generates the webhook server and GitHub Actions workflows to wire your project management tool to Claude Code. Assign a ticket to yourself — a branch is created, Claude implements the changes, CI runs, and a PR opens. Your machine doesn't need to be on.

---

## Quick start

```bash
# Run without installing
npx assign-to-claude init

# Or install globally
npm install -g assign-to-claude
pnpm add -g assign-to-claude

assign-to-claude init
```

---

## What it does

Generates exactly these files into your repo:

| File | Purpose |
|---|---|
| `netlify/functions/webhook.ts` *(or vercel/cloudflare equivalent)* | Receives PM tool webhook, dispatches to GitHub |
| `.github/workflows/claude-pipeline.yml` | Creates branch, runs Claude Code, opens PR |
| `.github/workflows/claude-pr-review.yml` | Handles `@claude` feedback on PRs |
| `netlify.toml` *(or vercel.json / wrangler.toml)* | Platform routing config |
| `.env.example` | Required environment variables |

That's it. No runtime dependency on this package — the generated files work independently forever.

---

## Supported PM tools

| Tool | Trigger event |
|---|---|
| **Linear** | Issue assigned |
| **Jira** | Issue assignee changed |
| **Asana** | Task assigned |
| **ClickUp** | Task assignee added |
| **GitHub Issues** | Issue assigned — no webhook server needed |

## Supported platforms

| Platform | Config file |
|---|---|
| **Netlify** | `netlify.toml` |
| **Vercel** | `vercel.json` |
| **Cloudflare Workers** | `wrangler.toml` |

---

## How it works

```
PM tool assigns ticket to you
    ↓
Webhook fires to your server (Netlify / Vercel / Cloudflare)
    ↓
Server verifies signature + checks trigger email
    ↓
GitHub repository_dispatch fires
    ↓
GitHub Actions: creates branch, runs Claude Code
    ↓
Claude reads .claude/CLAUDE.md, implements the changes
    ↓
PR opened with passing CI
```

For GitHub Issues — the webhook server is skipped entirely. GitHub Actions triggers directly on `issues: assigned`.

---

## After running init

1. **Deploy your webhook server** — follow the printed steps for your platform
2. **Create the webhook in your PM tool** — URL and secret printed after init
3. **Add `CLAUDE_CODE_OAUTH_TOKEN` to GitHub Secrets** — run `claude setup-token` to get it
4. **Push to main** — `git add . && git commit -m "feat: add claude pipeline" && git push`
5. **Fill in `.claude/CLAUDE.md`** — add your stack, conventions, CI commands

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_REPO` | Yes | `owner/repo` format |
| `GITHUB_PAT` | Yes | Fine-grained PAT — contents/PRs/actions/issues write |
| `TRIGGER_EMAIL` | Recommended | Only trigger when assigned to this email |
| `LINEAR_WEBHOOK_SECRET` | Linear only | From Linear webhook settings |
| `JIRA_WEBHOOK_SECRET` | Jira only | Set when creating Jira webhook |
| `ASANA_WEBHOOK_SECRET` | Asana only | Returned in X-Hook-Secret on first request |
| `CLICKUP_WEBHOOK_SECRET` | ClickUp only | From ClickUp webhook settings |

`CLAUDE_CODE_OAUTH_TOKEN` goes in **GitHub Secrets** only — not in your env file.

---

## CI environments

`claude-pipeline init` detects CI environments and exits cleanly without prompting.
Safe to have as a devDependency — it will never block your pipeline.

---

## License

MIT
