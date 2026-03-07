import type { PMAdapter, PMTool } from "../types.js";
import { LinearAdapter } from "./linear.js";
import { JiraAdapter } from "./jira.js";
import { AsanaAdapter } from "./asana.js";
import { ClickUpAdapter } from "./clickup.js";
import { GitHubIssuesAdapter } from "./github-issues.js";

export const ADAPTERS: Record<PMTool, PMAdapter> = {
  linear: LinearAdapter,
  jira: JiraAdapter,
  asana: AsanaAdapter,
  clickup: ClickUpAdapter,
  github_issues: GitHubIssuesAdapter,
};

export function getAdapter(tool: PMTool): PMAdapter {
  return ADAPTERS[tool];
}

export const PM_TOOL_CHOICES: Array<{ name: string; value: PMTool }> = [
  { name: "Linear", value: "linear" },
  { name: "Jira", value: "jira" },
  { name: "Asana", value: "asana" },
  { name: "ClickUp", value: "clickup" },
  { name: "GitHub Issues (no webhook server needed)", value: "github_issues" },
];
