import { computed, type ComputedRef, type Ref } from "vue";
import type { ClientOption, WatsonFrame } from "../../types";
import type { TimeTrackerSourceReport } from "./types";
import { buildWatsonTimeTrackerReport } from "./watson-report";

type WatsonLoaderContext = {
  frames: Ref<WatsonFrame[]>;
  clientOptions: ComputedRef<ClientOption[]>;
};

export function createWatsonIntegration(context: WatsonLoaderContext) {
  const sourceReports = computed<TimeTrackerSourceReport[]>(() => {
    const report = buildWatsonTimeTrackerReport(context.frames.value, context.clientOptions.value);
    if (report.totalMs === 0 && report.daily.length === 0) {
      return [];
    }
    return [report];
  });

  function load() {
    // Watson is local — report is reactively derived from frames.
  }

  function reset() {
    // No async state to clear; frames are managed by the dashboard.
  }

  return {
    sourceReports,
    load,
    reset
  };
}
