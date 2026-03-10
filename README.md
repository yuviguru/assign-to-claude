# assign-to-claude

[![npm version](https://img.shields.io/npm/v/assign-to-claude.svg)](https://www.npmjs.com/package/assign-to-claude)
[![license](https://img.shields.io/npm/l/assign-to-claude.svg)](https://opensource.org/licenses/MIT)
[![downloads](https://img.shields.io/npm/dm/assign-to-claude.svg)](https://www.npmjs.com/package/assign-to-claude)

> Connect any PM tool to Claude Code. Assign a ticket, get a PR.

Generates the webhook server and GitHub Actions workflows to wire your project management tool to [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Assign a ticket to yourself — a branch is created, Claude implements the changes, CI runs, and a PR opens. Your machine doesn't need to be on.

---

## Quick start

```bash
npx assign-to-claude init
```

The interactive CLI asks which PM tool and hosting platform you use, then generates all the files you need.

---

## Prerequisites

Before running `init`, make sure you have:

- **Node.js >= 20** — `node --version` to check
- **A GitHub repository** with your project code
- **A GitHub fine-grained PAT** — [create one here](https://github.com/settings/tokens?type=beta) with these permissions:
  - Contents: **Read and write**
  - Pull requests: **Read and write**
  - Actions: **Read and write** (needed for `repository_dispatch`)
  - Issues: **Read and write**
- **A Claude Code subscription** with an OAuth token — run `claude setup-token` to generate one
- **A hosting account** on Netlify, Vercel, or Cloudflare _(not needed for GitHub Issues)_

---

## How it works

```
PM tool assigns ticket to you
    |
    v
Webhook fires to your server (Netlify / Vercel / Cloudflare)
    |
    v
Server verifies signature + checks trigger email
    |
    v
GitHub repository_dispatch fires
    |
    v
GitHub Actions: creates branch, runs Claude Code
    |
    v
Claude reads .claude/CLAUDE.md, implements the changes
    |
    v
PR opened with passing CI
```

For **GitHub Issues** — the webhook server is skipped entirely. GitHub Actions triggers directly on `issues: assigned`.

---

## Step-by-step setup

### Step 1: Run init

```bash
npx assign-to-claude init
```

The CLI will ask you:
1. Which PM tool you use (Linear, Jira, Asana, ClickUp, or GitHub Issues)
2. Where to host the webhook server (Netlify, Vercel, or Cloudflare) — skipped for GitHub Issues
3. Your GitHub repo in `owner/repo` format
4. Your trigger email (the email in your PM tool that triggers the pipeline)
5. Your site name (for the webhook URL)

Files are generated into your current directory. Existing files are never overwritten.

---

### Step 2: Create a GitHub fine-grained PAT

1. Go to [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Give it a name like `assign-to-claude`
4. Set **Repository access** to your target repo
5. Under **Permissions**, enable:
   - **Contents**: Read and write
   - **Pull requests**: Read and write
   - **Actions**: Read and write
   - **Issues**: Read and write
6. Click **Generate token** and copy it

This token goes into your webhook server's environment variables as `GITHUB_PAT`.

---

### Step 3: Get your Claude Code OAuth token

```bash
claude setup-token
```

This outputs a token. Add it as a GitHub Actions secret:

1. Go to `github.com/<owner>/<repo>/settings/secrets/actions`
2. Click **New repository secret**
3. Name: `CLAUDE_CODE_OAUTH_TOKEN`
4. Value: paste the token from `claude setup-token`

---

### Step 4: Deploy your webhook server

_(Skip this step if you chose GitHub Issues — no server needed.)_

<details>
<summary><strong>Netlify</strong></summary>

```bash
# Install CLI
npm install -g netlify-cli

# Login and init
netlify login
netlify init

# Set environment variables
netlify env:set GITHUB_REPO "owner/repo"
netlify env:set GITHUB_PAT "ghp_your_token_here"
netlify env:set TRIGGER_EMAIL "you@example.com"
netlify env:set LINEAR_WEBHOOK_SECRET "$(openssl rand -hex 32)"

# Deploy
netlify deploy --prod
```

Your webhook URL: `https://YOUR_SITE.netlify.app/api/webhook`

</details>

<details>
<summary><strong>Vercel</strong></summary>

```bash
# Install CLI
npm install -g vercel

# Login and link project
vercel login
vercel

# Set environment variables (prompted for values)
vercel env add GITHUB_REPO
vercel env add GITHUB_PAT
vercel env add TRIGGER_EMAIL
vercel env add LINEAR_WEBHOOK_SECRET

# Deploy
vercel --prod
```

Your webhook URL: `https://YOUR_SITE.vercel.app/api/webhook`

</details>

<details>
<summary><strong>Cloudflare Workers</strong></summary>

```bash
# Install CLI
npm install -g wrangler

# Login
wrangler login

# Set secrets (prompted for values)
wrangler secret put GITHUB_REPO
wrangler secret put GITHUB_PAT
wrangler secret put TRIGGER_EMAIL
wrangler secret put LINEAR_WEBHOOK_SECRET

# Deploy
wrangler deploy
```

Your webhook URL: shown after deploy (e.g. `https://claude-pipeline-webhook.YOUR_SUBDOMAIN.workers.dev`)

</details>

> **Note:** Replace `LINEAR_WEBHOOK_SECRET` with the correct secret name for your PM tool:
> `LINEAR_WEBHOOK_SECRET`, `JIRA_WEBHOOK_SECRET`, `ASANA_WEBHOOK_SECRET`, or `CLICKUP_WEBHOOK_SECRET`.

---

### Step 5: Create a webhook in your PM tool

<details>
<summary><strong>Linear</strong></summary>

1. Go to **Linear** → **Settings** → **API** → **Webhooks** → **New webhook**
2. **URL**: `https://YOUR_SITE.netlify.app/api/webhook` (or your Vercel/Cloudflare URL)
3. **Secret**: paste the same value you used for `LINEAR_WEBHOOK_SECRET`
4. **Events**: check **Issue updates** only — uncheck everything else
5. Click **Create webhook**

</details>

<details>
<summary><strong>Jira</strong></summary>

1. Go to **Jira** → **Settings** → **System** → **Webhooks** → **Create webhook**
2. **URL**: `https://YOUR_SITE.netlify.app/api/webhook`
3. **Events**: check **Issue updated** → make sure **Assignee changed** is included
4. Set a webhook secret and use the same value for `JIRA_WEBHOOK_SECRET` in your server env

</details>

<details>
<summary><strong>Asana</strong></summary>

Asana doesn't have a webhook UI. Create one via the API:

```bash
curl -X POST https://app.asana.com/api/1.0/webhooks \
  -H "Authorization: Bearer YOUR_ASANA_PAT" \
  -d "resource=YOUR_PROJECT_GID&target=https://YOUR_SITE.netlify.app/api/webhook"
```

The response includes an `X-Hook-Secret` header. Copy that value and set it as `ASANA_WEBHOOK_SECRET` in your server environment.

</details>

<details>
<summary><strong>ClickUp</strong></summary>

1. Go to **ClickUp** → **Settings** → **Integrations** → **Webhooks** → **Add webhook**
2. **URL**: `https://YOUR_SITE.netlify.app/api/webhook`
3. **Events**: select **taskAssigneeUpdated** only
4. Copy the webhook secret and set it as `CLICKUP_WEBHOOK_SECRET` in your server env

</details>

<details>
<summary><strong>GitHub Issues</strong></summary>

Nothing to do here. The generated workflow triggers directly when an issue is assigned to you. No webhook server, no extra configuration.

</details>

---

### Step 6: Create `.claude/CLAUDE.md`

Create a file at `.claude/CLAUDE.md` in your repo. Claude reads this at the start of every automated task. Include:

```markdown
# Project Context

## Stack
- Next.js 14, TypeScript, Tailwind CSS
- PostgreSQL with Prisma ORM
- Jest for testing

## Conventions
- Use `src/` directory structure
- All components in `src/components/`
- API routes in `src/app/api/`

## CI Commands
- Lint: `npm run lint`
- Test: `npm test`
- Build: `npm run build`

## Rules
- Always run lint and tests before committing
- Write tests for new features
- Use conventional commit messages
```

Customize this for your project. The more specific you are, the better Claude's output.

---

### Step 7: Push and test

```bash
git add .
git commit -m "feat: add claude pipeline"
git push origin main
```

Now assign a ticket to yourself in your PM tool. Within seconds:
1. The webhook fires
2. A GitHub Action starts
3. Claude creates a branch, implements the changes, runs CI
4. A PR opens targeting `main`

---

## Generated files

| File | Purpose |
|---|---|
| `netlify/functions/webhook.ts` *(or vercel/cloudflare equivalent)* | Receives PM tool webhook, verifies signature, dispatches to GitHub |
| `.github/workflows/claude-pipeline.yml` | Creates branch, runs Claude Code, opens PR |
| `.github/workflows/claude-pr-review.yml` | Handles `@claude` feedback on PRs |
| `netlify.toml` *(or `vercel.json` / `wrangler.toml`)* | Platform routing config |
| `.env.example` | Required environment variables with descriptions |

No runtime dependency on this package — the generated files work independently forever.

---

## Environment variables

### Webhook server (Netlify / Vercel / Cloudflare)

| Variable | Required | Description |
|---|---|---|
| `GITHUB_REPO` | Yes | Your repo in `owner/repo` format |
| `GITHUB_PAT` | Yes | Fine-grained PAT with contents/PRs/actions/issues write |
| `TRIGGER_EMAIL` | Recommended | Only trigger when the ticket is assigned to this email |
| `LINEAR_WEBHOOK_SECRET` | Linear only | Secret from Linear webhook settings |
| `JIRA_WEBHOOK_SECRET` | Jira only | Secret you set when creating the Jira webhook |
| `ASANA_WEBHOOK_SECRET` | Asana only | `X-Hook-Secret` returned when creating the Asana webhook |
| `CLICKUP_WEBHOOK_SECRET` | ClickUp only | Secret from ClickUp webhook settings |

### GitHub Secrets (repository settings)

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Yes | From `claude setup-token` — **never** put this in your .env file |

---

## Supported tools and platforms

| PM Tool | Trigger | Webhook needed? |
|---|---|---|
| **Linear** | Issue assigned | Yes |
| **Jira** | Issue assignee changed | Yes |
| **Asana** | Task assigned | Yes |
| **ClickUp** | Task assignee added | Yes |
| **GitHub Issues** | Issue assigned | No — built into GitHub Actions |

| Hosting Platform | Config file | Webhook path |
|---|---|---|
| **Netlify** | `netlify.toml` | `netlify/functions/webhook.ts` |
| **Vercel** | `vercel.json` | `api/webhook.ts` |
| **Cloudflare Workers** | `wrangler.toml` | `src/worker.ts` |

---

## Features

- **Model selection** — add a `quick-fix` label to your ticket and Claude uses Sonnet (faster, cheaper). Without it, Claude uses Opus (most capable).
- **PR review** — comment `@claude` on any PR to get Claude to address feedback, fix issues, and push.
- **Auto env detection** — if you have a `.env` file with `LINEAR_API_KEY`, `JIRA_API_TOKEN`, etc., the CLI auto-detects your PM tool.
- **Skip existing files** — running `init` again won't overwrite files you've already customized.
- **CI-safe** — if installed as a devDependency, it detects CI environments and exits cleanly without prompting.

---

## Troubleshooting

### Webhook not firing
- Verify your webhook URL is correct and ends with `/api/webhook`
- Check that the webhook secret in your PM tool matches the one in your server env
- Confirm you selected the right events (e.g., "Issue updated" for Linear, not "Issue created")
- Check your server logs: `netlify logs` / Vercel dashboard / `wrangler tail`

### GitHub Action not running
- Make sure `CLAUDE_CODE_OAUTH_TOKEN` is set in GitHub Secrets (Settings → Secrets → Actions)
- Verify your `GITHUB_PAT` has the correct permissions (contents, PRs, actions, issues — all write)
- Check that the PAT has access to the specific repository
- Look at the Actions tab in your repo for error details

### Wrong person triggers the pipeline
- Set `TRIGGER_EMAIL` in your webhook server env to your email
- For GitHub Issues, the workflow checks `github.event.assignee.login` against `github.actor`

### "Invalid signature" errors
- The webhook secret must be identical in both your PM tool and your server env
- Make sure you didn't add extra whitespace when copying
- For Asana: the secret comes from the `X-Hook-Secret` header in the handshake response

### Claude doesn't follow project conventions
- Create or update `.claude/CLAUDE.md` with your stack, conventions, and CI commands
- Be specific — list exact commands for linting, testing, and building

---

## License

MIT
