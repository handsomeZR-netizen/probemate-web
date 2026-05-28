export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "probemate-theme";
export const LANGUAGE_STORAGE_KEY = "probemate-lang";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function applyTheme(theme: ThemePreference) {
  if (typeof window === "undefined") return;
  const isDark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function storeTheme(theme: ThemePreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function storeLanguage(locale: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; sameSite=lax`;
}
