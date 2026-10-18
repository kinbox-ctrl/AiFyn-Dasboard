import { useEffect, useState } from "react";

const KEY = "aifyn-dash-theme";

export function useTheme() {
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#061414" : "#F7FAFA");
  }, [theme]);
  const setTheme = (t) => {
    try { localStorage.setItem(KEY, t); } catch {}
    setThemeState(t);
  };
  return [theme, setTheme];
}
