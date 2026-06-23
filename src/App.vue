<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import AppHeader from "./components/AppHeader.vue";
import ControlsPanel from "./components/ControlsPanel.vue";
import CurrentTimerCard from "./components/CurrentTimerCard.vue";
import DailyReport from "./components/DailyReport.vue";
import EditFrameModal from "./components/EditFrameModal.vue";
import LogList from "./components/LogList.vue";
import ProjectTotals from "./components/ProjectTotals.vue";
import RangeCard from "./components/RangeCard.vue";
import ReportSkeleton from "./components/ReportSkeleton.vue";
import StickyTimerBar from "./components/StickyTimerBar.vue";
import { useWatsonDashboard } from "./composables/useWatsonDashboard";
import { forcePwaUpdate } from "./utils/pwa";

const dashboard = useWatsonDashboard();
const projectTotalsCollapsed = ref(true);
const logListCollapsed = ref(true);
const reportsDesktop = ref(false);

let reportsMediaQuery: MediaQueryList | null = null;

function syncReportsDesktop() {
  reportsDesktop.value = reportsMediaQuery?.matches ?? false;
}

function toggleProjectTotals() {
  const nextCollapsed = !projectTotalsCollapsed.value;

  projectTotalsCollapsed.value = nextCollapsed;
  if (reportsDesktop.value) {
    logListCollapsed.value = nextCollapsed;
  }
}

function toggleLogList() {
  const nextCollapsed = !logListCollapsed.value;

  logListCollapsed.value = nextCollapsed;
  if (reportsDesktop.value) {
    projectTotalsCollapsed.value = nextCollapsed;
  }
}

onMounted(() => {
  reportsMediaQuery = window.matchMedia("(min-width: 861px)");
  syncReportsDesktop();
  reportsMediaQuery.addEventListener("change", syncReportsDesktop);
});

onUnmounted(() => {
  reportsMediaQuery?.removeEventListener("change", syncReportsDesktop);
});
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
    <p v-if="dashboard.offlineQueueCount.value" class="offline-sync-notice">
      {{ dashboard.offlineMessage.value || `${dashboard.offlineQueueCount.value} offline action queued.` }}
      <button type="button" class="ghost" :disabled="dashboard.offlineSyncing.value" @click="dashboard.syncQueuedActions">
        {{ dashboard.offlineSyncing.value ? "Syncing..." : "Sync now" }}
      </button>
    </p>

    <CurrentTimerCard
      v-if="dashboard.watsonTimerEnabled.value || dashboard.status.value?.running"
      :status="dashboard.status.value"
      :current-project-display="dashboard.currentProjectDisplay.value"
      :current-elapsed-ms="dashboard.currentElapsedMs.value"
      :issue-for-project="dashboard.issueForProject"
    />

    <ControlsPanel
      v-model:selected-client-key="dashboard.selectedClientKey.value"
      v-model:selected-project="dashboard.selectedProject.value"
      v-model:project="dashboard.project.value"
      v-model:selected-tags="dashboard.selectedTags.value"
      v-model:custom-tags="dashboard.customTags.value"
      :client-options="dashboard.clientOptions.value"
      :project-picker-options="dashboard.projectPickerOptions.value"
      :using-custom-project="dashboard.usingCustomProject.value"
      :tag-options="dashboard.tagOptions.value"
      :custom-tag-options="dashboard.customTagOptions.value"
      :show-custom-tags="dashboard.showCustomTags.value"
      :primary-action-label="dashboard.primaryActionLabel.value"
      :can-start="dashboard.canStart.value"
      :watson-timer-enabled="dashboard.watsonTimerEnabled.value"
      :status="dashboard.status.value"
      @project-focus="dashboard.markProjectTouched"
      @project-change="dashboard.onProjectSelectionChange"
      @client-change="dashboard.onClientSelectionChange"
      @tag-change="dashboard.onTagSelectionChange"
      @open-custom-tags="dashboard.openCustomTagsInput"
      @commit-custom-tags="dashboard.commitCustomTags"
      @start="dashboard.start"
      @stop="dashboard.stop"
    />

    <StickyTimerBar
      v-if="
        (dashboard.watsonTimerEnabled.value || dashboard.status.value?.running) &&
        dashboard.status.value?.running &&
        dashboard.status.value.project
      "
      :status="dashboard.status.value"
      :project-name="dashboard.status.value.project"
      :current-elapsed-ms="dashboard.currentElapsedMs.value"
      :issue-for-project="dashboard.issueForProject"
      @stop="dashboard.stop"
    />

    <ReportSkeleton v-if="dashboard.loading.value" />

    <template v-else>
      <RangeCard
        v-model:range="dashboard.range.value"
        :time-tracker-reports="dashboard.sourceReports.value"
        :selected-range-label="dashboard.selectedRangeLabel.value"
        @range-change="dashboard.refresh"
        @move-week="dashboard.moveWeek"
        @show-this-week="dashboard.showThisWeek"
        @move-month="dashboard.moveMonth"
        @show-this-month="dashboard.showThisMonth"
      />

      <DailyReport
        :unified-daily-summaries="dashboard.unifiedDailySummaries.value"
        :max-daily-ms="dashboard.maxUnifiedDailyMs.value"
        :issue-for-project="dashboard.issueForProject"
      />

      <section class="columns">
        <ProjectTotals
          :time-tracker-reports="dashboard.sourceReports.value"
          :issue-for-project="dashboard.issueForProject"
          :collapsed="projectTotalsCollapsed"
          @toggle="toggleProjectTotals"
        />
        <LogList
          :frames-count="dashboard.frames.value.length"
          :log-days="dashboard.logDays.value"
          :issue-for-project="dashboard.issueForProject"
          :collapsed="logListCollapsed"
          @toggle="toggleLogList"
          @edit-frame="dashboard.openEditFrame"
          @remove-frame="dashboard.removeFrame"
        />
      </section>
    </template>

    <EditFrameModal
      :open="dashboard.editOpen.value"
      :draft="dashboard.editDraft.value"
      :saving="dashboard.editSaving.value"
      :error="dashboard.editError.value"
      :can-save="dashboard.canSaveEdit.value"
      @update:draft="dashboard.updateEditDraft"
      @cancel="dashboard.closeEditFrame"
      @save="dashboard.saveEditFrame"
    />
  </main>
</template>
