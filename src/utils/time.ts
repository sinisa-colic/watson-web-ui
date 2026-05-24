import type { WatsonFrame } from "../types";
import { getWatsonDisplayPreferences } from "./displayPreferences";

const WEEK_START_TO_JS_DAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

export function startOfWeek(value: Date, weekStart = getWatsonDisplayPreferences().weekStart) {
  const targetDay = WEEK_START_TO_JS_DAY[weekStart] ?? 1;
  const date = new Date(value);
  const diff = (date.getDay() - targetDay + 7) % 7;

  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function toLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeFormatOptions() {
  const { hour12 } = getWatsonDisplayPreferences();

  return {
    hour12,
    hour: "2-digit" as const,
    minute: "2-digit" as const
  };
}

export function formatLastRefreshed(value: Date) {
  return value.toLocaleTimeString(undefined, timeFormatOptions());
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function formatStopwatch(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function frameDuration(frame: WatsonFrame) {
  return new Date(frame.stop).getTime() - new Date(frame.start).getTime();
}

export function formatDay(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(value);
}

export function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(value);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...timeFormatOptions()
  }).format(new Date(value));
}

export function formatClock(value: string) {
  return new Intl.DateTimeFormat(undefined, timeFormatOptions()).format(new Date(value));
}

export function toDatetimeLocalValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function datetimeLocalToIso(value: string) {
  return new Date(value).toISOString();
}
