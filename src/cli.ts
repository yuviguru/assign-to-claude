#!/usr/bin/env node

import chalk from "chalk";
import { runInit } from "./commands/init.js";

const VERSION = "0.1.3";

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    process.exit(0);
  }

  if (command === "--help" || command === "-h" || !command) {
    printHelp();
    process.exit(0);
  }

  if (command === "init") {
    const force = args.includes("--force") || args.includes("-f");
    await runInit({ force });
    return;
  }

  console.log(chalk.red(`  Unknown command: ${command}`));
  console.log();
  printHelp();
  process.exit(1);
}

function printHelp(): void {
  console.log();
  console.log(chalk.bold("  assign-to-claude"));
  console.log(chalk.dim("  Connect any PM tool to Claude Code. Assign a ticket, get a PR."));
  console.log();
  console.log(chalk.bold("  Usage"));
  console.log();
  console.log(`    ${chalk.cyan("assign-to-claude init")}           Set up pipeline in current project`);
  console.log(`    ${chalk.cyan("assign-to-claude init --force")}  Regenerate all files (overwrites existing)`);
  console.log(`    ${chalk.cyan("assign-to-claude --version")}     Show version`);
  console.log(`    ${chalk.cyan("assign-to-claude --help")}        Show this help`);
  console.log();
  console.log(chalk.bold("  Supported PM tools"));
  console.log();
  console.log("    Linear  ·  Jira  ·  Asana  ·  ClickUp  ·  GitHub Issues");
  console.log();
  console.log(chalk.bold("  Supported platforms"));
  console.log();
  console.log("    Netlify  ·  Vercel  ·  Cloudflare Workers");
  console.log();
  console.log(chalk.bold("  Install globally"));
  console.log();
  console.log(`    npm install -g assign-to-claude`);
  console.log(`    pnpm add -g assign-to-claude`);
  console.log();
  console.log(chalk.bold("  Or run without installing"));
  console.log();
  console.log(`    npx assign-to-claude init`);
  console.log();
}

main().catch((err: unknown) => {
  console.error(chalk.red("  Error:"), err instanceof Error ? err.message : String(err));
  process.exit(1);
});
