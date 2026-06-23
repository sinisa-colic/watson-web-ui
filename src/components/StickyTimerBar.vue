<script setup lang="ts">
import type { WatsonStatus } from "../types";
import type { PickerItem } from "#integrations/types";
import { formatStopwatch } from "../utils/time";

defineProps<{
  status: WatsonStatus;
  projectName: string;
  currentElapsedMs: number;
  issueForProject: (name: string) => PickerItem | null;
}>();

defineEmits<{
  stop: [];
}>();
</script>

<template>
  <div class="sticky-timer" role="region" aria-label="Running timer">
    <span v-if="issueForProject(projectName)" class="issue-key-badge">{{ projectName }}</span>
    <span v-else class="sticky-project">{{ projectName }}</span>
    <span class="sticky-time">{{ formatStopwatch(currentElapsedMs) }}</span>
    <button type="button" class="sticky-stop" @click="$emit('stop')">Stop</button>
  </div>
</template>
