import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type {
  ClientOption,
  LogDay,
  WatsonFrame,
  WatsonOptions,
  WatsonStatus
} from "../types";
import { ALL_CLIENTS_KEY } from "#integrations/client-selection";
import { useReportIntegrations } from "./useReportIntegrations";
import { api } from "../utils/api";
import { applyWatsonDisplayPreferences } from "../utils/displayPreferences";
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
  formatDay,
  formatDuration,
  formatMonth,
  formatShortDate,
  formatTime,
  frameDuration,
  startOfWeek,
  toDatetimeLocalValue,
  datetimeLocalToIso
} from "../utils/time";

const RUNNING_STATUS_STORAGE_KEY = "watson-web-ui-running-status";
export const CUSTOM_PROJECT_OPTION = "__custom_project__";
export const CUSTOM_TAG_OPTION = "__custom_tags__";
export { ALL_CLIENTS_KEY };

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
  const status = ref<WatsonStatus | null>(null);
  const projectOptions = ref<string[]>([]);
  const tagOptions = ref<string[]>([]);
  const configuredClients = ref<ClientOption[]>([]);
  const defaultClientKey = ref<string | null>(null);
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

  const weekEnd = computed(() => addDays(weekStart.value, 6));

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
        integrations: {},
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

  const watsonTimerEnabled = computed(
    () =>
      selectedClientKey.value === ALL_CLIENTS_KEY || selectedClient.value?.watsonTracking !== false
  );

  const canStart = computed(
    () => watsonTimerEnabled.value && (!status.value?.running || stopOnStart.value)
  );

  const reportIntegrations = useReportIntegrations({
    range,
    weekStart,
    monthStart,
    selectedClientKey,
    selectedClient,
    clientOptions
  });

  const frames = computed(() => reportIntegrations.localFrames());
  const allFrames = reportIntegrations.localAllFrames;
  const sourceReports = reportIntegrations.sourceReports;
  const unifiedDailySummaries = reportIntegrations.unifiedDailySummaries;
  const maxUnifiedDailyMs = reportIntegrations.maxUnifiedDailyMs;

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

  const projectPickerOptions = computed(() => {
    const seen = new Set<string>();
    const options: Array<{ key: string; label: string; subtitle?: string }> = [];

    for (const issue of reportIntegrations.allIssues.value) {
      const key = issue.key.toUpperCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push({ key: issue.key, label: issue.key, subtitle: issue.summary });
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
      const issue = reportIntegrations.issueForProject(name);
      options.push({
        key: name,
        label: name,
        subtitle: issue?.summary
      });
    }

    return options;
  });

  watch(projectPickerOptions, syncProjectSelection);

  const issueForProject = reportIntegrations.issueForProject;
  const projectLabel = reportIntegrations.projectLabel;

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

  function preselectClient(nextOptions: WatsonOptions) {
    if (clientTouched.value) {
      return;
    }

    configuredClients.value = nextOptions.clients ?? [];
    defaultClientKey.value = nextOptions.defaultClientKey ?? null;
    reportIntegrations.applyOptions(nextOptions);

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

    await reportIntegrations.resetOnClientChange(
      status.value ?? { running: false, project: null, tags: [], elapsed: null, startedAt: null },
      projectOptions.value
    );

    const activeProject = status.value?.running ? status.value.project : null;
    const nextProject = activeProject ?? projectPickerOptions.value[0]?.key ?? "";

    project.value = nextProject;
    selectedProject.value = nextProject || CUSTOM_PROJECT_OPTION;
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
      const [nextStatus, nextOptions] = await Promise.all([
        api<WatsonStatus>(statusPath),
        api<WatsonOptions>("/api/options")
      ]);

      status.value = resolveStatusFromRefresh(nextStatus);
      rememberRunningStatus(status.value);
      projectOptions.value = nextOptions.projects;
      tagOptions.value = nextOptions.tags;
      stopOnStart.value = nextOptions.stopOnStart;
      preselectClient(nextOptions);
      applyWatsonDisplayPreferences({
        timeFormat: nextOptions.timeFormat,
        weekStart: nextOptions.weekStart
      });
      await reportIntegrations.loadForReport(nextStatus, nextOptions.projects);
      preselectProject(nextStatus, frames.value);
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
    await reportIntegrations.reloadLocalFrames();
    await reportIntegrations.loadMissingEnrichment(
      nextStatus.project,
      ...frames.value.map((frame) => frame.project)
    );
    lastRefreshedAt.value = new Date();
  }

  async function start() {
    if (!watsonTimerEnabled.value) {
      return;
    }

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

      if (offlineActionType === "switch") {
        queueOfflineAction({ type: "switch", project: nextProject, tags: nextTags, at: startedAt });
      } else {
        queueOfflineAction({ type: "start", project: nextProject, tags: nextTags, at: startedAt });
      }
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
    sourceReports,
    unifiedDailySummaries,
    maxUnifiedDailyMs,
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
    watsonTimerEnabled,
    editOpen,
    editDraft,
    editSaving,
    editError,
    canSaveEdit,
    stopOnStart,
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
