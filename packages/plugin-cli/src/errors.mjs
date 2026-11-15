export class BuildError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "BuildError";
    this.issues = issues;
  }
}

export function formatIssue(issue) {
  const where = issue.file ? `${issue.file}${issue.line ? `:${issue.line}${issue.column ? `:${issue.column}` : ""}` : ""}: ` : issue.path ? `${issue.path}: ` : "";
  return `${where}${issue.message}${issue.code ? ` [${issue.code}]` : ""}`;
}
