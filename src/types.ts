export type WatsonFrame = {
  id: string;
  project: string;
  start: string;
  stop: string;
  tags: string[];
};

export type WatsonStatus = {
  running: boolean;
  project: string | null;
  tags: string[];
  elapsed: string | null;
  startedAt: string | null;
};

export type ProjectTotal = {
  name: string;
  duration: number;
};

export type DaySummary = {
  key: string;
  label: string;
  duration: number;
  projects: ProjectTotal[];
};

export type LogDay = {
  key: string;
  label: string;
  duration: number;
  frames: WatsonFrame[];
};

export type ClientOption = {
  key: string;
  label: string;
  tag: string;
  jiraConfigured: boolean;
  configured: boolean;
};

export type WatsonOptions = {
  projects: string[];
  tags: string[];
  clients: ClientOption[];
  defaultClientKey: string | null;
  jiraEnabledClientCount: number;
  stopOnStart: boolean;
  dateFormat: string;
  timeFormat: string;
  weekStart: string;
};

export type JiraIssue = {
  key: string;
  summary: string;
  status: string;
  url: string;
};
