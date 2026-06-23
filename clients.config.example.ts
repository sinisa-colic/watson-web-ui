import { hubstaffFromEnv, jiraFromEnv } from "./server/config-helpers";
import { env } from "./server/clientConfig";
import type { WatsonLocalUiConfig } from "./server/clientConfig";

export default {
  defaultClientKey: env("WATSON_DEFAULT_CLIENT", "client-a"),
  clients: [
    {
      key: env("CLIENT_A_KEY", "client-a"),
      label: env("CLIENT_A_LABEL", "Client A"),
      tag: env("CLIENT_A_WATSON_TAG", "client-a"),
      jira: jiraFromEnv("CLIENT_A"),
      hubstaff: hubstaffFromEnv("CLIENT_A")
    },
    {
      key: env("CLIENT_B_KEY", "client-b"),
      label: env("CLIENT_B_LABEL", "Client B"),
      tag: env("CLIENT_B_WATSON_TAG", "client-b"),
      jira: jiraFromEnv("CLIENT_B"),
      hubstaff: hubstaffFromEnv("CLIENT_B")
    },
    // Hubstaff-only client — omit Watson timer and exclude tagged frames from Watson reports:
    // {
    //   key: env("CLIENT_C_KEY", "client-c"),
    //   label: env("CLIENT_C_LABEL", "Client C"),
    //   tag: env("CLIENT_C_WATSON_TAG", "client-c"),
    //   watsonTracking: false,
    //   hubstaff: hubstaffFromEnv("CLIENT_C")
    // }
  ]
} satisfies WatsonLocalUiConfig;
