import type { PMAdapter, GeneratedFile } from "../types.js";

export const JiraAdapter: PMAdapter = {
  name: "Jira",
  tool: "jira",
  envKeys: ["JIRA_API_TOKEN", "JIRA_TOKEN", "JIRA_BASE_URL"],

  extraQuestions: [
    {
      name: "jiraBaseUrl",
      message: "Your Jira base URL (e.g. https://yourcompany.atlassian.net):",
      validate: (v) => (v.startsWith("https://") ? true : "Must start with https://"),
    },
    {
      name: "jiraEmail",
      message: "Your Jira account email:",
      validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
    },
    {
      name: "triggerEmail",
      message: "Email that triggers the pipeline when a ticket is assigned to it:",
      validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
    },
  ],

  envVars: [
    { key: "JIRA_WEBHOOK_SECRET", comment: "Secret you set when creating the Jira webhook" },
    { key: "JIRA_BASE_URL", comment: "e.g. https://yourcompany.atlassian.net" },
    { key: "GITHUB_PAT", comment: "Fine-grained PAT — contents/PRs/actions/issues write" },
    { key: "GITHUB_REPO", comment: "owner/repo format" },
    { key: "TRIGGER_EMAIL", comment: "Pipeline fires only when assigned to this email" },
  ],

  generateWebhookHandler(_config): GeneratedFile {
    return {
      path: "webhook/jira.ts",
      content: `import crypto from "crypto";

interface JiraIssueFields {
  summary: string;
  description?: string;
  assignee?: { emailAddress: string; displayName: string };
  labels?: string[];
  priority?: { name: string };
}
interface JiraWebhookPayload {
  webhookEvent: string;
  issue: { key: string; fields: JiraIssueFields };
  changelog?: {
    items: Array<{ field: string; fromString?: string; toString?: string }>;
  };
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(signature.replace("sha256=", ""), "hex")
    );
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
    body: JSON.stringify({ event_type: "jira-issue", client_payload: payload }),
  });
  if (!res.ok) throw new Error(\`GitHub API \${res.status}: \${await res.text()}\`);
}

export async function handleJiraWebhook(
  body: string,
  signature: string,
  env: { JIRA_WEBHOOK_SECRET: string; GITHUB_PAT: string; GITHUB_REPO: string; TRIGGER_EMAIL?: string }
): Promise<{ status: number; body: string }> {
  if (!verifySignature(body, signature, env.JIRA_WEBHOOK_SECRET)) {
    return { status: 401, body: "Invalid signature" };
  }

  let payload: JiraWebhookPayload;
  try { payload = JSON.parse(body) as JiraWebhookPayload; }
  catch { return { status: 400, body: "Invalid JSON" }; }

  if (payload.webhookEvent !== "jira:issue_updated") {
    return { status: 200, body: \`Ignored: \${payload.webhookEvent}\` };
  }

  const assigneeChange = payload.changelog?.items.find((i) => i.field === "assignee");
  if (!assigneeChange || !payload.issue.fields.assignee) {
    return { status: 200, body: "Ignored: not an assignee change" };
  }

  const assignee = payload.issue.fields.assignee;
  if (env.TRIGGER_EMAIL && assignee.emailAddress !== env.TRIGGER_EMAIL) {
    return { status: 200, body: \`Ignored: assigned to \${assignee.emailAddress}\` };
  }

  const issueKey = payload.issue.key;
  console.log(\`Triggering pipeline for [\${issueKey}] "\${payload.issue.fields.summary}"\`);

  try {
    await triggerGitHub(
      {
        issue_id: issueKey,
        title: payload.issue.fields.summary,
        description: payload.issue.fields.description ?? "",
        labels: payload.issue.fields.labels ?? [],
        priority: payload.issue.fields.priority?.name,
      },
      env.GITHUB_PAT,
      env.GITHUB_REPO
    );
    return { status: 200, body: JSON.stringify({ triggered: true, issue: issueKey }) };
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
      `Go to Jira → Settings → System → Webhooks → Create webhook`,
      `  URL: https://${config["siteName"] ?? "YOUR_SITE"}/api/webhook`,
      `  Events: Issue updated → check "Assignee changed"`,
    ];
  },
};
