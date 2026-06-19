<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { ClientOption, WatsonStatus } from "../types";
import { ALL_CLIENTS_KEY, CUSTOM_PROJECT_OPTION } from "../composables/useWatsonDashboard";

export type ProjectPickerOption = {
  key: string;
  label: string;
  subtitle?: string;
};

const props = defineProps<{
  clientOptions: ClientOption[];
  selectedClientKey: string;
  projectPickerOptions: ProjectPickerOption[];
  selectedProject: string;
  usingCustomProject: boolean;
  project: string;
  tagOptions: string[];
  selectedTags: string[];
  customTagOptions: string[];
  showCustomTags: boolean;
  customTags: string;
  primaryActionLabel: string;
  canStart: boolean;
  status: WatsonStatus | null;
}>();

const emit = defineEmits<{
  "update:selectedClientKey": [value: string];
  "update:selectedProject": [value: string];
  "update:project": [value: string];
  "update:selectedTags": [value: string[]];
  "update:customTags": [value: string];
  projectFocus: [];
  projectChange: [];
  clientChange: [];
  tagChange: [];
  commitCustomTags: [];
  openCustomTags: [];
  start: [];
  stop: [];
}>();

const customProjectInput = ref<HTMLInputElement | null>(null);
const customTagsInput = ref<HTMLInputElement | null>(null);
const tagPickerOpen = ref(false);

const availableTagOptions = computed(() =>
  [...new Set([...props.tagOptions, ...props.customTagOptions])].filter(
    (tag) => !props.selectedTags.includes(tag)
  )
);

function onProjectSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emit("update:selectedProject", value);
  emit("projectChange");

  if (value === CUSTOM_PROJECT_OPTION) {
    void nextTick(() => customProjectInput.value?.focus());
  }
}

function removeTag(tag: string) {
  emit(
    "update:selectedTags",
    props.selectedTags.filter((value) => value !== tag)
  );
}

function addTag(tag: string) {
  if (props.selectedTags.includes(tag)) {
    return;
  }
  emit("update:selectedTags", [...props.selectedTags, tag]);
  tagPickerOpen.value = false;
}

function openCustomTags() {
  tagPickerOpen.value = false;
  emit("openCustomTags");
}
function onClientSelect(event: Event) {
  emit("update:selectedClientKey", (event.target as HTMLSelectElement).value);
  emit("clientChange");
}
</script>

<template>
  <section class="card controls-card">
    <div class="controls-groups">
      <div v-if="clientOptions.length" class="control-group client-field">
        <span class="field-label">Client</span>
        <select :value="selectedClientKey" @change="onClientSelect">
          <option :value="ALL_CLIENTS_KEY">All clients</option>
          <option v-for="client in clientOptions" :key="client.key" :value="client.key">
            {{ client.label }}
          </option>
        </select>
      </div>

      <div class="control-group project-field" @focusin="$emit('projectFocus')">
        <span class="field-label">Project</span>
        <select :value="selectedProject" @change="onProjectSelect">
          <option :value="CUSTOM_PROJECT_OPTION">Custom project...</option>
          <option v-for="option in projectPickerOptions" :key="option.key" :value="option.key">
            {{ option.subtitle ? `${option.key} - ${option.subtitle}` : option.label }}
          </option>
        </select>
        <div v-if="usingCustomProject" class="custom-project-input">
          <input
            ref="customProjectInput"
            :value="project"
            placeholder="Project, e.g. PI-491"
            @input="$emit('update:project', ($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="project"
            type="button"
            class="clear-field"
            aria-label="Clear project"
            @click="$emit('update:project', '')"
          >
            x
          </button>
        </div>
      </div>

      <div class="control-group tags-field">
        <span class="field-label">Tags</span>
        <div class="tag-chips">
          <span v-for="tag in selectedTags" :key="tag" class="tag-pill tag-pill-removable">
            +{{ tag }}
            <button type="button" class="tag-remove" :aria-label="`Remove tag ${tag}`" @click="removeTag(tag)">
              x
            </button>
          </span>
          <button
            v-if="availableTagOptions.length"
            type="button"
            class="ghost tag-add-btn"
            @click="tagPickerOpen = !tagPickerOpen"
          >
            Add tag
          </button>
          <button type="button" class="ghost tag-add-btn" @click="openCustomTags">Custom tag</button>
        </div>
        <select
          v-if="tagPickerOpen && availableTagOptions.length"
          class="tag-picker"
          @change="addTag(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled selected>Choose a tag</option>
          <option v-for="option in availableTagOptions" :key="option" :value="option">+{{ option }}</option>
        </select>
        <div v-if="showCustomTags" class="custom-tags-input">
          <input
            ref="customTagsInput"
            :value="customTags"
            placeholder="Custom tags, e.g. zowio billable"
            @input="$emit('update:customTags', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="$emit('commitCustomTags')"
          />
          <button
            v-if="customTags"
            type="button"
            class="clear-field"
            aria-label="Clear custom tags"
            @click="$emit('update:customTags', '')"
          >
            x
          </button>
        </div>
      </div>

      <div class="control-group control-actions">
        <span class="field-label">Actions</span>
        <div class="action-buttons">
          <button
            type="button"
            class="btn-start"
            :class="{ ghost: status?.running }"
            :disabled="!canStart || !project"
            @click="$emit('start')"
          >
            {{ primaryActionLabel }}
          </button>
          <button type="button" class="btn-stop" :disabled="!status?.running" @click="$emit('stop')">Stop</button>
        </div>
      </div>
    </div>
  </section>
</template>
