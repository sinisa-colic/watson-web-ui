import type { ProjectTotal } from "#integrations/types";

export type { ProjectTotal };

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
  integrations: Record<string, boolean>;
  configured: boolean;
  watsonTracking?: boolean;
};

export type WatsonOptions = {
  projects: string[];
  tags: string[];
  clients: ClientOption[];
  defaultClientKey: string | null;
  integrationEnabledCounts: Record<string, number>;
  stopOnStart: boolean;
  dateFormat: string;
  timeFormat: string;
  weekStart: string;
};
