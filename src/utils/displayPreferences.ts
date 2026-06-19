export type WatsonDisplayPreferences = {
  hour12: boolean;
  weekStart: string;
};

const defaults: WatsonDisplayPreferences = {
  hour12: false,
  weekStart: "monday"
};

let preferences: WatsonDisplayPreferences = { ...defaults };

export function applyWatsonDisplayPreferences(config: {
  timeFormat: string;
  weekStart: string;
}) {
  preferences = {
    hour12: false,
    weekStart: config.weekStart.toLowerCase() || defaults.weekStart
  };
}

export function getWatsonDisplayPreferences() {
  return preferences;
}
