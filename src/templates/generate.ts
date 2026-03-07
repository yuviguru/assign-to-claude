import { mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import type { PipelineConfig, PMTool, HostingPlatform } from "../types.js";
import { getAdapter } from "../adapters/index.js";
import { getPlatform } from "../platforms/index.js";

interface GenerateOptions {
  config: PipelineConfig & Record<string, string>;
  cwd?: string;
}

interface GeneratedOutput {
  files: Array<{ path: string; skipped?: boolean }>;
}

function write(filePath: string, content: string, cwd: string): { skipped: boolean } {
  const abs = join(cwd, filePath);
  if (existsSync(abs)) return { skipped: true };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return { skipped: false };
}

// ─── GitHub Actions workflow ─────────────────────────────────────────────────

function generateMainWorkflow(tool: PMTool, eventType: string): string {
  if (tool === "github_issues") {
    return `name: Claude Code — GitHub Issues

on:
  issues:
    types: [assigned]

jobs:
  implement:
    if: github.event.assignee.login == github.actor
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create feature branch
        id: branch
        run: |
          ISSUE_NUM="\${{ github.event.issue.number }}"
          TITLE="\${{ github.event.issue.title }}"
          SLUG=\$(echo "\$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-50)
          BRANCH="issue-\${ISSUE_NUM}-\${SLUG}"
          echo "branch_name=\${BRANCH}" >> "\$GITHUB_OUTPUT"
          git checkout -b "\$BRANCH"
          git push -u origin "\$BRANCH"

      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          claude_args: |
            --model claude-opus-4-6
            --allowedTools "Read,Edit,Write,Bash,Glob,Grep"
          prompt: |
            ## GitHub Issue #\${{ github.event.issue.number }}
            **Title:** \${{ github.event.issue.title }}

            **Description:**
            \${{ github.event.issue.body }}

            ## Instructions
            1. Read \`.claude/CLAUDE.md\` for project context and conventions.
            2. Implement the changes described in the issue.
            3. Run all CI checks and fix any failures before opening the PR.
            4. Prefix all commits with \`#\${{ github.event.issue.number }}:\`.
            5. Create the PR targeting main.
`;
  }

  return `name: Claude Code — ${tool.charAt(0).toUpperCase() + tool.slice(1)}

on:
  repository_dispatch:
    types: [${eventType}]

jobs:
  implement:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create feature branch
        id: branch
        run: |
          ISSUE_ID="\${{ github.event.client_payload.issue_id }}"
          TITLE="\${{ github.event.client_payload.title }}"
          SLUG=\$(echo "\$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-50)
          BRANCH="\${ISSUE_ID}-\${SLUG}"
          echo "branch_name=\${BRANCH}" >> "\$GITHUB_OUTPUT"
          git checkout -b "\$BRANCH"
          git push -u origin "\$BRANCH"

      - name: Select model
        id: model
        run: |
          LABELS='\${{ toJSON(github.event.client_payload.labels) }}'
          if echo "\$LABELS" | grep -q '"quick-fix"'; then
            echo "name=claude-sonnet-4-6" >> "\$GITHUB_OUTPUT"
          else
            echo "name=claude-opus-4-6" >> "\$GITHUB_OUTPUT"
          fi

      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          claude_args: |
            --model \${{ steps.model.outputs.name }}
            --allowedTools "Read,Edit,Write,Bash,Glob,Grep"
          prompt: |
            ## Issue: \${{ github.event.client_payload.issue_id }}
            **Title:** \${{ github.event.client_payload.title }}

            **Description:**
            \${{ github.event.client_payload.description }}

            ## Instructions
            1. Read \`.claude/CLAUDE.md\` for project context and conventions.
            2. Implement the changes described in the issue.
            3. Run all CI checks and fix any failures before opening the PR.
            4. Prefix all commits with \`\${{ github.event.client_payload.issue_id }}:\`.
            5. Create the PR targeting main.
`;
}

function generatePRReviewWorkflow(): string {
  return `name: Claude Code — PR Review

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  respond:
    if: |
      (github.event.issue.pull_request && contains(github.event.comment.body, '@claude')) ||
      (github.event.pull_request && contains(github.event.comment.body, '@claude'))
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          show_full_output: true
          claude_args: |
            --model claude-opus-4-6
            --allowedTools "Read,Edit,Write,Bash,Glob,Grep"
          prompt: |
            Read \`.claude/CLAUDE.md\` for project context and conventions.
            Address the review feedback in the PR comment.
            Fix the issues, run all CI checks, and push when everything passes.
`;
}

function generateEnvExample(
  config: PipelineConfig & Record<string, string>,
  extraVars: Array<{ key: string; comment: string; value?: string }>
): string {
  const lines = [
    `# Claude Pipeline — environment variables`,
    `# Copy to .env and fill in real values`,
    ``,
    `GITHUB_REPO=${config.githubRepo}`,
    `TRIGGER_EMAIL=${config.triggerEmail}`,
    ``,
    `# GitHub — fine-grained PAT (contents/PRs/actions/issues write)`,
    `GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
    ``,
    `# PM tool secrets`,
  ];

  for (const v of extraVars) {
    lines.push(`# ${v.comment}`);
    lines.push(`${v.key}=${v.value ?? ""}`);
    lines.push(``);
  }

  lines.push(`# Claude Code OAuth token — run: claude setup-token`);
  lines.push(`# Add to GitHub repo secrets (not here)`);
  lines.push(`# CLAUDE_CODE_OAUTH_TOKEN=...`);

  return lines.join("\n") + "\n";
}

// ─── Main generator ───────────────────────────────────────────────────────────

const EVENT_TYPE: Record<PMTool, string> = {
  linear: "linear-issue",
  jira: "jira-issue",
  asana: "asana-issue",
  clickup: "clickup-issue",
  github_issues: "",
};

export function generateFiles(options: GenerateOptions): GeneratedOutput {
  const { config, cwd = process.cwd() } = options;
  const adapter = getAdapter(config.pmTool);
  const results: Array<{ path: string; skipped?: boolean }> = [];

  const record = (path: string, skipped: boolean) =>
    results.push({ path, skipped: skipped || undefined });

  // 1. Webhook handler (skip for GitHub Issues)
  if (config.pmTool !== "github_issues") {
    const platform = getPlatform(config.platform);
    const handler = adapter.generateWebhookHandler(config);

    // Wrap the core handler in a platform-specific entry point
    const platformWrapper = generatePlatformWrapper(config.pmTool, config.platform, handler.content);
    const handlerPath = platform.webhookPath;
    const r = write(handlerPath, platformWrapper, cwd);
    record(handlerPath, r.skipped);

    // Platform config file (netlify.toml / vercel.json / wrangler.toml)
    const platformConfig = platform.generateConfig();
    const r2 = write(platformConfig.path, platformConfig.content, cwd);
    record(platformConfig.path, r2.skipped);
  }

  // 2. GitHub Actions — main workflow
  const mainWorkflow = generateMainWorkflow(config.pmTool, EVENT_TYPE[config.pmTool]);
  const mainPath = ".github/workflows/claude-pipeline.yml";
  record(mainPath, write(mainPath, mainWorkflow, cwd).skipped);

  // 3. GitHub Actions — PR review workflow
  const reviewWorkflow = generatePRReviewWorkflow();
  const reviewPath = ".github/workflows/claude-pr-review.yml";
  record(reviewPath, write(reviewPath, reviewWorkflow, cwd).skipped);

  // 4. .env.example
  const envExample = generateEnvExample(config, adapter.envVars);
  record(".env.example", write(".env.example", envExample, cwd).skipped);

  return { files: results };
}

// ─── Platform wrapper ─────────────────────────────────────────────────────────

function generatePlatformWrapper(tool: PMTool, platform: HostingPlatform, coreHandler: string): string {
  const handlerFn: Record<PMTool, string> = {
    linear: "handleLinearWebhook",
    jira: "handleJiraWebhook",
    asana: "handleAsanaWebhook",
    clickup: "handleClickUpWebhook",
    github_issues: "",
  };

  const fn = handlerFn[tool];

  if (platform === "netlify") {
    return `${coreHandler}
// ─── Netlify entry point ──────────────────────────────────────────────────────

import type { Handler, HandlerEvent } from "@netlify/functions";

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!event.body) return { statusCode: 400, body: "Empty body" };

  const env = {
    GITHUB_PAT: process.env["GITHUB_PAT"] ?? "",
    GITHUB_REPO: process.env["GITHUB_REPO"] ?? "",
    TRIGGER_EMAIL: process.env["TRIGGER_EMAIL"],
    ...getToolSecrets(),
  };

  const result = await ${fn}(
    event.body,
    ${tool === "asana"
      ? `event.headers["x-asana-signature"] ?? "",\n    event.headers["x-hook-secret"] ?? null,`
      : `event.headers["${signatureHeader(tool)}"] ?? "",`
    }
    env
  );

  return { statusCode: result.status, body: result.body };
};

function getToolSecrets() {
  return {
    ${secretKey(tool)}: process.env["${secretKey(tool)}"] ?? "",
  };
}
`;
  }

  if (platform === "vercel") {
    return `${coreHandler}
// ─── Vercel entry point ───────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  const env = {
    GITHUB_PAT: process.env["GITHUB_PAT"] ?? "",
    GITHUB_REPO: process.env["GITHUB_REPO"] ?? "",
    TRIGGER_EMAIL: process.env["TRIGGER_EMAIL"],
    ${secretKey(tool)}: process.env["${secretKey(tool)}"] ?? "",
  };

  const result = await ${fn}(
    body,
    ${tool === "asana"
      ? `String(req.headers["x-asana-signature"] ?? ""),\n    String(req.headers["x-hook-secret"] ?? ""),`
      : `String(req.headers["${signatureHeader(tool)}"] ?? ""),`
    }
    env
  );

  return res.status(result.status).send(result.body);
}
`;
  }

  // Cloudflare Workers
  return `${coreHandler}
// ─── Cloudflare Workers entry point ──────────────────────────────────────────

interface Env {
  GITHUB_PAT: string;
  GITHUB_REPO: string;
  TRIGGER_EMAIL?: string;
  ${secretKey(tool)}: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await request.text();
    const result = await ${fn}(
      body,
      ${tool === "asana"
        ? `request.headers.get("x-asana-signature") ?? "",\n      request.headers.get("x-hook-secret"),`
        : `request.headers.get("${signatureHeader(tool)}") ?? "",`
      }
      env
    );

    return new Response(result.body, { status: result.status });
  },
};
`;
}

function signatureHeader(tool: PMTool): string {
  const map: Partial<Record<PMTool, string>> = {
    linear: "linear-signature",
    jira: "x-hub-signature",
    clickup: "x-signature",
  };
  return map[tool] ?? "x-signature";
}

function secretKey(tool: PMTool): string {
  const map: Partial<Record<PMTool, string>> = {
    linear: "LINEAR_WEBHOOK_SECRET",
    jira: "JIRA_WEBHOOK_SECRET",
    asana: "ASANA_WEBHOOK_SECRET",
    clickup: "CLICKUP_WEBHOOK_SECRET",
  };
  return map[tool] ?? "WEBHOOK_SECRET";
}
