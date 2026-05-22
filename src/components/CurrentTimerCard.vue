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
    <span class="label">Current</span>

    <div v-if="status?.running" class="current-card-body">
      <div class="current-main">
        <div class="current-project-head">
          <span v-if="parseIssueKey(currentProjectDisplay.name)" class="issue-key-badge">
            {{ parseIssueKey(currentProjectDisplay.name) }}
          </span>
          <strong class="current-project-title">
            {{
              issueForProject(currentProjectDisplay.name)?.summary ??
              currentProjectDisplay.name
            }}
          </strong>
        </div>
        <div v-if="currentProjectDisplay.tags.length" class="current-tags">
          <span v-for="tag in currentProjectDisplay.tags" :key="tag" class="tag-pill">+{{ tag }}</span>
        </div>
        <span
          v-if="issueForProject(currentProjectDisplay.name)?.status"
          class="status-pill"
        >
          {{ issueForProject(currentProjectDisplay.name)?.status }}
        </span>
      </div>
      <div class="current-timer">
        <div class="stopwatch" aria-label="Current project elapsed time">
          {{ currentElapsedMs ? formatStopwatch(currentElapsedMs) : status.elapsed }}
        </div>
        <p>{{ `Started ${status.elapsed}` }}</p>
      </div>
    </div>

    <div v-else class="current-idle">
      <strong>No project running</strong>
      <p>Choose a project below and press Start.</p>
    </div>
  </article>
</template>
