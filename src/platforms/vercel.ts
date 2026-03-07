import type { Platform, PipelineConfig, GeneratedFile } from "../types.js";

export const VercelPlatform: Platform = {
  name: "Vercel",
  platform: "vercel",
  webhookPath: "api/webhook.ts",

  generateConfig(): GeneratedFile {
    return {
      path: "vercel.json",
      content: JSON.stringify(
        {
          functions: {
            "api/webhook.ts": { runtime: "@vercel/node" },
          },
        },
        null,
        2
      ) + "\n",
    };
  },

  deploySteps(config: PipelineConfig) {
    const siteName = (config as unknown as Record<string, string>)["siteName"] ?? "YOUR_SITE";
    return [
      `Install Vercel CLI:  npm install -g vercel`,
      `Login:              vercel login`,
      `Init project:       vercel  (link to project: ${siteName})`,
      `Set env vars:`,
      `  vercel env add GITHUB_REPO`,
      `  vercel env add TRIGGER_EMAIL`,
      `  vercel env add LINEAR_WEBHOOK_SECRET`,
      `  vercel env add GITHUB_PAT`,
      `Deploy:             vercel --prod`,
      `Your webhook URL:   https://${siteName}.vercel.app/api/webhook`,
    ];
  },
};
