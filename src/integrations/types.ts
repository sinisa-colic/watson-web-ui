export type IntegrationKind = "issue-tracker" | "time-tracker";

export type IntegrationId = "jira" | "hubstaff";

export type IntegrationClientFlags = {
  jiraConfigured: boolean;
  hubstaffConfigured: boolean;
};

export type IntegrationEnabledCounts = {
  jiraEnabledClientCount: number;
  hubstaffEnabledClientCount: number;
};

export type IssueTrackerIssue = {
  key: string;
  summary: string;
  status: string;
  url: string;
};

export type TimeTrackerProjectTotal = {
  projectId: number;
  name: string;
  seconds: number;
};

export type TimeTrackerDailyEntry = {
  date: string;
  totalSeconds: number;
  projects: TimeTrackerProjectTotal[];
};

export type TimeTrackerReport = {
  configured: boolean;
  totalSeconds: number;
  daily: TimeTrackerDailyEntry[];
  projects: TimeTrackerProjectTotal[];
};

export type JiraIssue = IssueTrackerIssue;
export type HubstaffReport = TimeTrackerReport;
export type HubstaffProjectTotal = TimeTrackerProjectTotal;
export type HubstaffDailyEntry = TimeTrackerDailyEntry;

export type ReportDateRange = {
  from: string;
  to: string;
};

export type ClientIntegrationContext = {
  selectedClientKey: string;
  selectedClientConfigured: boolean;
  enabledClientCount: number;
};
