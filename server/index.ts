import "dotenv/config";
import { execFile } from "node:child_process";
import path from "node:path";
import express from "express";
import { fetchIssueMap, fetchMyIssues, jiraStatus } from "./jira.js";

type WatsonFrame = {
  id: string;
  project: string;
  start: string;
  stop: string;
  tags: string[];
};

type WatsonStatus = {
  running: boolean;
  project: string | null;
  tags: string[];
  elapsed: string | null;
  startedAt: string | null;
};

const MIN_WATSON_VERSION = "2.1.0";
const app = express();
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3131);
const projectRoot = process.cwd();
const staticDir = path.resolve(projectRoot, "dist");
const localWatsonDir = path.resolve(projectRoot, "Watson");

function resolveWatsonCommand(): { bin: string; prefixArgs: string[]; extraEnv: Record<string, string> } {
  const watsonBin = process.env.WATSON_BIN?.trim();

  if (watsonBin === "local") {
    // Run the bundled Watson/ via `python -m watson` with the local package
    // directory on PYTHONPATH so imports resolve without pip-installing.
    return {
      bin: process.env.PYTHON_BIN?.trim() || "python3",
      prefixArgs: ["-m", "watson"],
      extraEnv: {
        PYTHONPATH: [localWatsonDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)
      }
    };
  }

  // Default (unset) or explicit path/command — use the system watson or the
  // provided binary.
  return { bin: watsonBin || "watson", prefixArgs: [], extraEnv: {} };
}

const watson = resolveWatsonCommand();
let statusJsonSupported = false;

app.use(express.json());

function statusHelpSupportsJson(help: string): boolean {
  return /\s-j,\s+--json\b|\s--json\s+Format/i.test(help);
}

function runWatson(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      watson.bin,
      [...watson.prefixArgs, ...args],
      {
        timeout: 15000,
        env: { ...process.env, ...watson.extraEnv, NO_COLOR: "1" }
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }

        resolve(stdout.trim());
      }
    );
  });
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part) || 0);
  const rightParts = right.split(".").map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

