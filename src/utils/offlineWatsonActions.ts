import { api } from "./api";

const STORAGE_KEY = "watson-web-ui-offline-actions";

export type OfflineWatsonAction =
  | {
      id: string;
      type: "start";
      project: string;
      tags: string[];
      at: string;
    }
  | {
      id: string;
      type: "stop";
      at: string;
    };

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

export function queuedOfflineActions() {
  return readActions();
}

export function queueOfflineAction(action: Omit<OfflineWatsonAction, "id">) {
  const nextAction = {
    ...action,
    id: `${Date.now()}-${crypto.randomUUID()}`
  } as OfflineWatsonAction;

  writeActions([...readActions(), nextAction]);
  return nextAction;
}

export async function syncOfflineActions() {
  const actions = readActions();

  for (const action of actions) {
    if (action.type === "start") {
      await api("/api/start", {
        method: "POST",
        body: JSON.stringify({ project: action.project, tags: action.tags, at: action.at })
      });
    } else {
      await api("/api/stop", {
        method: "POST",
        body: JSON.stringify({ at: action.at })
      });
    }

    writeActions(readActions().filter((queued) => queued.id !== action.id));
  }
}
