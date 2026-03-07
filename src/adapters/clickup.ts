import type { PMAdapter, GeneratedFile } from "../types.js";

export const ClickUpAdapter: PMAdapter = {
  name: "ClickUp",
  tool: "clickup",
  envKeys: ["CLICKUP_API_TOKEN", "CLICKUP_TOKEN"],

  extraQuestions: [
    {
      name: "triggerEmail",
      message: "Your ClickUp email (pipeline fires when a task is assigned to you):",
      validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
    },
  ],

  envVars: [
    { key: "CLICKUP_WEBHOOK_SECRET", comment: "Set when creating the webhook in ClickUp" },
    { key: "GITHUB_PAT", comment: "Fine-grained PAT — contents/PRs/actions/issues write" },
    { key: "GITHUB_REPO", comment: "owner/repo format" },
    { key: "TRIGGER_EMAIL", comment: "Pipeline fires only when assigned to this email" },
  ],

  generateWebhookHandler(_config): GeneratedFile {
    return {
      path: "webhook/clickup.ts",
      content: `import crypto from "crypto";

interface ClickUpAssignee { id: number; email: string; username: string }
interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  assignees?: ClickUpAssignee[];
  tags?: Array<{ name: string }>;
  priority?: { priority: string };
}
interface ClickUpWebhookPayload {
  event: string;
  task_id?: string;
  history_items?: Array<{
    field: string;
    after?: { id: number; email?: string; username?: string };
  }>;
  task?: ClickUpTask;
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
    body: JSON.stringify({ event_type: "clickup-issue", client_payload: payload }),
  });
  if (!res.ok) throw new Error(\`GitHub API \${res.status}: \${await res.text()}\`);
}

export async function handleClickUpWebhook(
  body: string,
  signature: string,
  env: { CLICKUP_WEBHOOK_SECRET: string; GITHUB_PAT: string; GITHUB_REPO: string; TRIGGER_EMAIL?: string }
): Promise<{ status: number; body: string }> {
  if (!verifySignature(body, signature, env.CLICKUP_WEBHOOK_SECRET)) {
    return { status: 401, body: "Invalid signature" };
  }

  let payload: ClickUpWebhookPayload;
  try { payload = JSON.parse(body) as ClickUpWebhookPayload; }
  catch { return { status: 400, body: "Invalid JSON" }; }

  if (payload.event !== "taskAssigneeUpdated") {
    return { status: 200, body: \`Ignored: \${payload.event}\` };
  }

  const assigneeChange = payload.history_items?.find((i) => i.field === "assignee_add");
  if (!assigneeChange?.after) {
    return { status: 200, body: "Ignored: no assignee added" };
  }

  if (env.TRIGGER_EMAIL && assigneeChange.after.email !== env.TRIGGER_EMAIL) {
    return { status: 200, body: \`Ignored: assigned to \${assigneeChange.after.email}\` };
  }

  const task = payload.task;
  const taskId = payload.task_id ?? "unknown";
  console.log(\`Triggering pipeline for task [\${taskId}] "\${task?.name}"\`);

  try {
    await triggerGitHub(
      {
        issue_id: taskId,
        title: task?.name ?? taskId,
        description: task?.description ?? "",
        labels: (task?.tags ?? []).map((t) => t.name),
        priority: task?.priority?.priority,
      },
      env.GITHUB_PAT,
      env.GITHUB_REPO
    );
    return { status: 200, body: JSON.stringify({ triggered: true, task: taskId }) };
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
      `Go to ClickUp → Settings → Integrations → Webhooks → Add webhook`,
      `  URL: https://${config["siteName"] ?? "YOUR_SITE"}/api/webhook`,
      `  Events: taskAssigneeUpdated only`,
      `  Copy the webhook secret → set as CLICKUP_WEBHOOK_SECRET`,
    ];
  },
};
