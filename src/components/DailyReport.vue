<script setup lang="ts">
import { ref } from "vue";
import type { UnifiedDaySummary, PickerItem } from "#integrations/types";
import { formatDuration } from "../utils/time";

defineProps<{
  unifiedDailySummaries: UnifiedDaySummary[];
  maxDailyMs: number;
  issueForProject: (name: string) => PickerItem | null;
}>();

const expandedDays = ref<Set<string>>(new Set());
const collapsed = ref(true);

function toggleDay(key: string) {
  const next = new Set(expandedDays.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedDays.value = next;
}

function isExpanded(key: string) {
  return expandedDays.value.has(key);
}

function projectLabel(
  name: string,
  supportsIssueKeys: boolean,
  issueForProject: (name: string) => PickerItem | null
) {
  if (!supportsIssueKeys) {
    return name;
  }

  const issue = issueForProject(name);
  return issue ? `${name} - ${issue.summary}` : name;
}
</script>

<template>
  <section class="card daily-report">
    <button type="button" class="section-title" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <span class="section-heading-group">
        <span class="label">Per day</span>
        <span class="section-heading">Daily hours</span>
      </span>
      <span class="section-meta">
        {{ unifiedDailySummaries.length }} day{{ unifiedDailySummaries.length === 1 ? "" : "s" }}
        <span class="section-chevron" aria-hidden="true">{{ collapsed ? "Show" : "Hide" }}</span>
      </span>
    </button>

    <div v-if="unifiedDailySummaries.length" v-show="!collapsed" class="day-list">
      <article v-for="day in unifiedDailySummaries" :key="day.key" class="day-row">
        <div
          class="day-row-toggle"
          role="button"
          tabindex="0"
          @click="toggleDay(day.key)"
          @keydown.enter.prevent="toggleDay(day.key)"
          @keydown.space.prevent="toggleDay(day.key)"
        >
          <div class="day-meta">
            <strong>{{ day.label }}</strong>
            <div v-for="source in day.sources" :key="source.id" class="source-day-total">
              <span class="source-label">{{ source.label }}</span>
              <span>{{ formatDuration(source.totalMs) }}</span>
            </div>
          </div>
          <div class="day-chart" :title="`${day.label}: ${formatDuration(day.totalMs)}`">
            <div class="day-total-bar" :style="{ width: `${Math.max((day.totalMs / maxDailyMs) * 100, 2)}%` }">
              <span
                v-for="source in day.sources"
                :key="`${day.key}-${source.id}`"
                class="day-source-segment"
                :style="{ width: `${day.totalMs ? (source.totalMs / day.totalMs) * 100 : 0}%` }"
                :title="`${source.label}: ${formatDuration(source.totalMs)}`"
              />
            </div>
          </div>
          <span class="day-expand-label">{{ isExpanded(day.key) ? "Hide details" : "Show details" }}</span>
        </div>
        <div v-show="isExpanded(day.key)" class="day-breakdown">
          <template v-for="source in day.sources" :key="`${day.key}-${source.id}-detail`">
            <span v-if="source.byClient.length" class="breakdown-heading">{{ source.label }} · clients</span>
            <span v-for="item in source.byClient" :key="`${source.id}-client-${item.name}`">
              {{ source.label }} {{ item.name }} {{ formatDuration(item.duration) }}
            </span>
            <span v-if="source.byProject.length" class="breakdown-heading">{{ source.label }} · projects</span>
            <span v-for="item in source.byProject" :key="`${source.id}-project-${item.name}`">
              {{ projectLabel(item.name, source.supportsIssueKeys ?? false, issueForProject) }}
              {{ formatDuration(item.duration) }}
            </span>
          </template>
        </div>
      </article>
    </div>
    <p v-else v-show="!collapsed">No tracked time in this range.</p>
  </section>
</template>

<style scoped>
.day-meta {
  display: grid;
  gap: 0.25rem;
}

.source-day-total {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  font-size: 0.88rem;
}

.source-label {
  color: #64708a;
  font-weight: 800;
}

.breakdown-heading {
  color: #64708a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.day-source-segment {
  display: inline-block;
  height: 100%;
  min-width: 2px;
  background: #8ea0c6;
}

.day-source-segment:first-child {
  background: #4f6fae;
}
</style>
