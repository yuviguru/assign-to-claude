import chalk from "chalk";
import { select, input, confirm } from "@inquirer/prompts";
import { detectFromEnvFiles } from "../utils/detect-env.js";
import { guardCI } from "../utils/ci-guard.js";
import { PM_TOOL_CHOICES, getAdapter } from "../adapters/index.js";
import { PLATFORM_CHOICES, getPlatform } from "../platforms/index.js";
import { generateFiles } from "../templates/generate.js";
import type { PipelineConfig, PMTool, HostingPlatform } from "../types.js";

export async function runInit(): Promise<void> {
  // Block in CI environments
  guardCI();

  console.log();
  console.log(chalk.bold("  assign-to-claude") + chalk.dim("  ·  connect any PM tool to Claude Code"));
  console.log();

  const cwd = process.cwd();

  // ─── Step 1: Detect or ask PM tool ────────────────────────────────────────

  let pmTool: PMTool;
  const detected = detectFromEnvFiles(cwd);

  if (detected) {
    console.log(
      chalk.dim(`  Found ${chalk.white(detected.key)} in ${chalk.white(detected.foundIn)}`)
    );
    const confirmed = await confirm({
      message: `  PM tool detected: ${chalk.cyan(detected.tool)} — use this?`,
      default: true,
    });
    pmTool = confirmed
      ? detected.tool
      : await select({ message: "  Select your PM tool:", choices: PM_TOOL_CHOICES });
  } else {
    pmTool = await select({ message: "  Which PM tool do you use?", choices: PM_TOOL_CHOICES });
  }

  // ─── Step 2: Hosting platform (skip for GitHub Issues) ────────────────────

  let platform: HostingPlatform | null = null;

  if (pmTool !== "github_issues") {
    platform = await select({
      message: "  Where will you host the webhook server?",
      choices: PLATFORM_CHOICES,
    });
  } else {
    console.log(
      chalk.dim("  GitHub Issues → no webhook server needed. Triggered directly by GitHub Actions.")
    );
  }

  // ─── Step 3: GitHub repo ──────────────────────────────────────────────────

  const githubRepo = await input({
    message: "  GitHub repo (owner/repo):",
    validate: (v) => {
      if (!v.includes("/")) return "Format must be owner/repo (e.g. yuviguru/my-app)";
      const parts = v.split("/");
      if (parts.length !== 2 || !parts[0] || !parts[1]) return "Format must be owner/repo";
      return true;
    },
  });

  // ─── Step 4: Adapter-specific questions ───────────────────────────────────

  const adapter = getAdapter(pmTool);
  const extraAnswers: Record<string, string> = {};

  for (const q of adapter.extraQuestions) {
    extraAnswers[q.name] = await input({
      message: `  ${q.message}`,
      validate: q.validate,
    });
  }

  // ─── Step 5: Site name (if platform needs it) ─────────────────────────────

  let siteName: string | undefined;

  if (platform) {
    const platformInfo = getPlatform(platform);
    siteName = await input({
      message: `  ${platformInfo.name} site name (becomes https://SITE_NAME.${platformDomain(platform)}):`,
      validate: (v) => (v.length > 0 ? true : "Required"),
    });
  }

  // ─── Step 6: Confirm ──────────────────────────────────────────────────────

  const config: PipelineConfig & Record<string, string> = {
    pmTool,
    platform: platform ?? "netlify",
    githubRepo,
    triggerEmail: extraAnswers["triggerEmail"] ?? "",
    ...extraAnswers,
    ...(siteName ? { siteName } : {}),
  };

  console.log();
  console.log(chalk.bold("  Summary"));
  console.log(chalk.dim("  ──────────────────────────────────"));
  console.log(`  PM tool:   ${chalk.cyan(adapter.name)}`);
  if (platform) console.log(`  Platform:  ${chalk.cyan(getPlatform(platform).name)}`);
  console.log(`  Repo:      ${chalk.cyan(githubRepo)}`);
  if (config["triggerEmail"]) console.log(`  Trigger:   ${chalk.cyan(config["triggerEmail"])}`);
  if (siteName) console.log(`  Site:      ${chalk.cyan(siteName)}`);
  console.log();

  const ok = await confirm({ message: "  Generate files?", default: true });
  if (!ok) {
    console.log(chalk.dim("  Cancelled."));
    return;
  }

  // ─── Step 7: Generate files ───────────────────────────────────────────────

  console.log();
  const { files } = generateFiles({ config, cwd });

  for (const f of files) {
    if (!f.path) continue;
    if (f.skipped) {
      console.log(`  ${chalk.yellow("⚠")}  ${chalk.dim(f.path)} (already exists — skipped)`);
    } else {
      console.log(`  ${chalk.green("✓")}  ${f.path}`);
    }
  }

  // ─── Step 8: Print manual steps ───────────────────────────────────────────

  console.log();
  console.log(chalk.bold("  Next steps"));
  console.log(chalk.dim("  ──────────────────────────────────"));
  console.log();

  if (platform) {
    const platformInfo = getPlatform(platform);
    const steps = platformInfo.deploySteps(config);
    steps.forEach((s, i) => {
      if (s === "") { console.log(); return; }
      if (i === 0 || steps[i - 1] === "") {
        console.log(`  ${chalk.bold(s)}`);
      } else {
        console.log(`  ${s}`);
      }
    });
    console.log();
  }

  const adapterSteps = adapter.manualSteps(config);
  adapterSteps.forEach((s) => console.log(`  ${s}`));

  console.log();
  console.log(`  ${chalk.bold("Add Claude Code OAuth token to GitHub Secrets:")}`);
  console.log(`    claude setup-token`);
  console.log(`    → add output as CLAUDE_CODE_OAUTH_TOKEN in github.com/${githubRepo}/settings/secrets`);
  console.log();
  console.log(`  ${chalk.bold("Push files to main:")}`);
  console.log(`    git add . && git commit -m "feat: add claude pipeline" && git push origin main`);
  console.log();
  console.log(
    chalk.dim("  Tip: fill in .claude/CLAUDE.md with your stack and conventions") +
    chalk.dim(" — it's read at the start of every automated task.")
  );
  console.log();
  console.log(chalk.green("  Done. Assign a ticket to yourself and watch the PR appear."));
  console.log();
}

function platformDomain(platform: HostingPlatform): string {
  const map: Record<HostingPlatform, string> = {
    netlify: "netlify.app",
    vercel: "vercel.app",
    cloudflare: "workers.dev",
  };
  return map[platform];
}
