import type { WatsonStatus } from "../types";
import { api } from "./api";

const STORAGE_KEY = "watson-web-ui-offline-actions";

export const WatsonActionType = {
  Start: "start",
  Switch: "switch",
  Stop: "stop"
} as const;

export type WatsonActionType = (typeof WatsonActionType)[keyof typeof WatsonActionType];

export type OfflineWatsonAction =
  | {
      id: string;
      type: typeof WatsonActionType.Start;
      project: string;
      tags: string[];
      at: string;
    }
  | {
      id: string;
      type: typeof WatsonActionType.Switch;
      project: string;
      tags: string[];
      at: string;
    }
  | {
      id: string;
      type: typeof WatsonActionType.Stop;
      at: string;
    };

export type OfflineWatsonActionInput =
  | Omit<Extract<OfflineWatsonAction, { type: typeof WatsonActionType.Start }>, "id">
  | Omit<Extract<OfflineWatsonAction, { type: typeof WatsonActionType.Switch }>, "id">
  | Omit<Extract<OfflineWatsonAction, { type: typeof WatsonActionType.Stop }>, "id">;

function readActions(): OfflineWatsonAction[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineWatsonAction[]) : [];
  } catch {
    return [];
  }
}

function writeActions(actions: OfflineWatsonAction[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  window.dispatchEvent(new CustomEvent("watson-offline-actions-changed"));
}

export function isOfflineApiError(error: unknown): boolean {
  if (!navigator.onLine) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|offline and no cached|load failed/i.test(message);
}

export function queuedOfflineActions() {
  return readActions();
}

export function queueOfflineAction(action: OfflineWatsonActionInput) {
  const nextAction = {
    ...action,
    id: `${Date.now()}-${crypto.randomUUID()}`
  } as OfflineWatsonAction;

  writeActions([...readActions(), nextAction]);
  return nextAction;
}

export function statusFromOfflineQueue(actions: OfflineWatsonAction[] = readActions()): WatsonStatus | null {
  if (!actions.length) {
    return null;
  }

  let status: WatsonStatus | null = null;

  for (const action of actions) {
    if (action.type === WatsonActionType.Stop) {
      status = {
        running: false,
        project: null,
        tags: [],
        elapsed: null,
        startedAt: null
      };
      continue;
    }

    status = {
      running: true,
      project: action.project,
      tags: action.tags,
      elapsed: "offline",
      startedAt: action.at
    };
  }

  return status;
}

export async function syncOfflineActions() {
  const actions = readActions()
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const byTimestamp = left.action.at.localeCompare(right.action.at);
      return byTimestamp !== 0 ? byTimestamp : left.index - right.index;
    })
    .map(({ action }) => action);

  for (const action of actions) {
    if (action.type === WatsonActionType.Stop) {
      await api("/api/stop", {
        method: "POST",
        body: JSON.stringify({ at: action.at })
      });
    } else if (action.type === WatsonActionType.Switch) {
      await api("/api/switch", {
        method: "POST",
        body: JSON.stringify({ project: action.project, tags: action.tags, at: action.at })
      });
    } else {
      await api("/api/start", {
        method: "POST",
        body: JSON.stringify({ project: action.project, tags: action.tags, at: action.at })
      });
    }

    writeActions(readActions().filter((queued) => queued.id !== action.id));
  }
}
