import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { ClientOption, DaySummary, JiraIssue, LogDay, ProjectTotal, WatsonFrame, WatsonOptions, WatsonStatus } from "../types";
import { api } from "../utils/api";
import { applyWatsonDisplayPreferences } from "../utils/displayPreferences";
import { parseIssueKey } from "../utils/jira";
import {
  isOfflineApiError,
  queueOfflineAction,
  queuedOfflineActions,
  statusFromOfflineQueue,
  syncOfflineActions
} from "../utils/offlineWatsonActions";
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDay,
  formatDuration,
  formatMonth,
  formatShortDate,
  formatTime,
  frameDuration,
  startOfWeek,
  toLocalDate,
  toDatetimeLocalValue,
  datetimeLocalToIso
} from "../utils/time";

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;
const RUNNING_STATUS_STORAGE_KEY = "watson-web-ui-running-status";
export const CUSTOM_PROJECT_OPTION = "__custom_project__";
export const CUSTOM_TAG_OPTION = "__custom_tags__";
export const ALL_CLIENTS_KEY = "__all__";

export type EditFrameDraft = {
  project: string;
  start: string;
  stop: string;
  tags: string;
};

type WatsonActionResponse = {
  output: string;
  status: WatsonStatus;
};

export function useWatsonDashboard() {
  const range = ref("week");
  const weekStart = ref(startOfWeek(new Date()));
  const monthStart = ref(addMonths(new Date(), 0));
  const frames = ref<WatsonFrame[]>([]);
  const allFrames = ref<WatsonFrame[]>([]);
  const status = ref<WatsonStatus | null>(null);
  const projectOptions = ref<string[]>([]);
  const tagOptions = ref<string[]>([]);
  const jiraIssues = ref<JiraIssue[]>([]);
  const issueMap = ref<Record<string, JiraIssue>>({});
  const jiraConfigured = ref(false);
  const configuredClients = ref<ClientOption[]>([]);
  const defaultClientKey = ref<string | null>(null);
  const jiraEnabledClientCount = ref(0);
  const selectedClientKey = ref(ALL_CLIENTS_KEY);
  const clientTouched = ref(false);
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
  const editingFrame = ref<WatsonFrame | null>(null);
  const editDraft = ref<EditFrameDraft>({ project: "", start: "", stop: "", tags: "" });
  const editSaving = ref(false);
  const editError = ref("");
  const offlineQueueCount = ref(queuedOfflineActions().length);
  const offlineSyncing = ref(false);
  const offlineMessage = ref("");

  let stopwatchInterval: number | undefined;
  let offlineSyncInterval: number | undefined;
  const OFFLINE_SYNC_INTERVAL_MS = 60_000;

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

  const totalsByClient = computed<ProjectTotal[]>(() => {
    const clientByTag = new Map(configuredClients.value.map((client) => [client.tag, client.label]));
    const totals = new Map<string, number>();

    for (const frame of frames.value) {
      const clientTag = frame.tags.find((tag) => clientByTag.has(tag));
      if (!clientTag) {
        continue;
      }

      const clientLabel = clientByTag.get(clientTag) ?? clientTag;
      totals.set(clientLabel, (totals.get(clientLabel) ?? 0) + frameDuration(frame));
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
  const monthEnd = computed(() => endOfMonth(monthStart.value));

  const selectedRangeLabel = computed(() => {
    if (range.value === "week") {
      return `${formatShortDate(weekStart.value)} - ${formatShortDate(weekEnd.value)}`;
    }

    if (range.value === "month") {
      return formatMonth(monthStart.value);
    }

    return range.value === "day" ? "Today" : "All time";
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
  const editOpen = computed(() => editingFrame.value !== null);
  const canSaveEdit = computed(() => {
    const draft = editDraft.value;
    return Boolean(draft.project.trim() && draft.start && draft.stop && !editSaving.value);
  });
  const usingCustomProject = computed(() => selectedProject.value === CUSTOM_PROJECT_OPTION);
  const currentProjectDisplay = computed(() => ({
    name: status.value?.project ?? "",
    tags: status.value?.tags ?? []
  }));

  const clientOptions = computed<ClientOption[]>(() => {
    const configuredTags = new Set(configuredClients.value.map((client) => client.tag));
    const tagOnlyClients = tagOptions.value
      .filter((tag) => !configuredTags.has(tag))
      .map((tag) => ({
        key: tag,
        label: tag,
        tag,
        jiraConfigured: false,
        configured: false
      }));

    return [...configuredClients.value, ...tagOnlyClients];
  });

  const selectedClient = computed(() => {
    if (selectedClientKey.value === ALL_CLIENTS_KEY) {
      return null;
    }

    return clientOptions.value.find((client) => client.key === selectedClientKey.value) ?? null;
  });

  const selectedClientTag = computed(() => selectedClient.value?.tag ?? null);

  const projectsByClientTag = computed(() => {
    const index = new Map<string, Set<string>>();

    for (const frame of allFrames.value) {
      for (const tag of frame.tags) {
        const projects = index.get(tag) ?? new Set<string>();
        projects.add(frame.project);
        index.set(tag, projects);
      }
    }

    return index;
  });

  const scopedProjectNames = computed(() => {
    if (selectedClientKey.value === ALL_CLIENTS_KEY) {
      return null;
    }

    const tag = selectedClientTag.value;
    if (!tag) {
      return new Set<string>();
    }

    return projectsByClientTag.value.get(tag) ?? new Set<string>();
  });

  const showJiraIssues = computed(() => {
    if (selectedClientKey.value === ALL_CLIENTS_KEY) {
      return jiraEnabledClientCount.value <= 1 && jiraConfigured.value;
    }

    return Boolean(selectedClient.value?.jiraConfigured && jiraConfigured.value);
  });

  const projectPickerOptions = computed(() => {
    const seen = new Set<string>();
    const options: Array<{ key: string; label: string; subtitle?: string }> = [];

    if (showJiraIssues.value) {
      for (const issue of jiraIssues.value) {
        const key = issue.key.toUpperCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        options.push({ key: issue.key, label: issue.key, subtitle: issue.summary });
      }
    }

    const candidateProjects = [
      status.value?.project,
      ...projectOptions.value,
      ...(scopedProjectNames.value ? Array.from(scopedProjectNames.value) : [])
    ];

    for (const name of candidateProjects) {
      if (!name) {
        continue;
      }

      const isActiveProject = Boolean(status.value?.running && status.value.project === name);
      if (scopedProjectNames.value && !scopedProjectNames.value.has(name) && !isActiveProject) {
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

  function updateOfflineQueueCount() {
    offlineQueueCount.value = queuedOfflineActions().length;
  }

  function shouldQueueOfflineAction(error: unknown) {
    return isOfflineApiError(error);
  }

  function applyOfflineQueueStatus() {
    const offlineStatus = statusFromOfflineQueue();
    if (!offlineStatus) {
      return;
    }

    status.value = offlineStatus;
    rememberRunningStatus(offlineStatus);
  }

  function resolveStatusFromRefresh(nextStatus: WatsonStatus) {
    const pendingStatus = statusFromOfflineQueue();
    if (pendingStatus) {
      return pendingStatus;
    }

    return nextStatus;
  }

  function cachedRunningStatus(): WatsonStatus | null {
    try {
      const raw = window.localStorage.getItem(RUNNING_STATUS_STORAGE_KEY);
      const cached = raw ? (JSON.parse(raw) as WatsonStatus) : null;
      return cached?.running && cached.project && cached.startedAt ? cached : null;
    } catch {
      return null;
    }
  }

  function rememberRunningStatus(nextStatus: WatsonStatus) {
    if (!nextStatus.running) {
      window.localStorage.removeItem(RUNNING_STATUS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(RUNNING_STATUS_STORAGE_KEY, JSON.stringify(nextStatus));
  }

  async function syncQueuedActions() {
    if (!offlineQueueCount.value || offlineSyncing.value) {
      return;
    }

    offlineSyncing.value = true;
    offlineMessage.value = "Syncing offline actions...";

    try {
      await syncOfflineActions();
      updateOfflineQueueCount();
      offlineMessage.value = "";
      await refresh({ showLoading: false, skipOfflineSync: true });
    } catch (nextError) {
      offlineMessage.value =
        nextError instanceof Error ? `Offline actions pending: ${nextError.message}` : "Offline actions pending.";
    } finally {
      offlineSyncing.value = false;
    }
  }

  function parseTags() {
    const parsedCustomTags = customTags.value
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^\+/, ""))
      .filter(Boolean);

    const clientTag = selectedClientTag.value;
    const manualTags = selectedTags.value.filter((tag) => tag !== clientTag);

    return [...new Set([...(clientTag ? [clientTag] : []), ...manualTags, ...parsedCustomTags])];
  }

  function parseEditTags(raw: string) {
    return [...new Set(raw.split(/[,\s]+/).map((tag) => tag.trim().replace(/^\+/, "")).filter(Boolean))];
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

  async function moveMonth(delta: number) {
    monthStart.value = addMonths(monthStart.value, delta);
    range.value = "month";
    await refresh();
  }

  async function showThisMonth() {
    monthStart.value = addMonths(new Date(), 0);
    range.value = "month";
    await refresh();
  }

  function jiraQuery(extra: Record<string, string> = {}) {
    const params = new URLSearchParams(extra);
    if (selectedClientKey.value !== ALL_CLIENTS_KEY) {
      params.set("client", selectedClientKey.value);
    }

    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function loadJiraData(nextStatus: WatsonStatus, nextFrames: WatsonFrame[], nextProjects: string[]) {
    if (selectedClientKey.value !== ALL_CLIENTS_KEY && !selectedClient.value?.jiraConfigured) {
      jiraConfigured.value = false;
      jiraIssues.value = [];
      issueMap.value = {};
      return;
    }

    const keys = collectIssueKeys(
      nextStatus.project ?? undefined,
      ...nextFrames.map((frame) => frame.project),
      ...nextProjects
    );
    const shouldFetchIssueMap =
      keys.length > 0 &&
      (selectedClientKey.value !== ALL_CLIENTS_KEY || jiraEnabledClientCount.value <= 1);

    const [statusResponse, issuesResponse, mapResponse] = await Promise.all([
      api<{ configured: boolean }>(`/api/jira/status${jiraQuery()}`).catch(() => ({ configured: false })),
      showJiraIssues.value
        ? api<{ configured: boolean; issues: JiraIssue[] }>(`/api/jira/issues${jiraQuery()}`).catch(() => ({
            configured: false,
            issues: []
          }))
        : Promise.resolve({ configured: false, issues: [] }),
      shouldFetchIssueMap
        ? api<Record<string, JiraIssue>>(`/api/jira/issue-map${jiraQuery({ keys: keys.join(",") })}`).catch(() => ({}))
        : Promise.resolve({})
    ]);

    jiraConfigured.value = statusResponse.configured;
    jiraIssues.value = issuesResponse.issues ?? [];
    issueMap.value = mapResponse;
  }

  async function loadMissingIssueMap(...sources: Array<string | null | undefined>) {
    if (selectedClientKey.value === ALL_CLIENTS_KEY && jiraEnabledClientCount.value > 1) {
      return;
    }

    if (!jiraConfigured.value) {
      return;
    }

    const keys = collectIssueKeys(...sources).filter((key) => !issueMap.value[key.toUpperCase()]);
    if (!keys.length) {
      return;
    }

    const nextIssues = await api<Record<string, JiraIssue>>(
      `/api/jira/issue-map${jiraQuery({ keys: keys.join(",") })}`
    ).catch(() => ({}));
    issueMap.value = { ...issueMap.value, ...nextIssues };
  }

  function preselectClient(nextOptions: WatsonOptions) {
    if (clientTouched.value) {
      return;
    }

    configuredClients.value = nextOptions.clients ?? [];
    defaultClientKey.value = nextOptions.defaultClientKey ?? null;
    jiraEnabledClientCount.value = nextOptions.jiraEnabledClientCount ?? 0;

    if (defaultClientKey.value && clientOptions.value.some((client) => client.key === defaultClientKey.value)) {
      selectedClientKey.value = defaultClientKey.value;
      return;
    }

    if (configuredClients.value.length === 1) {
      selectedClientKey.value = configuredClients.value[0].key;
      return;
    }

    selectedClientKey.value = ALL_CLIENTS_KEY;
  }

  async function onClientSelectionChange() {
    clientTouched.value = true;
    projectTouched.value = false;
    jiraConfigured.value = false;
    jiraIssues.value = [];
    issueMap.value = {};

    await loadJiraData(status.value ?? { running: false, project: null, tags: [], elapsed: null, startedAt: null }, frames.value, projectOptions.value);

    const activeProject = status.value?.running ? status.value.project : null;
    const nextProject = activeProject ?? projectPickerOptions.value[0]?.key ?? "";

    project.value = nextProject;
    selectedProject.value = nextProject || CUSTOM_PROJECT_OPTION;
  }

  function framesPath() {
    if (range.value === "month") {
      return `/api/frames?range=month&from=${toLocalDate(monthStart.value)}&to=${toLocalDate(monthEnd.value)}`;
    }

    if (range.value !== "week") {
      return `/api/frames?range=${range.value}`;
    }

    return `/api/frames?range=week&from=${toLocalDate(weekStart.value)}&to=${toLocalDate(weekEnd.value)}`;
  }

  async function refresh(options: { showLoading?: boolean; skipOfflineSync?: boolean } = {}) {
    const showLoading = options.showLoading ?? true;

    if (showLoading) {
      loading.value = true;
    }
    error.value = "";

    try {
      const hasPendingOffline = queuedOfflineActions().length > 0;
      const statusPath = hasPendingOffline ? `/api/status?_=${Date.now()}` : "/api/status";
      const [nextStatus, nextFrames, nextAllFrames, nextOptions] = await Promise.all([
        api<WatsonStatus>(statusPath),
        api<WatsonFrame[]>(framesPath()),
        api<WatsonFrame[]>("/api/frames?range=all"),
        api<WatsonOptions>("/api/options")
      ]);

      status.value = resolveStatusFromRefresh(nextStatus);
      rememberRunningStatus(status.value);
      frames.value = nextFrames;
      allFrames.value = nextAllFrames;
      projectOptions.value = nextOptions.projects;
      tagOptions.value = nextOptions.tags;
      stopOnStart.value = nextOptions.stopOnStart;
      preselectClient(nextOptions);
      applyWatsonDisplayPreferences({
        timeFormat: nextOptions.timeFormat,
        weekStart: nextOptions.weekStart
      });
      preselectProject(nextStatus, nextFrames);
      await loadJiraData(nextStatus, nextFrames, nextOptions.projects);
      syncProjectSelection();
      updateOfflineQueueCount();
      if (!options.skipOfflineSync) {
        await syncQueuedActions();
      }
    } catch (nextError) {
      if (shouldQueueOfflineAction(nextError)) {
        applyOfflineQueueStatus();
        status.value ??= cachedRunningStatus();
      }
      error.value = nextError instanceof Error ? nextError.message : "Unknown error";
    } finally {
      if (showLoading) {
        loading.value = false;
      }
      lastRefreshedAt.value = new Date();
    }
  }

  async function refreshFramesOnly(nextStatus: WatsonStatus) {
    const [nextFrames, nextAllFrames] = await Promise.all([
      api<WatsonFrame[]>(framesPath()),
      api<WatsonFrame[]>("/api/frames?range=all")
    ]);
    frames.value = nextFrames;
    allFrames.value = nextAllFrames;
    await loadMissingIssueMap(nextStatus.project, ...nextFrames.map((frame) => frame.project));
    lastRefreshedAt.value = new Date();
  }

  async function start() {
    const wasRunning = Boolean(status.value?.running);
    const path = wasRunning && !stopOnStart.value ? "/api/switch" : "/api/start";
    const startedAt = new Date().toISOString();
    const nextTags = parseTags();
    const nextProject = project.value.trim();
    const offlineActionType = wasRunning && !stopOnStart.value ? "switch" : "start";

    try {
      const result = await api<WatsonActionResponse>(path, {
        method: "POST",
        body: JSON.stringify({ project: project.value, tags: nextTags, at: startedAt })
      });
      status.value = result.status;
      rememberRunningStatus(result.status);
      await refreshFramesOnly(result.status);
    } catch (nextError) {
      if (!shouldQueueOfflineAction(nextError)) {
        throw nextError;
      }

      queueOfflineAction({ type: offlineActionType, project: nextProject, tags: nextTags, at: startedAt });
      updateOfflineQueueCount();
      applyOfflineQueueStatus();
      offlineMessage.value =
        offlineActionType === "switch"
          ? "Switch queued offline. It will sync when the API is reachable."
          : "Start queued offline. It will sync when the API is reachable.";
    }

    now.value = Date.now();
    projectTouched.value = false;

    if (nextProject && !projectOptions.value.includes(nextProject)) {
      projectOptions.value = [nextProject, ...projectOptions.value];
    }

    syncProjectSelection();
  }

  async function stop() {
    const stoppedAt = new Date().toISOString();

    try {
      const result = await api<WatsonActionResponse>("/api/stop", {
        method: "POST",
        body: JSON.stringify({ at: stoppedAt })
      });
      status.value = result.status;
      rememberRunningStatus(result.status);
      await refreshFramesOnly(result.status);
    } catch (nextError) {
      if (!shouldQueueOfflineAction(nextError)) {
        throw nextError;
      }

      queueOfflineAction({ type: "stop", at: stoppedAt });
      updateOfflineQueueCount();
      applyOfflineQueueStatus();
      offlineMessage.value = "Stop queued offline. It will sync when the API is reachable.";
    }

    now.value = Date.now();
  }

  function openEditFrame(frame: WatsonFrame) {
    editingFrame.value = frame;
    editDraft.value = {
      project: frame.project,
      start: toDatetimeLocalValue(frame.start),
      stop: toDatetimeLocalValue(frame.stop),
      tags: frame.tags.join(" ")
    };
    editError.value = "";
  }

  function closeEditFrame() {
    editingFrame.value = null;
    editError.value = "";
    editSaving.value = false;
  }

  function updateEditDraft(nextDraft: EditFrameDraft) {
    editDraft.value = nextDraft;
  }

  async function saveEditFrame() {
    if (!editingFrame.value || !canSaveEdit.value) {
      return;
    }

    editSaving.value = true;
    editError.value = "";

    try {
      const scrollTop = window.scrollY;
      await api(`/api/frames/${encodeURIComponent(editingFrame.value.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          project: editDraft.value.project.trim(),
          start: datetimeLocalToIso(editDraft.value.start),
          stop: datetimeLocalToIso(editDraft.value.stop),
          tags: parseEditTags(editDraft.value.tags)
        })
      });

      closeEditFrame();
      await refresh({ showLoading: false });
      await nextTick();
      window.scrollTo(0, Math.min(scrollTop, document.documentElement.scrollHeight - window.innerHeight));
    } catch (nextError) {
      editError.value = nextError instanceof Error ? nextError.message : "Could not save frame.";
    } finally {
      editSaving.value = false;
    }
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
    updateOfflineQueueCount();
    applyOfflineQueueStatus();
    void refresh();
    window.addEventListener("online", syncQueuedActions);
    window.addEventListener("focus", syncQueuedActions);
    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("watson-offline-actions-changed", updateOfflineQueueCount);
    stopwatchInterval = window.setInterval(() => {
      now.value = Date.now();
    }, 1000);
    offlineSyncInterval = window.setInterval(() => {
      if (!offlineQueueCount.value || offlineSyncing.value) {
        return;
      }

      void syncQueuedActions();
    }, OFFLINE_SYNC_INTERVAL_MS);
  });

  function onVisibilityChange() {
    if (document.visibilityState === "visible") {
      void syncQueuedActions();
    }
  }

  onUnmounted(() => {
    if (stopwatchInterval) {
      window.clearInterval(stopwatchInterval);
    }
    if (offlineSyncInterval) {
      window.clearInterval(offlineSyncInterval);
    }
    window.removeEventListener("online", syncQueuedActions);
    window.removeEventListener("focus", syncQueuedActions);
    window.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("watson-offline-actions-changed", updateOfflineQueueCount);
  });

  return {
    range,
    frames,
    status,
    tagOptions,
    selectedClientKey,
    clientOptions,
    selectedClient,
    showJiraIssues,
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
    offlineQueueCount,
    offlineSyncing,
    offlineMessage,
    lastRefreshedAt,
    canStart,
    editOpen,
    editDraft,
    editSaving,
    editError,
    canSaveEdit,
    stopOnStart,
    totalMs,
    totalsByProject,
    totalsByClient,
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
    onClientSelectionChange,
    markProjectTouched,
    onTagSelectionChange,
    openCustomTagsInput,
    moveWeek,
    showThisWeek,
    moveMonth,
    showThisMonth,
    refresh,
    syncQueuedActions,
    start,
    stop,
    openEditFrame,
    closeEditFrame,
    updateEditDraft,
    saveEditFrame,
    removeFrame
  };
}
