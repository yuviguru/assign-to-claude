import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { PMTool } from "../types.js";

// ─── Env file candidates (in priority order) ──────────────────────────────────

const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.example",
];

// ─── Token → PM tool mapping ──────────────────────────────────────────────────

const TOKEN_KEYS: Record<string, PMTool> = {
  // Linear
  LINEAR_API_KEY: "linear",
  LINEAR_WEBHOOK_SECRET: "linear",
  LINEAR_TOKEN: "linear",

  // Jira
  JIRA_API_TOKEN: "jira",
  JIRA_TOKEN: "jira",
  JIRA_BASE_URL: "jira",

  // Asana
  ASANA_ACCESS_TOKEN: "asana",
  ASANA_TOKEN: "asana",
  ASANA_PAT: "asana",

  // ClickUp
  CLICKUP_API_TOKEN: "clickup",
  CLICKUP_TOKEN: "clickup",

  // GitHub Issues
  GITHUB_TOKEN: "github_issues",
  GITHUB_PAT: "github_issues",
};

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

// ─── Detection ────────────────────────────────────────────────────────────────

export interface DetectedEnv {
  tool: PMTool;
  foundIn: string;
  key: string;
}

export function detectFromEnvFiles(cwd: string = process.cwd()): DetectedEnv | null {
  for (const filename of ENV_FILES) {
    const filepath = join(cwd, filename);
    if (!existsSync(filepath)) continue;

    const vars = parseEnvFile(readFileSync(filepath, "utf8"));

    for (const [key, tool] of Object.entries(TOKEN_KEYS)) {
      if (vars[key] && vars[key].length > 0) {
        return { tool, foundIn: filename, key };
      }
    }
  }

  return null;
}

export function readEnvValue(key: string, cwd: string = process.cwd()): string | null {
  for (const filename of ENV_FILES) {
    const filepath = join(cwd, filename);
    if (!existsSync(filepath)) continue;
    const vars = parseEnvFile(readFileSync(filepath, "utf8"));
    if (vars[key]) return vars[key];
  }
  return null;
}
