// Runs synchronously as the first thing in <body>, before paint, so the
// correct theme class is already on <html> when content first renders —
// avoids a flash of the wrong theme. Kept as a plain string (not an
// imported function) because it has to run standalone via
// dangerouslySetInnerHTML, outside the React/Next bundle.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("pr-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export const THEME_STORAGE_KEY = "pr-theme";
