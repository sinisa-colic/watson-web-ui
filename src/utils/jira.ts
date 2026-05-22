const ISSUE_KEY_PATTERN = /^([A-Z][A-Z0-9]+-\d+)/i;

export function parseIssueKey(name: string): string | null {
  const match = name.trim().match(ISSUE_KEY_PATTERN);
  return match ? match[1].toUpperCase() : null;
}
