<script setup lang="ts">
import { formatLastRefreshed } from "../utils/time";
import { useTheme } from "../composables/useTheme";

const appVersion = __APP_VERSION__;
const { isDark, toggleTheme } = useTheme();

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
  <header class="app-header">
    <div class="app-header-brand">
      <h1 class="app-header-title">Watson Web UI</h1>
      <button
        type="button"
        class="version-badge"
        title="Check for updates and reload"
        @click="$emit('forcePwaUpdate')"
      >
        v{{ appVersion }}
      </button>
    </div>

    <div class="app-header-actions">
      <button
        type="button"
        class="icon-btn theme-toggle"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleTheme"
      >
        <svg v-if="isDark" class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" stroke-width="1.75" />
          <path
            d="M12 2.5v2.25M12 19.25v2.25M4.22 4.22l1.59 1.59M18.19 18.19l1.59 1.59M2.5 12h2.25M19.25 12h2.25M4.22 19.78l1.59-1.59M18.19 5.81l1.59-1.59"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.75"
          />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M20.5 14.5a8.5 8.5 0 0 1-11-11 7 7 0 1 0 11 11Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
          />
        </svg>
      </button>

      <span class="action-divider" aria-hidden="true" />

      <button type="button" class="refresh-btn" :disabled="loading" @click="$emit('refresh')">
        <svg
          class="icon refresh-icon"
          :class="{ 'refresh-icon--spinning': loading }"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
          />
          <path
            d="M20 4v6h-6"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
          />
        </svg>
        <span class="refresh-copy">
          <span class="refresh-label">{{ loading ? "Refreshing…" : "Refresh" }}</span>
          <small v-if="lastRefreshedAt">Updated {{ formatLastRefreshed(lastRefreshedAt) }}</small>
        </span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  align-items: center;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.app-header-brand {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-width: 0;
}

.app-header-title {
  color: var(--color-text);
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0;
}

.version-badge {
  background: var(--color-accent-soft-bg);
  border: 1px solid var(--color-accent-soft-border);
  border-radius: 999px;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
  min-height: 0;
  padding: 0.22rem 0.45rem;
  text-transform: none;
}

.app-header-actions {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 0.35rem;
}

.action-divider {
  background: var(--color-border);
  height: 1.35rem;
  width: 1px;
}

.icon-btn {
  align-items: center;
  background: var(--color-accent-soft-bg);
  border: 1px solid var(--color-accent-soft-border);
  border-radius: 999px;
  color: var(--color-accent);
  cursor: pointer;
  display: inline-flex;
  height: 2.15rem;
  justify-content: center;
  min-height: 0;
  padding: 0;
  width: 2.15rem;
}

.icon-btn:hover {
  background: var(--color-accent-soft-border);
}

.icon {
  display: block;
  height: 1.05rem;
  width: 1.05rem;
}

.refresh-btn {
  align-items: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-accent);
  cursor: pointer;
  display: inline-flex;
  gap: 0.45rem;
  min-height: 0;
  padding: 0.38rem 0.7rem 0.38rem 0.55rem;
  text-transform: none;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-accent-soft-bg);
  border-color: var(--color-accent-soft-border);
}

.refresh-btn:disabled {
  cursor: wait;
  opacity: 0.65;
}

.refresh-copy {
  display: grid;
  gap: 0.08rem;
  justify-items: start;
  line-height: 1.1;
  text-align: left;
}

.refresh-label {
  font-size: 0.78rem;
  font-weight: 800;
}

.refresh-copy small {
  color: var(--color-text-muted);
  font-size: 0.62rem;
  font-weight: 650;
}

.refresh-icon--spinning {
  animation: refresh-spin 0.85s linear infinite;
}

@keyframes refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 860px) {
  .app-header {
    margin-bottom: 1rem;
  }

  .app-header-title {
    font-size: 0.95rem;
  }

  .icon-btn {
    height: 2rem;
    width: 2rem;
  }

  .refresh-btn {
    padding: 0.32rem 0.55rem 0.32rem 0.45rem;
  }

  .refresh-label {
    font-size: 0.72rem;
  }

  .refresh-copy small {
    font-size: 0.58rem;
  }
}

@media (max-width: 420px) {
  .refresh-copy small {
    display: none;
  }

  .refresh-btn {
    padding-inline: 0.45rem;
  }
}
</style>
