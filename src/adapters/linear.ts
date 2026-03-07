import type { PMAdapter, GeneratedFile } from "../types.js";

export const LinearAdapter: PMAdapter = {
  name: "Linear",
  tool: "linear",
  envKeys: ["LINEAR_API_KEY", "LINEAR_WEBHOOK_SECRET", "LINEAR_TOKEN"],

  extraQuestions: [
    {
      name: "triggerEmail",
      message: "Your email in Linear (pipeline fires when a ticket is assigned to you):",
      validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
    },
  ],

  envVars: [
    { key: "LINEAR_WEBHOOK_SECRET", comment: "Generated when you create the webhook in Linear" },
    { key: "GITHUB_PAT", comment: "Fine-grained PAT — contents/PRs/actions/issues write" },
    { key: "GITHUB_REPO", comment: "owner/repo format" },
    { key: "TRIGGER_EMAIL", comment: "Pipeline fires only when assigned to this email" },
  ],

  generateWebhookHandler(_config): GeneratedFile {
    return {
      path: "webhook/linear.ts",
      content: `import crypto from "crypto";

interface LinearLabel { id: string; name: string }
interface LinearAssignee { id: string; name: string; email?: string }
interface LinearIssueData {
  id: string;
  identifier?: string;
  title?: string;
  description?: string;
  assignee?: LinearAssignee;
  labels?: LinearLabel[];
  priority?: number;
}
interface LinearWebhookPayload {
  action: string;
  type: string;
  data: LinearIssueData;
  updatedFrom?: { assigneeId?: string };
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch { return false; }
}

async function triggerGitHub(payload: object, pat: string, repo: string): Promise<void> {
  const res = await fetch(\`https://api.github.com/repos/\${repo}/dispatches\`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: \`Bearer \${pat}\`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ event_type: "linear-issue", client_payload: payload }),
  });
  if (!res.ok) throw new Error(\`GitHub API \${res.status}: \${await res.text()}\`);
}

// ─── Handler (platform-agnostic core) ────────────────────────────────────────

export async function handleLinearWebhook(
  body: string,
  signature: string,
  env: { LINEAR_WEBHOOK_SECRET: string; GITHUB_PAT: string; GITHUB_REPO: string; TRIGGER_EMAIL?: string }
): Promise<{ status: number; body: string }> {
  if (!verifySignature(body, signature, env.LINEAR_WEBHOOK_SECRET)) {
    return { status: 401, body: "Invalid signature" };
  }

  let payload: LinearWebhookPayload;
  try { payload = JSON.parse(body) as LinearWebhookPayload; }
  catch { return { status: 400, body: "Invalid JSON" }; }

  const { action, type, data, updatedFrom } = payload;
  if (type !== "Issue" || action !== "update") {
    return { status: 200, body: \`Ignored: \${type}/\${action}\` };
  }
  if (!updatedFrom?.assigneeId || !data.assignee) {
    return { status: 200, body: "Ignored: not an assignment change" };
  }
  if (env.TRIGGER_EMAIL && data.assignee.email !== env.TRIGGER_EMAIL) {
    return { status: 200, body: \`Ignored: assigned to \${data.assignee.email}\` };
  }

  const issueId = data.identifier ?? data.id;
  console.log(\`Triggering pipeline for [\${issueId}] "\${data.title}"\`);

  try {
    await triggerGitHub(
      {
        issue_id: issueId,
        title: data.title ?? "Untitled",
        description: data.description ?? "",
        labels: (data.labels ?? []).map((l) => l.name),
        priority: data.priority,
      },
      env.GITHUB_PAT,
      env.GITHUB_REPO
    );
    return { status: 200, body: JSON.stringify({ triggered: true, issue: issueId }) };
  } catch (err) {
    console.error("Failed to trigger GitHub Action:", err);
    return { status: 500, body: \`Failed: \${err instanceof Error ? err.message : "Unknown"}\` };
  }
}
`,
    };
  },

  manualSteps(config) {
    return [
      `Go to Linear → Settings → API → Webhooks → New webhook`,
      `  URL: https://${config["siteName"] ?? "YOUR_SITE"}/api/webhook`,
      `  Secret: use the value of LINEAR_WEBHOOK_SECRET in your .env`,
      `  Events: Issue updates only — uncheck everything else`,
    ];
  },
};
