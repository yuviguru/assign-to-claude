#!/usr/bin/env node
// test.mjs — tests file generation for all combinations

import { generateFiles } from "./dist/templates/generate.js";
import { detectFromEnvFiles } from "./dist/utils/detect-env.js";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓  ${message}`);
    passed++;
  } else {
    console.log(`  ✗  ${message}`);
    failed++;
  }
}

function makeTestDir(name) {
  const dir = join(tmpdir(), `claude-pipeline-test-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

// ─── Test: env detection ──────────────────────────────────────────────────────

console.log("\n── Env detection ────────────────────────────────");

{
  const dir = makeTestDir("env");
  writeFileSync(join(dir, ".env"), "LINEAR_API_KEY=lin_api_test123\n");
  const result = detectFromEnvFiles(dir);
  assert(result?.tool === "linear", "Detects Linear from LINEAR_API_KEY");
  assert(result?.foundIn === ".env", "Reports correct file");
  cleanup(dir);
}

{
  const dir = makeTestDir("env2");
  writeFileSync(join(dir, ".env.local"), "JIRA_API_TOKEN=jira_test123\n");
  const result = detectFromEnvFiles(dir);
  assert(result?.tool === "jira", "Detects Jira from JIRA_API_TOKEN in .env.local");
  cleanup(dir);
}

{
  const dir = makeTestDir("env3");
  writeFileSync(join(dir, ".env"), "CLICKUP_API_TOKEN=pk_test123\n");
  const result = detectFromEnvFiles(dir);
  assert(result?.tool === "clickup", "Detects ClickUp from CLICKUP_API_TOKEN");
  cleanup(dir);
}

{
  const dir = makeTestDir("env4");
  // No env file
  const result = detectFromEnvFiles(dir);
  assert(result === null, "Returns null when no env file found");
  cleanup(dir);
}

// ─── Test: file generation ────────────────────────────────────────────────────

const COMBINATIONS = [
  { pmTool: "linear",   platform: "netlify" },
  { pmTool: "linear",   platform: "vercel" },
  { pmTool: "linear",   platform: "cloudflare" },
  { pmTool: "jira",     platform: "netlify" },
  { pmTool: "asana",    platform: "vercel" },
  { pmTool: "clickup",  platform: "cloudflare" },
  { pmTool: "github_issues", platform: "netlify" }, // platform ignored for GH Issues
];

for (const { pmTool, platform } of COMBINATIONS) {
  console.log(`\n── ${pmTool} + ${platform} ─────────────────────────────`);
  const dir = makeTestDir(`${pmTool}-${platform}`);

  const config = {
    pmTool,
    platform,
    githubRepo: "yuviguru/test-repo",
    triggerEmail: "yuvi@example.com",
    triggerUsername: "yuviguru",
    siteName: "test-pipeline",
    jiraBaseUrl: "https://test.atlassian.net",
    jiraEmail: "yuvi@example.com",
  };

  const { files } = generateFiles({ config, cwd: dir });

  // Every combination should generate the main workflow
  const mainWorkflow = join(dir, ".github/workflows/claude-pipeline.yml");
  assert(existsSync(mainWorkflow), "Generated claude-pipeline.yml");

  const workflowContent = readFileSync(mainWorkflow, "utf8");
  assert(workflowContent.includes("claude-code-action@v1") || workflowContent.includes("issues:"), 
    "Workflow references claude-code-action or issues trigger");

  // Every combination should generate PR review workflow
  const reviewWorkflow = join(dir, ".github/workflows/claude-pr-review.yml");
  assert(existsSync(reviewWorkflow), "Generated claude-pr-review.yml");

  // Every combination should generate .env.example
  const envExample = join(dir, ".env.example");
  assert(existsSync(envExample), "Generated .env.example");

  const envContent = readFileSync(envExample, "utf8");
  assert(envContent.includes("GITHUB_REPO=yuviguru/test-repo"), ".env.example has correct GITHUB_REPO");

  if (pmTool !== "github_issues") {
    // Should generate webhook handler
    const webhookFiles = files.filter(f => 
      f.path.includes("webhook") || f.path.includes("worker")
    );
    assert(webhookFiles.length > 0, "Generated webhook handler");

    // Check handler mentions correct PM tool signature
    const handlerPath = join(dir, webhookFiles[0].path);
    if (existsSync(handlerPath)) {
      const handlerContent = readFileSync(handlerPath, "utf8");
      const hasToolContent =
        handlerContent.includes(pmTool.charAt(0).toUpperCase() + pmTool.slice(1)) ||
        handlerContent.includes(pmTool);
      assert(hasToolContent, "Webhook handler contains PM tool reference");
    }

    // Should generate platform config
    const platformConfigs = {
      netlify: "netlify.toml",
      vercel: "vercel.json",
      cloudflare: "wrangler.toml",
    };
    const configFile = join(dir, platformConfigs[platform]);
    assert(existsSync(configFile), `Generated ${platformConfigs[platform]}`);

  } else {
    // GitHub Issues — no webhook files
    const webhookFiles = files.filter(f => f.path && f.path.includes("webhook"));
    assert(webhookFiles.length === 0, "GitHub Issues: no webhook handler generated");

    // Workflow should use issues trigger
    assert(workflowContent.includes("issues:"), "GitHub Issues workflow uses issues trigger");
    assert(workflowContent.includes("assigned"), "GitHub Issues workflow triggers on assigned");
  }

  // Check no placeholders left in any generated file
  for (const f of files) {
    if (!f.path) continue;
    const abs = join(dir, f.path);
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    const unreplaced = content.match(/\{\{[A-Z_]+\}\}/g);
    assert(!unreplaced, `No unreplaced placeholders in ${f.path}${unreplaced ? `: ${unreplaced.join(", ")}` : ""}`);
  }

  cleanup(dir);
}

// ─── Test: skip existing files ────────────────────────────────────────────────

console.log("\n── Skip existing files ──────────────────────────");
{
  const dir = makeTestDir("skip");
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(join(dir, ".github/workflows/claude-pipeline.yml"), "# existing file\n");

  const config = {
    pmTool: "linear",
    platform: "netlify",
    githubRepo: "owner/repo",
    triggerEmail: "test@test.com",
    siteName: "test-site",
  };

  const { files } = generateFiles({ config, cwd: dir });
  const skipped = files.find(f => f.path === ".github/workflows/claude-pipeline.yml");
  assert(skipped?.skipped === true, "Skips existing claude-pipeline.yml");

  const content = readFileSync(join(dir, ".github/workflows/claude-pipeline.yml"), "utf8");
  assert(content === "# existing file\n", "Existing file content unchanged");
  cleanup(dir);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed  ${failed > 0 ? `${failed} failed` : ""}`);
console.log();

if (failed > 0) process.exit(1);
