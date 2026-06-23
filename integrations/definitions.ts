import { jiraDefinition } from "./jira/definition.js";
import { hubstaffDefinition } from "./hubstaff/definition.js";

export const definitions = [jiraDefinition, hubstaffDefinition] as const;
export type IntegrationId = (typeof definitions)[number]["id"];
