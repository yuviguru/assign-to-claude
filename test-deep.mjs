#!/usr/bin/env node
// test-deep.mjs — deep validation of generated files
// Checks: TypeScript syntax, YAML validity, GitHub Actions structure, webhook handler correctness

import { generateFiles } from "./dist/templates/generate.js";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713  ${message}`);
    passed++;
  } else {
    console.log(`  \u2717  FAIL: ${message}`);
    failed++;
  }
}

function makeTestDir(name) {
  const dir = join(tmpdir(), `claude-deep-test-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// All PM tool + platform combinations
const PM_TOOLS = ["linear", "jira", "asana", "clickup", "github_issues"];
const PLATFORMS = ["netlify", "vercel", "cloudflare"];

// ─── Test 1: TypeScript syntax validation of generated webhook handlers ──────

console.log("\n\u2550\u2550 TypeScript Syntax Validation \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

for (const pmTool of PM_TOOLS) {
  if (pmTool === "github_issues") continue; // No webhook handler

  for (const platform of PLATFORMS) {
    const dir = makeTestDir(`ts-${pmTool}-${platform}`);
    const config = {
      pmTool, platform,
      githubRepo: "testowner/testrepo",
      triggerEmail: "test@example.com",
      triggerUsername: "testuser",
      siteName: "test-site",
      jiraBaseUrl: "https://test.atlassian.net",
      jiraEmail: "test@example.com",
    };

    generateFiles({ config, cwd: dir });

    // Find the webhook handler file
    const handlerPaths = {
      netlify: "netlify/functions/webhook.ts",
      vercel: "api/webhook.ts",
      cloudflare: "src/worker.ts",
    };
    const handlerPath = join(dir, handlerPaths[platform]);

    if (existsSync(handlerPath)) {
      const content = readFileSync(handlerPath, "utf8");

      // Check for basic TypeScript structure
      assert(content.includes("export"), `${pmTool}+${platform}: Handler has exports`);
      assert(content.includes("async"), `${pmTool}+${platform}: Handler has async functions`);
      assert(content.includes("crypto"), `${pmTool}+${platform}: Handler imports crypto`);
      assert(content.includes("verifySignature"), `${pmTool}+${platform}: Handler has signature verification`);
      assert(content.includes("triggerGitHub"), `${pmTool}+${platform}: Handler has GitHub trigger`);

      // Check platform-specific entry point
      if (platform === "netlify") {
        assert(content.includes("Handler"), `${pmTool}+netlify: Has Netlify Handler type`);
        assert(content.includes("HandlerEvent"), `${pmTool}+netlify: Has HandlerEvent type`);
      } else if (platform === "vercel") {
        assert(content.includes("VercelRequest"), `${pmTool}+vercel: Has VercelRequest type`);
        assert(content.includes("VercelResponse"), `${pmTool}+vercel: Has VercelResponse type`);
      } else if (platform === "cloudflare") {
        assert(content.includes("interface Env"), `${pmTool}+cloudflare: Has Env interface`);
        assert(content.includes("fetch(request"), `${pmTool}+cloudflare: Has fetch handler`);
      }

      // Check correct event type in triggerGitHub
      const eventTypeMap = {
        linear: "linear-issue",
        jira: "jira-issue",
        asana: "asana-issue",
        clickup: "clickup-issue",
      };
      assert(
        content.includes(`event_type: "${eventTypeMap[pmTool]}"`),
        `${pmTool}+${platform}: Correct event_type "${eventTypeMap[pmTool]}"`
      );

      // Check correct secret key
      const secretKeyMap = {
        linear: "LINEAR_WEBHOOK_SECRET",
        jira: "JIRA_WEBHOOK_SECRET",
        asana: "ASANA_WEBHOOK_SECRET",
        clickup: "CLICKUP_WEBHOOK_SECRET",
      };
      assert(
        content.includes(secretKeyMap[pmTool]),
        `${pmTool}+${platform}: Uses correct secret key ${secretKeyMap[pmTool]}`
      );

      // Check no unbalanced braces (basic syntax check)
      const opens = (content.match(/\{/g) || []).length;
      const closes = (content.match(/\}/g) || []).length;
      assert(opens === closes, `${pmTool}+${platform}: Balanced braces (${opens} open, ${closes} close)`);

      // Check no unbalanced parens
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      assert(openParens === closeParens, `${pmTool}+${platform}: Balanced parens (${openParens} open, ${closeParens} close)`);

    } else {
      assert(false, `${pmTool}+${platform}: Handler file exists at ${handlerPaths[platform]}`);
    }

    cleanup(dir);
  }
}

// ─── Test 2: GitHub Actions YAML structure validation ────────────────────────

console.log("\n\u2550\u2550 GitHub Actions Workflow Validation \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

for (const pmTool of PM_TOOLS) {
  const dir = makeTestDir(`yaml-${pmTool}`);
  const config = {
    pmTool, platform: "netlify",
    githubRepo: "testowner/testrepo",
    triggerEmail: "test@example.com",
    triggerUsername: "testuser",
    siteName: "test-site",
    jiraBaseUrl: "https://test.atlassian.net",
    jiraEmail: "test@example.com",
  };

  generateFiles({ config, cwd: dir });

  // Main workflow
  const mainPath = join(dir, ".github/workflows/claude-pipeline.yml");
  const mainContent = readFileSync(mainPath, "utf8");

  assert(mainContent.startsWith("name:"), `${pmTool}: Workflow starts with name:`);
  assert(mainContent.includes("runs-on: ubuntu-latest"), `${pmTool}: Uses ubuntu-latest`);
  assert(mainContent.includes("timeout-minutes: 60"), `${pmTool}: Has 60 min timeout`);
  assert(mainContent.includes("actions/checkout@v4"), `${pmTool}: Uses checkout@v4`);
  assert(mainContent.includes("anthropics/claude-code-action@v1"), `${pmTool}: Uses claude-code-action@v1`);
  assert(mainContent.includes("CLAUDE_CODE_OAUTH_TOKEN"), `${pmTool}: References CLAUDE_CODE_OAUTH_TOKEN secret`);
  assert(mainContent.includes("fetch-depth: 0"), `${pmTool}: Full git history`);

  // Permissions
  assert(mainContent.includes("contents: write"), `${pmTool}: Has contents:write permission`);
  assert(mainContent.includes("pull-requests: write"), `${pmTool}: Has pull-requests:write permission`);
  assert(mainContent.includes("issues: write"), `${pmTool}: Has issues:write permission`);
  assert(mainContent.includes("id-token: write"), `${pmTool}: Has id-token:write permission`);

  if (pmTool === "github_issues") {
    assert(mainContent.includes("on:\n  issues:\n    types: [assigned]"), `${pmTool}: Triggers on issues assigned`);
    assert(mainContent.includes("github.event.issue.number"), `${pmTool}: References issue number`);
    assert(mainContent.includes("github.event.issue.title"), `${pmTool}: References issue title`);
    assert(mainContent.includes("github.event.issue.body"), `${pmTool}: References issue body`);
  } else {
    assert(mainContent.includes("repository_dispatch"), `${pmTool}: Uses repository_dispatch trigger`);
    assert(mainContent.includes("client_payload"), `${pmTool}: References client_payload`);
    assert(mainContent.includes("github.event.client_payload.issue_id"), `${pmTool}: References issue_id from payload`);
    assert(mainContent.includes("github.event.client_payload.title"), `${pmTool}: References title from payload`);
    assert(mainContent.includes("github.event.client_payload.description"), `${pmTool}: References description from payload`);

    // Model selection step
    assert(mainContent.includes("Select model"), `${pmTool}: Has model selection step`);
    assert(mainContent.includes("quick-fix"), `${pmTool}: Has quick-fix label check`);
    assert(mainContent.includes("claude-sonnet-4-6"), `${pmTool}: Selects Sonnet for quick-fix`);
    assert(mainContent.includes("claude-opus-4-6"), `${pmTool}: Defaults to Opus`);
  }

  // Branch creation
  assert(mainContent.includes("Create feature branch"), `${pmTool}: Has branch creation step`);
  assert(mainContent.includes("git checkout -b"), `${pmTool}: Creates new branch`);
  assert(mainContent.includes("git push -u origin"), `${pmTool}: Pushes branch to origin`);

  // PR review workflow
  const reviewPath = join(dir, ".github/workflows/claude-pr-review.yml");
  const reviewContent = readFileSync(reviewPath, "utf8");

  assert(reviewContent.includes("issue_comment"), `${pmTool}: PR review triggers on issue_comment`);
  assert(reviewContent.includes("pull_request_review_comment"), `${pmTool}: PR review triggers on PR review comment`);
  assert(reviewContent.includes("@claude"), `${pmTool}: PR review filters for @claude mentions`);
  assert(reviewContent.includes("CLAUDE.md"), `${pmTool}: PR review references CLAUDE.md`);

  cleanup(dir);
}

// ─── Test 3: Platform config file validation ─────────────────────────────────

console.log("\n\u2550\u2550 Platform Config Validation \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

{
  // Netlify
  const dir = makeTestDir("platform-netlify");
  generateFiles({ config: { pmTool: "linear", platform: "netlify", githubRepo: "o/r", triggerEmail: "t@t.com", siteName: "s" }, cwd: dir });
  const toml = readFileSync(join(dir, "netlify.toml"), "utf8");
  assert(toml.includes('[build]'), "Netlify: Has [build] section");
  assert(toml.includes('functions = "netlify/functions"'), "Netlify: Functions directory set");
  assert(toml.includes('node_bundler = "esbuild"'), "Netlify: Uses esbuild bundler");
  assert(toml.includes("[[redirects]]"), "Netlify: Has redirects for /api/*");
  cleanup(dir);
}

{
  // Vercel
  const dir = makeTestDir("platform-vercel");
  generateFiles({ config: { pmTool: "linear", platform: "vercel", githubRepo: "o/r", triggerEmail: "t@t.com", siteName: "s" }, cwd: dir });
  const json = readFileSync(join(dir, "vercel.json"), "utf8");
  const parsed = JSON.parse(json);
  assert(parsed.functions && parsed.functions["api/webhook.ts"], "Vercel: Configures api/webhook.ts function");
  assert(parsed.functions["api/webhook.ts"].runtime === "@vercel/node", "Vercel: Uses @vercel/node runtime");
  cleanup(dir);
}

{
  // Cloudflare
  const dir = makeTestDir("platform-cloudflare");
  generateFiles({ config: { pmTool: "linear", platform: "cloudflare", githubRepo: "o/r", triggerEmail: "t@t.com", siteName: "s" }, cwd: dir });
  const toml = readFileSync(join(dir, "wrangler.toml"), "utf8");
  assert(toml.includes('name = "claude-pipeline-webhook"'), "Cloudflare: Has worker name");
  assert(toml.includes('main = "src/worker.ts"'), "Cloudflare: Points to worker.ts");
  assert(toml.includes("compatibility_date"), "Cloudflare: Has compatibility_date");
  cleanup(dir);
}

// ─── Test 4: .env.example validation ─────────────────────────────────────────

console.log("\n\u2550\u2550 .env.example Validation \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

for (const pmTool of PM_TOOLS) {
  const dir = makeTestDir(`env-${pmTool}`);
  const config = {
    pmTool, platform: "netlify",
    githubRepo: "owner/repo",
    triggerEmail: "user@example.com",
    triggerUsername: "testuser",
    siteName: "test-site",
    jiraBaseUrl: "https://test.atlassian.net",
    jiraEmail: "test@example.com",
  };

  generateFiles({ config, cwd: dir });
  const env = readFileSync(join(dir, ".env.example"), "utf8");

  assert(env.includes("GITHUB_REPO=owner/repo"), `${pmTool}: .env has GITHUB_REPO`);
  assert(env.includes("TRIGGER_EMAIL=user@example.com"), `${pmTool}: .env has TRIGGER_EMAIL`);
  assert(env.includes("GITHUB_PAT="), `${pmTool}: .env has GITHUB_PAT placeholder`);
  assert(env.includes("CLAUDE_CODE_OAUTH_TOKEN"), `${pmTool}: .env references CLAUDE_CODE_OAUTH_TOKEN`);

  if (pmTool !== "github_issues") {
    const secretMap = {
      linear: "LINEAR_WEBHOOK_SECRET",
      jira: "JIRA_WEBHOOK_SECRET",
      asana: "ASANA_WEBHOOK_SECRET",
      clickup: "CLICKUP_WEBHOOK_SECRET",
    };
    assert(env.includes(secretMap[pmTool]), `${pmTool}: .env has ${secretMap[pmTool]}`);
  }

  cleanup(dir);
}

// ─── Test 5: Asana handshake support ─────────────────────────────────────────

console.log("\n\u2550\u2550 Asana Handshake Support \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

for (const platform of PLATFORMS) {
  const dir = makeTestDir(`asana-${platform}`);
  generateFiles({
    config: { pmTool: "asana", platform, githubRepo: "o/r", triggerEmail: "t@t.com", siteName: "s" },
    cwd: dir,
  });

  const handlerPaths = {
    netlify: "netlify/functions/webhook.ts",
    vercel: "api/webhook.ts",
    cloudflare: "src/worker.ts",
  };
  const content = readFileSync(join(dir, handlerPaths[platform]), "utf8");

  // Asana handler should have hookSecret parameter
  assert(content.includes("hookSecret"), `asana+${platform}: Handler supports hookSecret (handshake)`);
  assert(content.includes("x-asana-signature"), `asana+${platform}: Reads x-asana-signature header`);
  assert(content.includes("x-hook-secret"), `asana+${platform}: Reads x-hook-secret header`);

  cleanup(dir);
}

// ─── Test 6: CLI entry point validation ──────────────────────────────────────

console.log("\n\u2550\u2550 CLI Entry Point \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

{
  const cliContent = readFileSync("dist/cli.js", "utf8");
  assert(cliContent.startsWith("#!/usr/bin/env node"), "CLI has shebang");

  // Test --version
  try {
    const version = execSync("node dist/cli.js --version", { cwd: process.cwd() }).toString().trim();
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert(version === pkg.version, `CLI --version returns ${pkg.version} (got: ${version})`);
  } catch (e) {
    assert(false, `CLI --version runs without error: ${e.message}`);
  }

  // Test --help
  try {
    const help = execSync("node dist/cli.js --help", { cwd: process.cwd() }).toString();
    assert(help.includes("assign-to-claude"), "CLI --help mentions assign-to-claude");
    assert(help.includes("init"), "CLI --help mentions init command");
    assert(help.includes("Linear"), "CLI --help lists Linear");
    assert(help.includes("Jira"), "CLI --help lists Jira");
    assert(help.includes("Asana"), "CLI --help lists Asana");
    assert(help.includes("ClickUp"), "CLI --help lists ClickUp");
    assert(help.includes("GitHub Issues"), "CLI --help lists GitHub Issues");
    assert(help.includes("Netlify"), "CLI --help lists Netlify");
    assert(help.includes("Vercel"), "CLI --help lists Vercel");
    assert(help.includes("Cloudflare"), "CLI --help lists Cloudflare");
  } catch (e) {
    assert(false, `CLI --help runs without error: ${e.message}`);
  }

  // Test unknown command
  try {
    execSync("node dist/cli.js foobar", { cwd: process.cwd(), stdio: "pipe" });
    assert(false, "CLI rejects unknown commands");
  } catch (e) {
    assert(e.status === 1, "CLI exits with code 1 for unknown command");
  }
}

// ─── Test 7: CI Guard ────────────────────────────────────────────────────────

console.log("\n\u2550\u2550 CI Guard \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

{
  // Simulate CI environment
  try {
    execSync('node --input-type=module -e "import { guardCI } from \'./dist/utils/ci-guard.js\'; guardCI();"', {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env, CI: "true" },
    });
    // guardCI calls process.exit(0) in CI, which makes execSync NOT throw
    // But stdout.isTTY is false in execSync, so it will always detect CI
    assert(true, "CI guard exits cleanly (code 0) in CI environment");
  } catch (e) {
    // If it threw, check it's exit code 0 (clean exit)
    assert(e.status === 0, "CI guard exits cleanly (code 0) in CI environment");
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed  ${failed > 0 ? `${failed} FAILED` : ""}`);
console.log();

if (failed > 0) process.exit(1);
