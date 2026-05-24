export type WatsonCliConfig = {
  stopOnStart: boolean;
  dateFormat: string;
  timeFormat: string;
  weekStart: string;
};

const WATSON_CONFIG_DEFAULTS: WatsonCliConfig = {
  stopOnStart: false,
  dateFormat: "%Y.%m.%d",
  timeFormat: "%H:%M:%S%z",
  weekStart: "monday"
};

function parseWatsonBoolean(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return ["1", "on", "true", "yes"].includes(value.trim().toLowerCase());
}

export async function loadWatsonCliConfig(
  readValue: (key: string) => Promise<string>
): Promise<WatsonCliConfig> {
  const [stopOnStart, dateFormat, timeFormat, weekStart] = await Promise.all([
    readValue("options.stop_on_start"),
    readValue("options.date_format"),
    readValue("options.time_format"),
    readValue("options.week_start")
  ]);

  return {
    stopOnStart: parseWatsonBoolean(stopOnStart),
    dateFormat: dateFormat.trim() || WATSON_CONFIG_DEFAULTS.dateFormat,
    timeFormat: timeFormat.trim() || WATSON_CONFIG_DEFAULTS.timeFormat,
    weekStart: weekStart.trim().toLowerCase() || WATSON_CONFIG_DEFAULTS.weekStart
  };
}
