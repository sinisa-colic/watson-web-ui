<script setup lang="ts">
import { computed } from "vue";
import { formatDuration } from "../utils/time";
import type { SourceReport } from "#integrations/types";
import { mergeTrackerTotals } from "#integrations/merged-totals";

const props = defineProps<{
  timeTrackerReports: SourceReport[];
  selectedRangeLabel: string;
  range: string;
}>();

const emit = defineEmits<{
  "update:range": [value: string];
  rangeChange: [];
  moveWeek: [delta: number];
  showThisWeek: [];
  moveMonth: [delta: number];
  showThisMonth: [];
}>();

const quickRanges = [
  { value: "day", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" }
] as const;

function setRange(value: string) {
  emit("update:range", value);
  emit("rangeChange");
}

const mergedTotals = computed(() => mergeTrackerTotals(props.timeTrackerReports));
</script>

<template>
  <article class="card range-card">
    <div class="range-card-header">
      <div>
        <span class="label">Selected range</span>
        <p>{{ selectedRangeLabel }}</p>
      </div>
      <div class="range-totals">
        <div class="tracker-total tracker-total-grand">
          <span class="tracker-label">Total</span>
          <strong>{{ formatDuration(mergedTotals.totalMs) }}</strong>
        </div>
        <div v-for="item in mergedTotals.byClient" :key="item.name" class="tracker-total">
          <span class="tracker-label">{{ item.name }}</span>
          <strong>{{ formatDuration(item.duration) }}</strong>
        </div>
      </div>
    </div>

    <div class="range-quick" role="group" aria-label="Quick range">
      <button
        v-for="item in quickRanges"
        :key="item.value"
        type="button"
        class="ghost range-quick-btn"
        :class="{ active: range === item.value }"
        @click="setRange(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="range === 'week'" class="week-nav">
      <button type="button" class="ghost" @click="$emit('moveWeek', -1)">Previous week</button>
      <button type="button" class="ghost" @click="$emit('showThisWeek')">This week</button>
      <button type="button" class="ghost" @click="$emit('moveWeek', 1)">Next week</button>
    </div>

    <div v-if="range === 'month'" class="week-nav">
      <button type="button" class="ghost" @click="$emit('moveMonth', -1)">Previous month</button>
      <button type="button" class="ghost" @click="$emit('showThisMonth')">This month</button>
      <button type="button" class="ghost" @click="$emit('moveMonth', 1)">Next month</button>
    </div>
  </article>
</template>

<style scoped>
.range-totals {
  display: grid;
  gap: 0.35rem;
  justify-items: end;
}

.tracker-total {
  display: grid;
  gap: 0.1rem;
  justify-items: end;
}

.tracker-total-grand strong {
  font-size: 1.05rem;
}

.tracker-label {
  color: #64708a;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
</style>
