/**
 * Returns true if we're running in a CI environment.
 * Used to skip interactive prompts when npm install runs in CI.
 */
export function isCI(): boolean {
  return (
    process.env["CI"] === "true" ||
    process.env["GITHUB_ACTIONS"] === "true" ||
    process.env["CIRCLECI"] === "true" ||
    process.env["TRAVIS"] === "true" ||
    process.env["GITLAB_CI"] === "true" ||
    process.env["JENKINS_URL"] !== undefined ||
    !process.stdout.isTTY
  );
}

/**
 * Exit cleanly if running in CI — no error, no broken install.
 */
export function guardCI(): void {
  if (isCI()) {
    console.log(
      "claude-pipeline: CI environment detected — skipping interactive setup."
    );
    console.log(
      "Run `npx claude-pipeline init` locally to set up your pipeline."
    );
    process.exit(0);
  }
}
