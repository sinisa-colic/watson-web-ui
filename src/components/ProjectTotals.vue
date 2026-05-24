<script setup lang="ts">
import { computed } from "vue";
import type { JiraIssue, ProjectTotal } from "../types";
import { parseIssueKey } from "../utils/jira";
import { formatDuration } from "../utils/time";

const props = defineProps<{
  totalsByProject: ProjectTotal[];
  issueForProject: (name: string) => JiraIssue | null;
  collapsed: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const totalMs = computed(() => props.totalsByProject.reduce((sum, item) => sum + item.duration, 0));
</script>

<template>
  <article class="card">
    <button type="button" class="section-title" :aria-expanded="!collapsed" @click="$emit('toggle')">
      <span class="section-heading-group">
        <span class="label">Projects</span>
        <span class="section-heading">By project</span>
      </span>
      <span class="section-meta">
        {{ formatDuration(totalMs) }}
        <span class="section-chevron" aria-hidden="true">{{ collapsed ? "Show" : "Hide" }}</span>
      </span>
    </button>

    <div v-show="!collapsed">
      <div v-for="item in totalsByProject" :key="item.name" class="project-row">
        <span class="project-name">
          <span v-if="parseIssueKey(item.name)" class="issue-key-badge">{{ parseIssueKey(item.name) }}</span>
          <strong v-if="!issueForProject(item.name)">{{ item.name }}</strong>
          <small v-else>{{ issueForProject(item.name)?.summary }}</small>
        </span>
        <strong>{{ formatDuration(item.duration) }}</strong>
      </div>
    </div>
  </article>
</template>
