import type { ApiIntegrationDefinition } from "../types.js";

export type ClientJiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  jql: string;
};

export type ResolvedJiraConfig = ClientJiraConfig & {
  clientKey: string;
};

export type IssueTrackerIssue = {
  key: string;
  summary: string;
  status: string;
  url: string;
};

const DEFAULT_JQL = "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC";
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;

export function normalizeJiraConfig(jira: ClientJiraConfig | undefined): ClientJiraConfig | undefined {
  if (!jira) {
    return undefined;
  }

  const baseUrl = jira.baseUrl.trim();
  const email = jira.email.trim();
  const apiToken = jira.apiToken.trim();
  const jql = jira.jql.trim() || DEFAULT_JQL;

  const values = [baseUrl, email, apiToken];
  const filled = values.filter(Boolean).length;

  if (filled === 0) {
    return undefined;
  }

  if (filled !== 3) {
    throw new Error("Jira config must include baseUrl, email, and apiToken together, or leave all empty.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    email,
    apiToken,
    jql
  };
}

export function isJiraConfigured(config: ClientJiraConfig | undefined): config is ClientJiraConfig {
  return Boolean(config?.baseUrl && config.email && config.apiToken);
}

export function parseIssueKey(name: string): string | null {
  const match = name.trim().match(/^([A-Z][A-Z0-9]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

export function looksLikeIssueKey(value: string): boolean {
  return ISSUE_KEY_PATTERN.test(value.trim());
}

export const jiraDefinition = {
  id: "jira" as const,
  label: "Jira",
  apiPrefix: "/api/jira" as const
} satisfies ApiIntegrationDefinition;
