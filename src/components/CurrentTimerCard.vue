<script setup lang="ts">
import type { WatsonStatus } from "../types";
import type { PickerItem } from "#integrations/types";
import { formatStopwatch } from "../utils/time";

defineProps<{
  status: WatsonStatus | null;
  currentProjectDisplay: { name: string; tags: string[] };
  currentElapsedMs: number;
  issueForProject: (name: string) => PickerItem | null;
}>();
</script>

<template>
  <article class="card card-featured current-card">
    <div v-if="status?.running" class="current-card-body">
      <div class="current-card-top">
        <span class="label">Current</span>
        <div class="current-badges">
          <span v-if="issueForProject(currentProjectDisplay.name)" class="issue-key-badge">
            {{ currentProjectDisplay.name }}
          </span>
          <span
            v-if="issueForProject(currentProjectDisplay.name)?.status"
            class="status-pill"
          >
            {{ issueForProject(currentProjectDisplay.name)?.status }}
          </span>
        </div>
      </div>

      <strong class="current-project-title">
        {{
          issueForProject(currentProjectDisplay.name)?.summary ??
          currentProjectDisplay.name
        }}
      </strong>

      <div class="current-card-bottom">
        <div class="current-tags">
          <span v-for="tag in currentProjectDisplay.tags" :key="tag" class="tag-pill">+{{ tag }}</span>
        </div>
        <div class="stopwatch" aria-label="Current project elapsed time">
          {{ currentElapsedMs ? formatStopwatch(currentElapsedMs) : status.elapsed }}
        </div>
      </div>
    </div>

    <div v-else class="current-card-body current-card-body-idle" aria-label="No project running">
      <div class="current-card-top">
        <span class="label">Current</span>
        <div class="current-badges" aria-hidden="true">
          <span class="issue-key-badge idle-pill idle-pill-key" />
          <span class="status-pill idle-pill idle-pill-status" />
        </div>
      </div>

      <div class="current-project-title idle-title">
        <strong>No active project</strong>
        <span>Choose a project and click Start.</span>
      </div>

      <div class="current-card-bottom" aria-hidden="true">
        <div class="current-tags">
          <span class="tag-pill idle-pill idle-tag-placeholder" />
        </div>
        <div class="stopwatch idle-time-placeholder">0:00:00</div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.current-card {
  min-height: 9.75rem;
}

.current-card-body {
  min-height: 7.85rem;
}

.idle-pill {
  background: var(--color-accent-soft-bg);
  border: 1px solid var(--color-accent-soft-border);
  border-radius: 999px;
  display: block;
  min-height: 1.55rem;
  opacity: 0.72;
}

.idle-pill-key {
  width: 2.75rem;
}

.idle-pill-status {
  width: 4.25rem;
}

.idle-title {
  display: grid;
  gap: 0.25rem;
  max-width: 100%;
}

.idle-title strong {
  color: var(--color-text);
  display: block;
  font-size: 1.45rem;
  line-height: 1.18;
}

.idle-title span {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  font-weight: 650;
}

.idle-tag-placeholder {
  height: 1.55rem;
  width: min(38vw, 14rem);
}

.idle-time-placeholder {
  opacity: 0.28;
}

.current-tags {
  flex: 1;
}

.stopwatch {
  flex-shrink: 0;
  margin-left: auto;
}

@media (max-width: 860px) {
  .current-card {
    min-height: 9.65rem;
  }

  .current-card-body {
    min-height: 8.15rem;
  }
}
</style>
