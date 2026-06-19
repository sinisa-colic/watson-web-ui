import { env } from "./server/clientConfig";
import type { WatsonLocalUiConfig } from "./server/clientConfig";

export default {
  defaultClientKey: env("WATSON_DEFAULT_CLIENT", "client-a"),
  clients: [
    {
      key: env("CLIENT_A_KEY", "client-a"),
      label: env("CLIENT_A_LABEL", "Client A"),
      tag: env("CLIENT_A_WATSON_TAG", "client-a"),
      jira: {
        baseUrl: env("CLIENT_A_JIRA_BASE_URL", ""),
        email: env("CLIENT_A_JIRA_EMAIL", ""),
        apiToken: env("CLIENT_A_JIRA_API_TOKEN", ""),
        jql: env("CLIENT_A_JIRA_JQL", "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC")
      }
    },
    {
      key: env("CLIENT_B_KEY", "client-b"),
      label: env("CLIENT_B_LABEL", "Client B"),
      tag: env("CLIENT_B_WATSON_TAG", "client-b"),
      jira: {
        baseUrl: env("CLIENT_B_JIRA_BASE_URL", ""),
        email: env("CLIENT_B_JIRA_EMAIL", ""),
        apiToken: env("CLIENT_B_JIRA_API_TOKEN", ""),
        jql: env("CLIENT_B_JIRA_JQL", "assignee=currentUser() AND statusCategory != Done ORDER BY updated DESC")
      }
    }
  ]
} satisfies WatsonLocalUiConfig;
