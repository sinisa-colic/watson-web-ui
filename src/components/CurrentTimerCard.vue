<script setup lang="ts">
import type { JiraIssue, WatsonStatus } from "../types";
import { parseIssueKey } from "../utils/jira";
import { formatStopwatch } from "../utils/time";

defineProps<{
  status: WatsonStatus | null;
  currentProjectDisplay: { name: string; tags: string[] };
  currentElapsedMs: number;
  issueForProject: (name: string) => JiraIssue | null;
}>();
</script>

<template>
  <article class="card card-featured current-card">
    <div v-if="status?.running" class="current-card-body">
      <div class="current-card-top">
        <span class="label">Current</span>
        <div class="current-badges">
          <span v-if="parseIssueKey(currentProjectDisplay.name)" class="issue-key-badge">
            {{ parseIssueKey(currentProjectDisplay.name) }}
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
        <div v-if="currentProjectDisplay.tags.length" class="current-tags">
          <span v-for="tag in currentProjectDisplay.tags" :key="tag" class="tag-pill">+{{ tag }}</span>
        </div>
        <div class="stopwatch" aria-label="Current project elapsed time">
          {{ currentElapsedMs ? formatStopwatch(currentElapsedMs) : status.elapsed }}
        </div>
      </div>
    </div>

    <div v-else class="current-idle">
      <strong>No project running</strong>
      <p>Choose a project below and press Start.</p>
    </div>
  </article>
</template>

<style scoped>
.current-card {
  min-height: 9.75rem;
}

.current-card-body,
.current-idle {
  min-height: 7.85rem;
}

.current-idle {
  align-content: center;
}

@media (max-width: 860px) {
  .current-card {
    min-height: 9.65rem;
  }

  .current-card-body,
  .current-idle {
    min-height: 8.15rem;
  }
}
</style>
