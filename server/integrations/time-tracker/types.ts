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
  totalSeconds: number;
  daily: TimeTrackerDailyEntry[];
  projects: TimeTrackerProjectTotal[];
};
