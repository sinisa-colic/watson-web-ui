/** Duration tracked for a named entity (project, client, etc.). */
export type ProjectTotal = {
  name: string;
  duration: number;
};

export type IntegrationId = "jira" | "hubstaff";

export type ReportDateRange = {
  from: string;
  to: string;
};

/** An item that can appear in the project picker (from any integration). */
export type PickerItem = {
  key: string;
  summary: string;
  status?: string;
  url?: string;
};

/** Time tracked for one day from a single source. */
export type DayReport = {
  date: string;
  totalMs: number;
  byClient: ProjectTotal[];
  byProject: ProjectTotal[];
};

/** A source of tracked time (Watson, Hubstaff per client, …). */
export type SourceReport = {
  id: string;
  label: string;
  totalMs: number;
  byClient: ProjectTotal[];
  byProject: ProjectTotal[];
  daily: DayReport[];
  supportsIssueKeys?: boolean;
  editable?: boolean;
};

/** Merged day across all sources. */
export type UnifiedDaySummary = {
  key: string;
  label: string;
  totalMs: number;
  sources: Array<{
    id: string;
    label: string;
    totalMs: number;
    byClient: ProjectTotal[];
    byProject: ProjectTotal[];
    supportsIssueKeys?: boolean;
  }>;
};

/** Shared metadata for API-backed integrations (frontend-safe subset). */
export type ApiIntegrationDefinition = {
  id: IntegrationId;
  label: string;
  apiPrefix: `/api/${IntegrationId}`;
};

/** Wire-format types from the Hubstaff API response. */
export type HubstaffProjectTotal = {
  projectId: number;
  name: string;
  seconds: number;
};

export type HubstaffDailyEntry = {
  date: string;
  totalSeconds: number;
  projects: HubstaffProjectTotal[];
};

export type HubstaffReport = {
  configured: boolean;
  totalSeconds: number;
  daily: HubstaffDailyEntry[];
  projects: HubstaffProjectTotal[];
};

export type HubstaffProjectOption = {
  projectId: number;
  name: string;
};

export type HubstaffTaskOption = {
  taskId: number;
  projectId: number;
  summary: string;
  projectName: string;
};
