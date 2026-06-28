<script setup lang="ts">
import { computed } from "vue";
import type { SourceReport, PickerItem } from "#integrations/types";
import { mergeTrackerTotals } from "#integrations/merged-totals";
import { formatDuration } from "../utils/time";

const props = defineProps<{
  timeTrackerReports: SourceReport[];
  issueForProject: (name: string) => PickerItem | null;
  collapsed: boolean;
}>();

defineEmits<{
  toggle: [];
}>();

const merged = computed(() => mergeTrackerTotals(props.timeTrackerReports));

const clientCountLabel = computed(() => {
  const count = merged.value.byClient.length;
  if (!count) {
    return "No clients";
  }

  return `${count} client${count === 1 ? "" : "s"}`;
});
</script>

<template>
  <article class="card">
    <button type="button" class="section-title" :aria-expanded="!collapsed" @click="$emit('toggle')">
      <span class="section-heading-group">
        <span class="label">Time tracked</span>
        <span class="section-heading">Summary</span>
      </span>
      <span class="section-meta">
        {{ formatDuration(merged.totalMs) }} · {{ clientCountLabel }}
        <span class="section-chevron" aria-hidden="true">{{ collapsed ? "Show" : "Hide" }}</span>
      </span>
    </button>

    <div v-show="!collapsed" class="tracker-list">
      <div v-if="merged.byClient.length" class="tracker-group">
        <span class="label">By client</span>
        <div v-for="item in merged.byClient" :key="`client-${item.name}`" class="project-row">
          <span class="project-name">
            <strong>{{ item.name }}</strong>
          </span>
          <strong>{{ formatDuration(item.duration) }}</strong>
        </div>
      </div>

      <div v-if="merged.byProject.length" class="tracker-group">
        <span class="label">By project</span>
        <div v-for="item in merged.byProject" :key="`project-${item.name}`" class="project-row">
          <span class="project-name">
            <span v-if="item.supportsIssueKeys && issueForProject(item.name)" class="issue-key-badge">
              {{ item.name }}
            </span>
            <strong v-if="!item.supportsIssueKeys || !issueForProject(item.name)">{{ item.name }}</strong>
            <small v-else>{{ issueForProject(item.name)?.summary }}</small>
          </span>
          <strong>{{ formatDuration(item.duration) }}</strong>
        </div>
      </div>

      <p v-if="!merged.byClient.length && !merged.byProject.length" class="empty-note">No tracked time in this range.</p>
    </div>
  </article>
</template>

<style scoped>
.tracker-list {
  display: grid;
  gap: 1rem;
}

.tracker-group {
  display: grid;
  gap: 0.5rem;
}

.tracker-group + .tracker-group {
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 1rem;
}

.empty-note {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0;
}
</style>
