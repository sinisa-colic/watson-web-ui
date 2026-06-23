#!/usr/bin/env node
/**
 * Scan git-tracked files for likely secrets / PII.
 * Local-only files (.env, clients.config.ts) are gitignored and not scanned here.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED_EMAILS = new Set([
  "you@example.com",
  "me@example.com",
  "user@example.com"
]);

const RULES = [
  {
    name: "Atlassian API token",
    pattern: /ATATT3x[A-Za-z0-9_=\-+/]{20,}/
  },
  {
    name: "JWT / refresh token",
    pattern: /eyJ0e[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
  },
  {
    name: "Assigned secret env value",
    pattern: /(?:API_TOKEN|REFRESH_TOKEN|JIRA_API_TOKEN|HUBSTAFF_REFRESH_TOKEN)\s*=\s*\S{8,}/
  },
  {
    name: "Personal email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    test(line) {
      const match = line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      if (!match) {
        return false;
      }
      return !ALLOWED_EMAILS.has(match[0].toLowerCase());
    }
  }
];

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

const findings = [];

for (const file of trackedFiles()) {
  if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".webp")) {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    for (const rule of RULES) {
      const matched = rule.test ? rule.test(line) : rule.pattern.test(line);
      if (!matched) {
        continue;
      }

      if (rule.name === "Personal email" && /example\.(com|org|net)/i.test(line)) {
        continue;
      }

      if (rule.name === "Assigned secret env value" && /(your_|example|changeme|placeholder|read_only|personal_refresh|<|\*\*)/i.test(line)) {
        continue;
      }

      findings.push({
        file,
        line: index + 1,
        rule: rule.name,
        preview: line.trim().slice(0, 120)
      });
    }
  }
}

if (findings.length) {
  console.error("check:secrets failed — likely PII or credentials in tracked files:\n");
  for (const item of findings) {
    console.error(`  ${item.file}:${item.line} [${item.rule}]`);
    console.error(`    ${item.preview}\n`);
  }
  process.exit(1);
}

console.log("check:secrets OK — no secret patterns in tracked files.");
