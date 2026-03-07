import type { PMAdapter, GeneratedFile } from "../types.js";

export const AsanaAdapter: PMAdapter = {
  name: "Asana",
  tool: "asana",
  envKeys: ["ASANA_ACCESS_TOKEN", "ASANA_TOKEN", "ASANA_PAT"],

  extraQuestions: [
    {
      name: "triggerEmail",
      message: "Your Asana account email (pipeline fires when a task is assigned to you):",
      validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
    },
  ],

  envVars: [
    { key: "ASANA_WEBHOOK_SECRET", comment: "Returned by Asana when you create the webhook (X-Hook-Secret)" },
    { key: "GITHUB_PAT", comment: "Fine-grained PAT — contents/PRs/actions/issues write" },
    { key: "GITHUB_REPO", comment: "owner/repo format" },
    { key: "TRIGGER_EMAIL", comment: "Pipeline fires only when assigned to this email" },
  ],

  generateWebhookHandler(_config): GeneratedFile {
    return {
      path: "webhook/asana.ts",
      content: `import crypto from "crypto";

interface AsanaEvent {
  action: string;
  resource: { gid: string; resource_type: string; name?: string };
  change?: { field: string; new_value?: { gid: string; email?: string; name?: string } };
  parent?: { gid: string; resource_type: string };
}
interface AsanaWebhookPayload {
  events: AsanaEvent[];
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
    body: JSON.stringify({ event_type: "asana-issue", client_payload: payload }),
  });
  if (!res.ok) throw new Error(\`GitHub API \${res.status}: \${await res.text()}\`);
}

export async function handleAsanaWebhook(
  body: string,
  signature: string,
  hookSecret: string | null,
  env: { ASANA_WEBHOOK_SECRET: string; GITHUB_PAT: string; GITHUB_REPO: string; TRIGGER_EMAIL?: string }
): Promise<{ status: number; body: string; handshakeSecret?: string }> {
  // Asana handshake — first request establishes the secret
  if (hookSecret) {
    return { status: 200, body: "", handshakeSecret: hookSecret };
  }

  if (!verifySignature(body, signature, env.ASANA_WEBHOOK_SECRET)) {
    return { status: 401, body: "Invalid signature" };
  }

  let payload: AsanaWebhookPayload;
  try { payload = JSON.parse(body) as AsanaWebhookPayload; }
  catch { return { status: 400, body: "Invalid JSON" }; }

  for (const event of payload.events) {
    if (
      event.action !== "changed" ||
      event.change?.field !== "assignee" ||
      !event.change.new_value
    ) continue;

    const assignee = event.change.new_value;
    if (env.TRIGGER_EMAIL && assignee.email !== env.TRIGGER_EMAIL) continue;

    const taskId = event.resource.gid;
    const title = event.resource.name ?? taskId;
    console.log(\`Triggering pipeline for task [\${taskId}] "\${title}"\`);

    await triggerGitHub(
      { issue_id: taskId, title, description: "", labels: [] },
      env.GITHUB_PAT,
      env.GITHUB_REPO
    );
  }

  return { status: 200, body: "OK" };
}
`,
    };
  },

  manualSteps(config) {
    return [
      `Create the Asana webhook via their API (Asana has no UI for webhooks):`,
      `  curl -X POST https://app.asana.com/api/1.0/webhooks \\`,
      `    -H "Authorization: Bearer YOUR_ASANA_TOKEN" \\`,
      `    -d "resource=PROJECT_GID&target=https://${config["siteName"] ?? "YOUR_SITE"}/api/webhook"`,
      `  Copy the X-Hook-Secret from the response → set as ASANA_WEBHOOK_SECRET`,
    ];
  },
};
