<script setup lang="ts">
import { formatDuration } from "../utils/time";

defineProps<{
  totalMs: number;
  selectedRangeLabel: string;
  range: string;
}>();

const emit = defineEmits<{
  "update:range": [value: string];
  rangeChange: [];
  moveWeek: [delta: number];
  showThisWeek: [];
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
</script>

<template>
  <article class="card range-card">
    <div class="range-card-header">
      <div>
        <span class="label">Selected range</span>
        <p>{{ selectedRangeLabel }}</p>
      </div>
      <strong>{{ formatDuration(totalMs) }}</strong>
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
  </article>
</template>
