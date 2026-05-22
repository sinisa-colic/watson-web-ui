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
    <div class="hero-main">
      <p class="eyebrow">
        <span class="brand-row">
          <span>Watson Web UI</span>
          <button
            type="button"
            class="version-badge"
            title="Check for updates and reload"
            @click="$emit('forcePwaUpdate')"
          >
            v{{ appVersion }}
          </button>
        </span>
        <button type="button" class="ghost header-refresh" :disabled="loading" @click="$emit('refresh')">
          <span>Refresh</span>
          <small v-if="lastRefreshedAt">Updated {{ formatLastRefreshed(lastRefreshedAt) }}</small>
        </button>
      </p>
    </div>
  </header>
</template>
