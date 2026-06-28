<script setup lang="ts">
import { computed } from "vue";
import type { EditFrameDraft } from "../composables/useWatsonDashboard";
import { formatDuration, toDatetimeLocalValue } from "../utils/time";

const props = defineProps<{
  open: boolean;
  draft: EditFrameDraft;
  saving: boolean;
  error: string;
  canSave: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  save: [];
  "update:draft": [value: EditFrameDraft];
}>();

function updateField<K extends keyof EditFrameDraft>(field: K, value: EditFrameDraft[K]) {
  emit("update:draft", { ...props.draft, [field]: value });
}

const durationMinutes = computed(() => {
  const start = new Date(props.draft.start);
  const stop = new Date(props.draft.stop);

  if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime())) {
    return 0;
  }

  return Math.max(1, Math.round((stop.getTime() - start.getTime()) / 60000));
});

const maxDurationMinutes = computed(() => Math.max(720, Math.ceil(durationMinutes.value / 30) * 30));
const durationLabel = computed(() => formatDuration(durationMinutes.value * 60000));

function setDurationMinutes(value: string) {
  const minutes = Math.max(5, Math.round((Number(value) || 5) / 5) * 5);
  const start = new Date(props.draft.start);

  if (Number.isNaN(start.getTime())) {
    return;
  }

  const stop = new Date(start.getTime() + minutes * 60000);
  updateField("stop", toDatetimeLocalValue(stop.toISOString()));
}

const readonlyTags = computed(() =>
  props.draft.tags
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^\+/, ""))
    .filter(Boolean)
);
</script>

<template>
  <div v-if="open" class="modal-root" role="presentation" @click.self="$emit('cancel')">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-frame-title">
      <header class="modal-header">
        <div>
          <span class="label">Log entry</span>
          <h2 id="edit-frame-title">Edit frame</h2>
        </div>
        <button type="button" class="ghost modal-close" aria-label="Close edit dialog" @click="$emit('cancel')">
          Close
        </button>
      </header>

      <form class="modal-form" @submit.prevent="$emit('save')">
        <label class="field">
          <span class="field-label">Task</span>
          <input
            :value="draft.project"
            placeholder="Task, e.g. PI-491 or daily"
            required
            @input="updateField('project', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field">
          <span class="field-label">Start</span>
          <input
            :value="draft.start"
            type="datetime-local"
            step="300"
            required
            @input="updateField('start', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <div class="field duration-field">
          <div class="duration-head">
            <span class="field-label">Duration</span>
            <strong>{{ durationLabel }}</strong>
          </div>
          <input
            class="duration-range"
            type="range"
            min="5"
            :max="maxDurationMinutes"
            step="5"
            :value="durationMinutes"
            @input="setDurationMinutes(($event.target as HTMLInputElement).value)"
          />
          <div class="duration-controls">
            <label>
              <span>Minutes</span>
              <input
                class="duration-minutes"
                type="number"
                min="5"
                step="5"
                :value="durationMinutes"
                @input="setDurationMinutes(($event.target as HTMLInputElement).value)"
              />
            </label>
            <span>Ends at {{ draft.stop.replace("T", " ") }}</span>
          </div>
        </div>

        <div class="field">
          <span class="field-label">Tags</span>
          <div v-if="readonlyTags.length" class="readonly-tags">
            <span v-for="tag in readonlyTags" :key="tag">+{{ tag }}</span>
          </div>
          <p v-else class="readonly-muted">No tags</p>
        </div>

        <p v-if="error" class="modal-error">{{ error }}</p>

        <div class="modal-actions">
          <button type="button" class="ghost" :disabled="saving" @click="$emit('cancel')">Cancel</button>
          <button type="submit" :disabled="!canSave">{{ saving ? "Saving..." : "Save changes" }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-root {
  align-items: center;
  background: var(--color-modal-backdrop);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 1rem;
  position: fixed;
  z-index: 40;
}

.modal-card {
  background: var(--color-surface-solid);
  border: 1px solid var(--color-accent-soft-border);
  border-radius: 24px;
  box-shadow: 0 24px 80px var(--color-shadow-modal);
  max-height: calc(100vh - 2rem);
  max-width: 34rem;
  overflow: auto;
  padding: 1.25rem;
  width: 100%;
}

.modal-header {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-header h2 {
  font-size: 1.35rem;
  margin: 0.25rem 0 0;
}

.modal-close {
  flex-shrink: 0;
}

.modal-form {
  display: grid;
  gap: 0.9rem;
}

.field {
  display: grid;
  gap: 0.35rem;
}

.readonly-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.readonly-tags span {
  background: var(--color-tag-readonly-bg);
  border: 1px solid var(--color-tag-readonly-border);
  border-radius: 999px;
  color: var(--color-tag-readonly-text);
  font-size: 0.82rem;
  font-weight: 800;
  padding: 0.28rem 0.55rem;
}

.readonly-muted {
  color: var(--color-text-muted);
  font-size: 0.92rem;
  margin: 0;
}

.field-row {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.duration-field {
  background: var(--color-duration-bg);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 0.85rem;
}

.duration-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.duration-head strong {
  color: var(--color-text);
  font-size: 1.25rem;
}

.duration-range {
  accent-color: var(--color-accent);
  border: 0;
  padding: 0;
  width: 100%;
}

.duration-controls {
  align-items: end;
  color: var(--color-text-muted);
  display: flex;
  font-size: 0.86rem;
  font-weight: 650;
  gap: 0.75rem;
  justify-content: space-between;
}

.duration-controls label {
  display: grid;
  gap: 0.25rem;
}

.duration-minutes {
  max-width: 7rem;
  padding: 0.45rem 0.6rem;
}

.field-label {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.modal-error {
  color: var(--color-modal-error);
  font-size: 0.92rem;
  font-weight: 600;
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

@media (max-width: 640px) {
  .field-row {
    grid-template-columns: 1fr;
  }

  .duration-controls {
    align-items: start;
    display: grid;
  }
}
</style>
