import type { Platform, PipelineConfig, GeneratedFile } from "../types.js";

export const NetlifyPlatform: Platform = {
  name: "Netlify",
  platform: "netlify",
  webhookPath: "netlify/functions/webhook.ts",

  generateConfig(): GeneratedFile {
    return {
      path: "netlify.toml",
      content: `[build]
  functions = "netlify/functions"
  publish = "public"

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["@netlify/functions"]

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
`,
    };
  },

  deploySteps(config: PipelineConfig) {
    const siteName = (config as unknown as Record<string, string>)["siteName"] ?? "YOUR_SITE";
    return [
      `Install Netlify CLI:  npm install -g netlify-cli`,
      `Login:               netlify login`,
      `Init site:           netlify init  (use site name: ${siteName})`,
      `Set env vars:`,
      `  netlify env:set GITHUB_REPO "${config.githubRepo}"`,
      `  netlify env:set TRIGGER_EMAIL "${config.triggerEmail}"`,
      `  netlify env:set LINEAR_WEBHOOK_SECRET "$(openssl rand -hex 32)"`,
      `  netlify env:set GITHUB_PAT "YOUR_GITHUB_PAT"`,
      `Deploy:              netlify deploy --prod`,
      `Your webhook URL:    https://${siteName}.netlify.app/api/webhook`,
    ];
  },
};