async function assertWatsonAvailable() {
  let output: string;

  try {
    output = await runWatson(["--version"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Watson CLI is required but could not be run: ${message}`);
  }

  const version = output.match(/version\s+(\d+\.\d+\.\d+)/i)?.[1];
  if (!version) {
    throw new Error(`Could not determine Watson CLI version from: ${output}`);
  }

  if (compareVersions(version, MIN_WATSON_VERSION) < 0) {
    throw new Error(`Watson CLI ${MIN_WATSON_VERSION} or newer is required; found ${version}.`);
  }

  try {
    const help = await runWatson(["status", "--help"]);
    statusJsonSupported = statusHelpSupportsJson(help);
  } catch {
    statusJsonSupported = false;
  }
}

async function getFrames(range: string, from?: string, to?: string): Promise<WatsonFrame[]> {
  const allowedRanges = new Set(["day", "week", "month", "all"]);
  const safeRange = allowedRanges.has(range) ? range : "week";
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const args =
    from && to && datePattern.test(from) && datePattern.test(to)
      ? ["log", "--current", "--from", from, "--to", to, "--json"]
      : ["log", "--current", `--${safeRange}`, "--json"];
  const output = await runWatson(args);
  return output ? JSON.parse(output) : [];
}

async function listWatsonValues(kind: "projects" | "tags"): Promise<string[]> {
  const output = await runWatson([kind]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function getStopOnStart(): Promise<boolean> {
  try {
    const output = await runWatson(["config", "options.stop_on_start"]);
    return ["1", "on", "true", "yes"].includes(output.trim().toLowerCase());
  } catch {
    return false;
  }
}

async function getStatus(): Promise<WatsonStatus> {
  if (statusJsonSupported) {
    try {
      return await getStatusFromJson();
    } catch {
      return getStatusFromCurrentLog();
    }
  }

  return getStatusFromCurrentLog();
}

async function getStatusFromJson(): Promise<WatsonStatus> {
  const data = JSON.parse(await runWatson(["status", "--json"])) as {
    running: boolean;
    project?: string;
    tags?: string[];
    start?: string;
    elapsed?: string;
  };

  if (!data.running) {
    return {
      running: false,
      project: null,
      tags: [],
      elapsed: null,
      startedAt: null
    };
  }

  return {
    running: true,
    project: data.project ?? null,
    tags: data.tags ?? [],
    elapsed: data.elapsed ?? null,
    startedAt: data.start ?? null
  };
}

async function getStatusFromCurrentLog(): Promise<WatsonStatus> {
  const output = await runWatson(["log", "--current", "--all", "--json"]);
  const frames = output ? (JSON.parse(output) as WatsonFrame[]) : [];
  const current = frames.find((frame) => frame.id === "current");

  if (!current) {
    return {
      running: false,
      project: null,
      tags: [],
      elapsed: null,
      startedAt: null
    };
  }

  let elapsed: string | null;
  try {
    elapsed = await runWatson(["status", "--elapsed"]);
  } catch {
    elapsed = null;
  }

  return {
    running: true,
    project: current.project,
    tags: current.tags,
    elapsed,
    startedAt: current.start
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/status", async (_request, response, next) => {
  try {
    response.json(await getStatus());
  } catch (error) {
    next(error);
  }
});

app.get("/api/frames", async (request, response, next) => {
  try {
    response.json(
      await getFrames(
        String(request.query.range ?? "week"),
        typeof request.query.from === "string" ? request.query.from : undefined,
        typeof request.query.to === "string" ? request.query.to : undefined
      )
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/options", async (_request, response, next) => {
  try {
    const [projects, tags, stopOnStart] = await Promise.all([
      listWatsonValues("projects"),
      listWatsonValues("tags"),
      getStopOnStart()
    ]);
    response.json({ projects, tags, stopOnStart });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jira/status", (_request, response) => {
  response.json(jiraStatus());
});

app.get("/api/jira/issues", async (_request, response, next) => {
  try {
    if (!jiraStatus().configured) {
      response.json({ configured: false, issues: [] });
      return;
    }

    response.json({ configured: true, issues: await fetchMyIssues() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jira/issue-map", async (request, response, next) => {
  try {
    if (!jiraStatus().configured) {
      response.json({});
      return;
    }

    const keysParam = typeof request.query.keys === "string" ? request.query.keys : "";
    const keys = keysParam
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    response.json(await fetchIssueMap(keys));
  } catch (error) {
    next(error);
  }
});

app.post("/api/start", async (request, response, next) => {
  try {
    const project = String(request.body.project ?? "").trim();
    const tags = Array.isArray(request.body.tags)
      ? request.body.tags.map((tag: unknown) => `+${String(tag).replace(/^\+/, "")}`)
      : [];

    if (!project) {
      response.status(400).json({ error: "Project is required." });
      return;
    }

    const output = await runWatson(["start", project, ...tags]);
    response.json({ output, status: await getStatus() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/stop", async (_request, response, next) => {
  try {
    const output = await runWatson(["stop"]);
    response.json({ output, status: await getStatus() });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/frames/:id", async (request, response, next) => {
  try {
    const id = request.params.id;

    if (!/^[a-f0-9]{7,64}$/i.test(id)) {
      response.status(400).json({ error: "Only saved Watson frame IDs can be removed." });
      return;
    }

    const output = await runWatson(["remove", "--force", id]);
    response.json({ output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/switch", async (request, response, next) => {
  try {
    const project = String(request.body.project ?? "").trim();
    const tags = Array.isArray(request.body.tags)
      ? request.body.tags.map((tag: unknown) => `+${String(tag).replace(/^\+/, "")}`)
      : [];

    if (!project) {
      response.status(400).json({ error: "Project is required." });
      return;
    }

    const currentStatus = await getStatus();
    const willAutoStop = await getStopOnStart();
    const outputs: string[] = [];

    if (currentStatus.running && !willAutoStop) {
      outputs.push(await runWatson(["stop"]));
    }

    outputs.push(await runWatson(["start", project, ...tags]));
    response.json({ output: outputs.join("\n"), status: await getStatus() });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(staticDir));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(staticDir, "index.html"));
});

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(500).json({ error: error.message });
});

assertWatsonAvailable()
  .then(() => {
    const watsonBin = process.env.WATSON_BIN?.trim();
    const source = watsonBin === "local" ? `local (${localWatsonDir})` : watson.bin;
    app.listen(port, host, () => {
      console.log(`Watson API listening on http://${host}:${port} [watson: ${source}]`);
      console.log(
        statusJsonSupported
          ? "Watson status: using status --json"
          : "Watson status: using log --current --json fallback"
      );
    });
  })
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
