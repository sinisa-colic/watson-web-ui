<script setup lang="ts">
import { ref } from "vue";
import type { JiraIssue, LogDay, WatsonFrame } from "../types";
import { parseIssueKey } from "../utils/jira";
import { formatClock, formatDuration, frameDuration } from "../utils/time";

defineProps<{
  framesCount: number;
  logDays: LogDay[];
  issueForProject: (name: string) => JiraIssue | null;
}>();

defineEmits<{
  removeFrame: [frame: WatsonFrame];
}>();

const collapsed = ref(true);
</script>

<template>
  <article class="card">
    <button type="button" class="section-title" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <span class="section-heading-group">
        <span class="label">Frames</span>
        <span class="section-heading">Log</span>
      </span>
      <span class="section-meta">
        {{ framesCount }} frame{{ framesCount === 1 ? "" : "s" }}
        <span class="section-chevron" aria-hidden="true">{{ collapsed ? "Show" : "Hide" }}</span>
      </span>
    </button>

    <div v-if="logDays.length" v-show="!collapsed" class="log-days">
      <section v-for="day in logDays" :key="day.key" class="log-day">
        <header class="log-day-header">
          <strong>{{ day.label }}</strong>
          <span>{{ formatDuration(day.duration) }}</span>
        </header>

        <article v-for="frame in day.frames" :key="frame.id" class="log-frame">
          <div class="log-time">
            <strong>{{ formatClock(frame.start) }} -> {{ formatClock(frame.stop) }}</strong>
            <span>{{ formatDuration(frameDuration(frame)) }}</span>
          </div>
          <div class="log-main">
            <div class="log-project-head">
              <span v-if="parseIssueKey(frame.project)" class="issue-key-badge">{{ parseIssueKey(frame.project) }}</span>
              <strong>{{ issueForProject(frame.project)?.summary ?? frame.project }}</strong>
            </div>
            <div v-if="frame.tags.length" class="log-tags">
              <span v-for="tag in frame.tags" :key="tag" class="tag-pill">+{{ tag }}</span>
            </div>
          </div>
          <code>{{ frame.id.slice(0, 7) }}</code>
          <button v-if="frame.id !== 'current'" type="button" class="danger ghost" @click="$emit('removeFrame', frame)">
            Remove
          </button>
        </article>
      </section>
    </div>
    <p v-else v-show="!collapsed">No log entries in this range.</p>
  </article>
</template>
