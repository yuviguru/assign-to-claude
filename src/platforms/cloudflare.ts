import type { Platform, PipelineConfig, GeneratedFile } from "../types.js";

export const CloudflarePlatform: Platform = {
  name: "Cloudflare Workers",
  platform: "cloudflare",
  webhookPath: "src/worker.ts",

  generateConfig(): GeneratedFile {
    return {
      path: "wrangler.toml",
      content: `name = "claude-pipeline-webhook"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[vars]
# Set secrets via: wrangler secret put SECRET_NAME
# Required: LINEAR_WEBHOOK_SECRET, GITHUB_PAT, GITHUB_REPO, TRIGGER_EMAIL
`,
    };
  },

  deploySteps(_config: PipelineConfig) {
    return [
      `Install Wrangler:   npm install -g wrangler`,
      `Login:              wrangler login`,
      `Set secrets:`,
      `  wrangler secret put GITHUB_REPO`,
      `  wrangler secret put TRIGGER_EMAIL`,
      `  wrangler secret put LINEAR_WEBHOOK_SECRET`,
      `  wrangler secret put GITHUB_PAT`,
      `Deploy:             wrangler deploy`,
      `Your webhook URL:   shown after deploy (*.workers.dev)`,
      ``,
      `Note: Cloudflare Workers use Web Crypto API (not Node crypto).`,
      `The generated handler uses crypto.subtle — no changes needed.`,
    ];
  },
};
