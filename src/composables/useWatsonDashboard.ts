import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { DaySummary, JiraIssue, LogDay, ProjectTotal, WatsonFrame, WatsonOptions, WatsonStatus } from "../types";
import { api } from "../utils/api";
import { parseIssueKey } from "../utils/jira";
import {
  addDays,
  formatDay,
  formatDuration,
  formatShortDate,
  formatTime,
  frameDuration,
  startOfWeek,
  toLocalDate
} from "../utils/time";

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;
export const CUSTOM_PROJECT_OPTION = "__custom_project__";
export const CUSTOM_TAG_OPTION = "__custom_tags__";

type WatsonActionResponse = {
  output: string;
  status: WatsonStatus;
};

export function useWatsonDashboard() {
  const range = ref("week");
  const weekStart = ref(startOfWeek(new Date()));
  const frames = ref<WatsonFrame[]>([]);
  const status = ref<WatsonStatus | null>(null);
  const projectOptions = ref<string[]>([]);
  const tagOptions = ref<string[]>([]);
  const jiraIssues = ref<JiraIssue[]>([]);
  const issueMap = ref<Record<string, JiraIssue>>({});
  const jiraConfigured = ref(false);
  const stopOnStart = ref(false);
  const selectedProject = ref(CUSTOM_PROJECT_OPTION);
  const projectTouched = ref(false);
  const customProjectInput = ref<HTMLInputElement | null>(null);
  const selectedTags = ref<string[]>([]);
  const showCustomTags = ref(false);
  const customTags = ref("");
  const customTagsInput = ref<HTMLInputElement | null>(null);
  const customTagOptions = ref<string[]>([]);
  const project = ref("");
  const loading = ref(false);
  const error = ref("");
  const lastRefreshedAt = ref<Date | null>(null);
  const now = ref(Date.now());

  let stopwatchInterval: number | undefined;

  const totalMs = computed(() =>
    frames.value.reduce((sum, frame) => sum + (new Date(frame.stop).getTime() - new Date(frame.start).getTime()), 0)
  );

  const totalsByProject = computed<ProjectTotal[]>(() => {
    const totals = new Map<string, number>();

    for (const frame of frames.value) {
      totals.set(frame.project, (totals.get(frame.project) ?? 0) + frameDuration(frame));
    }

    return Array.from(totals.entries())
      .map(([name, duration]) => ({ name, duration }))
      .sort((a, b) => b.duration - a.duration);
  });

  const dailySummaries = computed<DaySummary[]>(() => {
    const days = new Map<string, { date: Date; duration: number; projects: Map<string, number> }>();

    for (const frame of frames.value) {
      const start = new Date(frame.start);
      const key = start.toLocaleDateString("en-CA");
      const duration = frameDuration(frame);
      const day = days.get(key) ?? { date: start, duration: 0, projects: new Map<string, number>() };

      day.duration += duration;
      day.projects.set(frame.project, (day.projects.get(frame.project) ?? 0) + duration);
      days.set(key, day);
    }

    return Array.from(days.entries())
      .map(([key, day]) => ({
        key,
        label: formatDay(day.date),
        duration: day.duration,
        projects: Array.from(day.projects.entries())
          .map(([name, duration]) => ({ name, duration }))
          .sort((a, b) => b.duration - a.duration)
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  });

  const maxDailyMs = computed(() => Math.max(...dailySummaries.value.map((day) => day.duration), 1));

  const logDays = computed<LogDay[]>(() => {
    const days = new Map<string, { date: Date; duration: number; frames: WatsonFrame[] }>();

    for (const frame of frames.value) {
      const start = new Date(frame.start);
      const key = start.toLocaleDateString("en-CA");
      const day = days.get(key) ?? { date: start, duration: 0, frames: [] };

      day.duration += frameDuration(frame);
      day.frames.push(frame);
      days.set(key, day);
    }

    return Array.from(days.entries())
      .map(([key, day]) => ({
        key,
        label: formatDay(day.date),
        duration: day.duration,
        frames: day.frames.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  });

  const weekEnd = computed(() => addDays(weekStart.value, 6));

  const selectedRangeLabel = computed(() => {
    if (range.value !== "week") {
      return range.value === "day" ? "Today" : range.value === "month" ? "This month" : "All time";
    }

    return `${formatShortDate(weekStart.value)} - ${formatShortDate(weekEnd.value)}`;
  });

  const currentElapsedMs = computed(() => {
    if (!status.value?.running || !status.value.startedAt) {
      return 0;
    }

    const startedAt = new Date(status.value.startedAt);
    return Number.isNaN(startedAt.getTime()) ? 0 : Math.max(now.value - startedAt.getTime(), 0);
  });

  const primaryActionLabel = computed(() => {
    if (status.value?.running && stopOnStart.value) {
      return "Switch task";
    }
    if (status.value?.running) {
      return "Switch";
    }
    return "Start";
  });
  const canStart = computed(() => !status.value?.running || stopOnStart.value);
  const usingCustomProject = computed(() => selectedProject.value === CUSTOM_PROJECT_OPTION);
  const currentProjectDisplay = computed(() => ({
    name: status.value?.project ?? "",
    tags: status.value?.tags ?? []
  }));

  const projectPickerOptions = computed(() => {
    const seen = new Set<string>();
    const options: Array<{ key: string; label: string; subtitle?: string }> = [];

    for (const issue of jiraIssues.value) {
      const key = issue.key.toUpperCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push({ key: issue.key, label: issue.key, subtitle: issue.summary });
    }

    for (const name of [status.value?.project, ...projectOptions.value]) {
      if (!name) {
        continue;
      }

      const key = name.toUpperCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const issue = issueForProject(name);
      options.push({
        key: name,
        label: name,
        subtitle: issue?.summary
      });
    }

    return options;
  });

  watch(projectPickerOptions, syncProjectSelection);

  function looksLikeIssueKey(value: string) {
    return Boolean(parseIssueKey(value) || ISSUE_KEY_PATTERN.test(value.trim()));
  }

  function issueForProject(name: string): JiraIssue | null {
    return issueMap.value[name.toUpperCase()] ?? null;
  }

  function projectLabel(name: string) {
    const issue = issueForProject(name);
    return issue ? `${name} - ${issue.summary}` : name;
  }

  function collectIssueKeys(...sources: Array<string | null | undefined>) {
    return [...new Set(sources.filter((value): value is string => Boolean(value)).filter(looksLikeIssueKey))];
  }

  function parseTags() {
    const parsedCustomTags = customTags.value
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^\+/, ""))
      .filter(Boolean);

    return [...new Set([...selectedTags.value, ...parsedCustomTags])];
  }

  function commitCustomTags() {
    const nextTags = customTags.value
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^\+/, ""))
      .filter(Boolean);

    if (nextTags.length === 0) {
      return;
    }

    const knownTags = new Set([...tagOptions.value, ...customTagOptions.value]);
    const nextCustomOptions = [...customTagOptions.value];
    const nextSelectedTags = new Set(selectedTags.value);

    for (const tag of nextTags) {
      if (!knownTags.has(tag)) {
        knownTags.add(tag);
        nextCustomOptions.push(tag);
      }
      nextSelectedTags.add(tag);
    }

    customTagOptions.value = nextCustomOptions;
    selectedTags.value = Array.from(nextSelectedTags);
    customTags.value = "";
  }

  function onProjectSelectionChange() {
    projectTouched.value = true;

    if (usingCustomProject.value) {
      project.value = "";
      void nextTick(() => customProjectInput.value?.focus());
      return;
    }

    project.value = selectedProject.value;
  }

  function markProjectTouched() {
    projectTouched.value = true;
  }

  function syncProjectSelection() {
    if (projectTouched.value && usingCustomProject.value) {
      return;
    }

    const currentProject = project.value.trim();
    const hasExistingOption = projectPickerOptions.value.some((option) => option.key === currentProject);
    selectedProject.value = currentProject && hasExistingOption ? currentProject : CUSTOM_PROJECT_OPTION;
  }

  function onTagSelectionChange() {
    if (!selectedTags.value.includes(CUSTOM_TAG_OPTION)) {
      return;
    }

    selectedTags.value = selectedTags.value.filter((tag) => tag !== CUSTOM_TAG_OPTION);
    openCustomTagsInput();
  }

  function openCustomTagsInput() {
    showCustomTags.value = true;
    void nextTick(() => customTagsInput.value?.focus());
  }

  function preselectProject(nextStatus: WatsonStatus, nextFrames: WatsonFrame[]) {
    if (projectTouched.value || project.value.trim()) {
      return;
    }

    const latestFrame = [...nextFrames].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];
    project.value = nextStatus.project ?? latestFrame?.project ?? "";
    syncProjectSelection();
  }

  async function moveWeek(delta: number) {
    weekStart.value = addDays(weekStart.value, delta * 7);
    range.value = "week";
    await refresh();
  }

  async function showThisWeek() {
    weekStart.value = startOfWeek(new Date());
    range.value = "week";
    await refresh();
  }

  async function loadJiraData(nextStatus: WatsonStatus, nextFrames: WatsonFrame[], nextProjects: string[]) {
    const keys = collectIssueKeys(
      nextStatus.project ?? undefined,
      ...nextFrames.map((frame) => frame.project),
      ...nextProjects
    );

    const [statusResponse, issuesResponse, mapResponse] = await Promise.all([
      api<{ configured: boolean }>("/api/jira/status").catch(() => ({ configured: false })),
      api<{ configured: boolean; issues: JiraIssue[] }>("/api/jira/issues").catch(() => ({
        configured: false,
        issues: []
      })),
      keys.length
        ? api<Record<string, JiraIssue>>(`/api/jira/issue-map?keys=${encodeURIComponent(keys.join(","))}`).catch(
            () => ({})
          )
        : Promise.resolve({})
    ]);

    jiraConfigured.value = statusResponse.configured;
    jiraIssues.value = issuesResponse.issues ?? [];
    issueMap.value = mapResponse;
  }

  async function loadMissingIssueMap(...sources: Array<string | null | undefined>) {
    if (!jiraConfigured.value) {
      return;
    }

    const keys = collectIssueKeys(...sources).filter((key) => !issueMap.value[key.toUpperCase()]);
    if (!keys.length) {
      return;
    }

    const nextIssues = await api<Record<string, JiraIssue>>(
      `/api/jira/issue-map?keys=${encodeURIComponent(keys.join(","))}`
    ).catch(() => ({}));
    issueMap.value = { ...issueMap.value, ...nextIssues };
  }

  function framesPath() {
    if (range.value !== "week") {
      return `/api/frames?range=${range.value}`;
    }

    return `/api/frames?range=week&from=${toLocalDate(weekStart.value)}&to=${toLocalDate(weekEnd.value)}`;
  }

  async function refresh(options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? true;

    if (showLoading) {
      loading.value = true;
    }
    error.value = "";

    try {
      const [nextStatus, nextFrames, nextOptions] = await Promise.all([
        api<WatsonStatus>("/api/status"),
        api<WatsonFrame[]>(framesPath()),
        api<WatsonOptions>("/api/options")
      ]);

      status.value = nextStatus;
      frames.value = nextFrames;
      projectOptions.value = nextOptions.projects;
      tagOptions.value = nextOptions.tags;
      stopOnStart.value = nextOptions.stopOnStart;
      preselectProject(nextStatus, nextFrames);
      await loadJiraData(nextStatus, nextFrames, nextOptions.projects);
      syncProjectSelection();
    } catch (nextError) {
      error.value = nextError instanceof Error ? nextError.message : "Unknown error";
    } finally {
      if (showLoading) {
        loading.value = false;
      }
      lastRefreshedAt.value = new Date();
    }
  }

  async function refreshFramesOnly(nextStatus: WatsonStatus) {
    const nextFrames = await api<WatsonFrame[]>(framesPath());
    frames.value = nextFrames;
    await loadMissingIssueMap(nextStatus.project, ...nextFrames.map((frame) => frame.project));
    lastRefreshedAt.value = new Date();
  }

  async function start() {
    const path = status.value?.running && !stopOnStart.value ? "/api/switch" : "/api/start";
    const result = await api<WatsonActionResponse>(path, {
      method: "POST",
      body: JSON.stringify({ project: project.value, tags: parseTags() })
    });
    status.value = result.status;
    now.value = Date.now();
    projectTouched.value = false;

    const nextProject = project.value.trim();
    if (nextProject && !projectOptions.value.includes(nextProject)) {
      projectOptions.value = [nextProject, ...projectOptions.value];
    }

    syncProjectSelection();
    await refreshFramesOnly(result.status);
  }

  async function stop() {
    const result = await api<WatsonActionResponse>("/api/stop", { method: "POST" });
    status.value = result.status;
    now.value = Date.now();
    await refreshFramesOnly(result.status);
  }

  async function removeFrame(frame: WatsonFrame) {
    const confirmed = window.confirm(
      [
        "Remove this Watson log entry permanently?",
        "",
        `${projectLabel(frame.project)}`,
        `${formatTime(frame.start)} -> ${formatTime(frame.stop)}`,
        `Duration: ${formatDuration(frameDuration(frame))}`,
        "",
        "This cannot be undone."
      ].join("\n")
    );

    if (!confirmed) {
      return;
    }

    const scrollTop = window.scrollY;
    await api(`/api/frames/${encodeURIComponent(frame.id)}`, { method: "DELETE" });
    await refresh({ showLoading: false });
    await nextTick();
    window.scrollTo(0, Math.min(scrollTop, document.documentElement.scrollHeight - window.innerHeight));
  }

  onMounted(() => {
    void refresh();
    stopwatchInterval = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
  });

  onUnmounted(() => {
    if (stopwatchInterval) {
      window.clearInterval(stopwatchInterval);
    }
  });

  return {
    range,
    frames,
    status,
    tagOptions,
    selectedProject,
    customProjectInput,
    selectedTags,
    showCustomTags,
    customTags,
    customTagsInput,
    customTagOptions,
    project,
    loading,
    error,
    lastRefreshedAt,
    canStart,
    stopOnStart,
    totalMs,
    totalsByProject,
    dailySummaries,
    maxDailyMs,
    logDays,
    selectedRangeLabel,
    currentElapsedMs,
    primaryActionLabel,
    usingCustomProject,
    currentProjectDisplay,
    projectPickerOptions,
    issueForProject,
    projectLabel,
    commitCustomTags,
    onProjectSelectionChange,
    markProjectTouched,
    onTagSelectionChange,
    openCustomTagsInput,
    moveWeek,
    showThisWeek,
    refresh,
    start,
    stop,
    removeFrame
  };
}
