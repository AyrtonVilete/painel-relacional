// Fallback for a visitor with no theme cookie yet (first-ever visit): the
// root layout already renders the right class server-side from the
// `pr-theme` cookie for everyone who's toggled the theme before, so this
// only ever runs once per browser — it respects the OS's color-scheme
// preference and writes the cookie so the server can render it correctly
// from then on. Kept as a plain string (not an imported function) because
// it has to run standalone via dangerouslySetInnerHTML, outside the
// React/Next bundle, synchronously before paint.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (document.cookie.indexOf("pr-theme=") !== -1) return;
    var theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.cookie = "pr-theme=" + theme + "; path=/; max-age=31536000; SameSite=Lax";
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export const THEME_COOKIE_KEY = "pr-theme";
