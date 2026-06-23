import type { Express } from "express";
import type { ReadClientQuery } from "../../types.js";
import { fetchIssueMap, fetchMyIssues, jiraStatusForClient } from "./service.js";

export function registerJiraRoutes(app: Express, readClientQuery: ReadClientQuery) {
  app.get("/api/jira/status", async (request, response, next) => {
    try {
      response.json(await jiraStatusForClient(readClientQuery(request)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jira/issues", async (request, response, next) => {
    try {
      const clientKey = readClientQuery(request);
      const status = await jiraStatusForClient(clientKey);
      if (!status.configured) {
        response.json({ configured: false, issues: [] });
        return;
      }

      response.json({ configured: true, issues: await fetchMyIssues(clientKey) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jira/issue-map", async (request, response, next) => {
    try {
      const clientKey = readClientQuery(request);
      const status = await jiraStatusForClient(clientKey);
      if (!status.configured) {
        response.json({});
        return;
      }

      const keysParam = typeof request.query.keys === "string" ? request.query.keys : "";
      const keys = keysParam
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);

      response.json(await fetchIssueMap(keys, clientKey));
    } catch (error) {
      next(error);
    }
  });
}
