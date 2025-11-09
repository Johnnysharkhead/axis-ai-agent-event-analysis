const THEME_KEY = "axisThemePreference";
const DARK_CLASS = "theme-dark";
export const THEME_EVENT = "axis-theme-change";

export function getSavedTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) || "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const body = document.body;
  const root = document.documentElement;
  if (!body || !root) return;

  if (theme === "dark") {
    body.classList.add(DARK_CLASS);
    root.classList.add(DARK_CLASS);
    root.setAttribute("data-theme", "dark");
  } else {
    body.classList.remove(DARK_CLASS);
    root.classList.remove(DARK_CLASS);
    root.setAttribute("data-theme", "light");
  }
}

export function setTheme(theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}
