import type { ProjectTotal } from "../../types";

/** One time-tracking source (Watson, Hubstaff per client, …) at the same report level. */
export type TimeTrackerSourceReport = {
  id: string;
  label: string;
  totalMs: number;
  /** Client scope: Watson tag → client label; Hubstaff project name. */
  byClient: ProjectTotal[];
  /** Task / activity scope: Watson project name; Hubstaff has no task granularity. */
  byProject: ProjectTotal[];
  daily: TimeTrackerDayReport[];
};

export type TimeTrackerDayReport = {
  date: string;
  totalMs: number;
  byClient: ProjectTotal[];
  byProject: ProjectTotal[];
};

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
  }>;
};
