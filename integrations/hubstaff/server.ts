import type { Express } from "express";
import type { ReadClientQuery } from "../../server/client-resolution.js";
import { fetchHubstaffProjects, fetchHubstaffReport, fetchHubstaffTasks, hubstaffStatusForClient } from "./service.js";

export function registerRoutes(app: Express, readClientQuery: ReadClientQuery) {
  app.get("/api/hubstaff/status", async (request, response, next) => {
    try {
      response.json(await hubstaffStatusForClient(readClientQuery(request)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hubstaff/report", async (request, response, next) => {
    try {
      const clientKey = readClientQuery(request);
      const status = await hubstaffStatusForClient(clientKey);
      if (!status.configured) {
        response.json({ configured: false, totalSeconds: 0, daily: [], projects: [] });
        return;
      }

      const from = typeof request.query.from === "string" ? request.query.from : "";
      const to = typeof request.query.to === "string" ? request.query.to : "";
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (!datePattern.test(from) || !datePattern.test(to)) {
        response.status(400).json({ error: "Query params 'from' and 'to' must use YYYY-MM-DD." });
        return;
      }

      const report = await fetchHubstaffReport(from, to, clientKey);
      response.json({ configured: true, ...(report ?? { totalSeconds: 0, daily: [], projects: [] }) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hubstaff/projects", async (request, response, next) => {
    try {
      const clientKey = readClientQuery(request);
      const status = await hubstaffStatusForClient(clientKey);
      if (!status.configured) {
        response.json({ configured: false, projects: [] });
        return;
      }

      response.json({ configured: true, projects: await fetchHubstaffProjects(clientKey) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hubstaff/tasks", async (request, response, next) => {
    try {
      const clientKey = readClientQuery(request);
      const status = await hubstaffStatusForClient(clientKey);
      if (!status.configured) {
        response.json({ configured: false, tasks: [] });
        return;
      }

      response.json({ configured: true, tasks: await fetchHubstaffTasks(clientKey) });
    } catch (error) {
      next(error);
    }
  });
}
