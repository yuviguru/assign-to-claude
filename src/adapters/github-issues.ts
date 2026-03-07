import type { PMAdapter, GeneratedFile } from "../types.js";

// GitHub Issues triggers directly via GitHub Actions — no webhook server needed.
// The workflow uses `on: issues: types: [assigned]` and reads github.event.issue directly.

export const GitHubIssuesAdapter: PMAdapter = {
  name: "GitHub Issues",
  tool: "github_issues",
  envKeys: ["GITHUB_TOKEN", "GITHUB_PAT"],

  extraQuestions: [
    {
      name: "triggerUsername",
      message: "Your GitHub username (pipeline fires when an issue is assigned to you):",
      validate: (v) => (v.length > 0 ? true : "Required"),
    },
  ],

  envVars: [
    { key: "CLAUDE_CODE_OAUTH_TOKEN", comment: "Run: claude setup-token — add output to GitHub Secrets" },
  ],

  generateWebhookHandler(_config): GeneratedFile {
    // No server-side handler needed for GitHub Issues
    return {
      path: "",
      content: "",
    };
  },

  manualSteps(config) {
    return [
      `GitHub Issues triggers directly via GitHub Actions — no webhook server needed.`,
      `The workflow file handles everything when an issue is assigned to ${config["triggerUsername"] ?? "you"}.`,
    ];
  },
};
