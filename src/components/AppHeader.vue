<script setup lang="ts">
import { formatLastRefreshed } from "../utils/time";

const appVersion = __APP_VERSION__;

defineProps<{
  loading: boolean;
  lastRefreshedAt: Date | null;
}>();

defineEmits<{
  refresh: [];
  forcePwaUpdate: [];
}>();
</script>

<template>
  <header class="hero">
    <div>
      <p class="eyebrow">
        <span>Watson Web UI</span>
        <button
          type="button"
          class="version-badge"
          title="Check for updates and reload"
          @click="$emit('forcePwaUpdate')"
        >
          v{{ appVersion }}
        </button>
      </p>
      <h1>Time report and controls</h1>
      <p v-if="lastRefreshedAt" class="last-refreshed">Updated {{ formatLastRefreshed(lastRefreshedAt) }}</p>
    </div>
    <button type="button" class="ghost header-refresh" :disabled="loading" @click="$emit('refresh')">Refresh</button>
  </header>
</template>
