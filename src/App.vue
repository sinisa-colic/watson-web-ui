<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
import ControlsPanel from "./components/ControlsPanel.vue";
import CurrentTimerCard from "./components/CurrentTimerCard.vue";
import DailyReport from "./components/DailyReport.vue";
import LogList from "./components/LogList.vue";
import ProjectTotals from "./components/ProjectTotals.vue";
import RangeCard from "./components/RangeCard.vue";
import ReportSkeleton from "./components/ReportSkeleton.vue";
import StickyTimerBar from "./components/StickyTimerBar.vue";
import { useWatsonDashboard } from "./composables/useWatsonDashboard";
import { forcePwaUpdate } from "./utils/pwa";

const dashboard = useWatsonDashboard();
</script>

<template>
  <main class="shell" :class="{ 'shell-running': dashboard.status.value?.running }">
    <AppHeader
      :loading="dashboard.loading.value"
      :last-refreshed-at="dashboard.lastRefreshedAt.value"
      @refresh="dashboard.refresh"
      @force-pwa-update="forcePwaUpdate"
    />

    <p v-if="dashboard.error.value" class="error">{{ dashboard.error.value }}</p>

    <CurrentTimerCard
      :status="dashboard.status.value"
      :current-project-display="dashboard.currentProjectDisplay.value"
      :current-elapsed-ms="dashboard.currentElapsedMs.value"
      :issue-for-project="dashboard.issueForProject"
    />

    <ControlsPanel
      v-model:selected-project="dashboard.selectedProject.value"
      v-model:project="dashboard.project.value"
      v-model:selected-tags="dashboard.selectedTags.value"
      v-model:custom-tags="dashboard.customTags.value"
      :project-picker-options="dashboard.projectPickerOptions.value"
      :using-custom-project="dashboard.usingCustomProject.value"
      :tag-options="dashboard.tagOptions.value"
      :custom-tag-options="dashboard.customTagOptions.value"
      :show-custom-tags="dashboard.showCustomTags.value"
      :primary-action-label="dashboard.primaryActionLabel.value"
      :can-start="dashboard.canStart.value"
      :status="dashboard.status.value"
      @project-focus="dashboard.markProjectTouched"
      @project-change="dashboard.onProjectSelectionChange"
      @tag-change="dashboard.onTagSelectionChange"
      @open-custom-tags="dashboard.openCustomTagsInput"
      @commit-custom-tags="dashboard.commitCustomTags"
      @start="dashboard.start"
      @stop="dashboard.stop"
    />

    <StickyTimerBar
      v-if="dashboard.status.value?.running && dashboard.status.value.project"
      :status="dashboard.status.value"
      :project-name="dashboard.status.value.project"
      :current-elapsed-ms="dashboard.currentElapsedMs.value"
      @stop="dashboard.stop"
    />

    <ReportSkeleton v-if="dashboard.loading.value" />

    <template v-else>
      <RangeCard
        v-model:range="dashboard.range.value"
        :total-ms="dashboard.totalMs.value"
        :selected-range-label="dashboard.selectedRangeLabel.value"
        @range-change="dashboard.refresh"
        @move-week="dashboard.moveWeek"
        @show-this-week="dashboard.showThisWeek"
      />

      <DailyReport
        :daily-summaries="dashboard.dailySummaries.value"
        :max-daily-ms="dashboard.maxDailyMs.value"
        :project-label="dashboard.projectLabel"
      />

      <section class="columns">
        <ProjectTotals
          :totals-by-project="dashboard.totalsByProject.value"
          :issue-for-project="dashboard.issueForProject"
        />
        <LogList
          :frames-count="dashboard.frames.value.length"
          :log-days="dashboard.logDays.value"
          :issue-for-project="dashboard.issueForProject"
          @remove-frame="dashboard.removeFrame"
        />
      </section>
    </template>
  </main>
</template>
