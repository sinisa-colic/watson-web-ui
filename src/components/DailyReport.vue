<script setup lang="ts">
import { ref } from "vue";
import type { DaySummary } from "../types";
import { formatDuration } from "../utils/time";

defineProps<{
  dailySummaries: DaySummary[];
  maxDailyMs: number;
  projectLabel: (name: string) => string;
}>();

const expandedDays = ref<Set<string>>(new Set());

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
</script>

<template>
  <section class="card daily-report">
    <div class="section-title">
      <div>
        <span class="label">Per day</span>
        <h2>Daily hours</h2>
      </div>
      <span>{{ dailySummaries.length }} day{{ dailySummaries.length === 1 ? "" : "s" }}</span>
    </div>

    <div v-if="dailySummaries.length" class="day-list">
      <article v-for="day in dailySummaries" :key="day.key" class="day-row">
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
            <span>{{ formatDuration(day.duration) }}</span>
          </div>
          <div class="day-chart" :title="`${day.label}: ${formatDuration(day.duration)}`">
            <div class="day-total-bar" :style="{ width: `${Math.max((day.duration / maxDailyMs) * 100, 2)}%` }">
              <span
                v-for="item in day.projects"
                :key="`${day.key}-${item.name}`"
                class="day-project-segment"
                :style="{ width: `${(item.duration / day.duration) * 100}%` }"
                :title="`${projectLabel(item.name)}: ${formatDuration(item.duration)}`"
              />
            </div>
          </div>
          <span class="day-expand-label">{{ isExpanded(day.key) ? "Hide details" : "Show details" }}</span>
        </div>
        <div v-show="isExpanded(day.key)" class="day-breakdown">
          <span v-for="item in day.projects" :key="item.name">
            {{ projectLabel(item.name) }} {{ formatDuration(item.duration) }}
          </span>
        </div>
      </article>
    </div>
    <p v-else>No frames in this range.</p>
  </section>
</template>
