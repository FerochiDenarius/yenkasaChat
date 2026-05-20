import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

const THEME_KEY = "yenkasa_ai_theme";

export default function AiThemeLayout() {
  const [theme, setTheme] = useState(() => window.localStorage.getItem(THEME_KEY) || "light");

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return (
    <div className="ai-theme ai-font min-h-screen" data-theme={theme}>
      <Outlet context={value} />
    </div>
  );
}
