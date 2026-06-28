import { computed, ref } from "vue";

export type Theme = "light" | "dark";

const STORAGE_KEY = "watson-theme";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#161c28" : "#315efb");
}

const theme = ref<Theme>("light");
let systemListenerAttached = false;

function attachSystemListener() {
  if (systemListenerAttached) {
    return;
  }

  systemListenerAttached = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (loadStoredTheme()) {
      return;
    }

    const nextTheme: Theme = event.matches ? "dark" : "light";
    theme.value = nextTheme;
    applyTheme(nextTheme);
  });
}

export function initTheme() {
  const stored = loadStoredTheme();
  const resolved = stored ?? getSystemTheme();

  theme.value = resolved;
  applyTheme(resolved);

  if (!stored) {
    attachSystemListener();
  }
}

export function useTheme() {
  const isDark = computed(() => theme.value === "dark");

  function setTheme(nextTheme: Theme) {
    theme.value = nextTheme;

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }

    applyTheme(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme.value === "dark" ? "light" : "dark");
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  };
}
