// ─── PM Tool Types ────────────────────────────────────────────────────────────

export type PMTool =
  | "linear"
  | "jira"
  | "asana"
  | "clickup"
  | "github_issues";

export type HostingPlatform =
  | "netlify"
  | "vercel"
  | "cloudflare";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  pmTool: PMTool;
  platform: HostingPlatform;
  githubRepo: string;       // owner/repo
  triggerEmail: string;     // email that triggers the pipeline when assigned
  netlifysite?: string;     // site name for netlify/vercel/cloudflare
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface PMAdapter {
  /** Display name shown to user */
  name: string;

  /** Short identifier */
  tool: PMTool;

  /** Env var names that identify this tool in an env file */
  envKeys: string[];

  /** Questions specific to this PM tool (after common questions) */
  extraQuestions: AdapterQuestion[];

  /** Webhook files to generate */
  generateWebhookHandler(config: PipelineConfig & Record<string, string>): GeneratedFile;

  /** Env vars to put in .env.example */
  envVars: EnvVar[];

  /** Manual steps specific to this PM tool */
  manualSteps(config: PipelineConfig & Record<string, string>): string[];
}

// ─── Platform Interface ───────────────────────────────────────────────────────

export interface Platform {
  name: string;
  platform: HostingPlatform;

  /** Config files needed (netlify.toml, vercel.json, wrangler.toml) */
  generateConfig(): GeneratedFile;

  /** Webhook function file path for this platform */
  webhookPath: string;

  /** Install + deploy instructions */
  deploySteps(config: PipelineConfig): string[];
}

// ─── Generated File ───────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
}

// ─── Question ─────────────────────────────────────────────────────────────────

export interface AdapterQuestion {
  name: string;
  message: string;
  validate?: (input: string) => true | string;
}

// ─── Env Var ─────────────────────────────────────────────────────────────────

export interface EnvVar {
  key: string;
  comment: string;
  value?: string; // placeholder value
}
