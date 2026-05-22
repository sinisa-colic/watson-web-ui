<script setup lang="ts">
import type { JiraIssue, ProjectTotal } from "../types";
import { parseIssueKey } from "../utils/jira";
import { formatDuration } from "../utils/time";

defineProps<{
  totalsByProject: ProjectTotal[];
  issueForProject: (name: string) => JiraIssue | null;
}>();
</script>

<template>
  <article class="card">
    <h2>By Project</h2>
    <div v-for="item in totalsByProject" :key="item.name" class="project-row">
      <span class="project-name">
        <span v-if="parseIssueKey(item.name)" class="issue-key-badge">{{ parseIssueKey(item.name) }}</span>
        <strong>{{ issueForProject(item.name)?.summary ?? item.name }}</strong>
        <small v-if="issueForProject(item.name) && !parseIssueKey(item.name)">{{ issueForProject(item.name)?.summary }}</small>
      </span>
      <strong>{{ formatDuration(item.duration) }}</strong>
    </div>
  </article>
</template>
