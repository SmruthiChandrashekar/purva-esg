import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n"; // Initialize enterprise i18next
import "./styles/global.css";
import App from "./App";
// Loaded after App (and the CSS its components import) so the responsive rules win
import "./styles/responsive.css";
import { reloadOnceForNewVersion } from "./utils/newVersionReload";

// A tab opened before a new deploy asks for code files that no longer exist:
// reload once to pick up the new version instead of showing an error.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});
import "./styles/apple.css"; // after App so it layers over component CSS
import { ThemeProvider } from "./context/ThemeContext";
import { initMotion } from "./utils/motion";

// Register Service Worker for PWA (offline caching + background sync)
if ("serviceWorker" in navigator) {
  // When a newer service worker takes over a page that an older one served,
  // reload once so the old page never keeps running against new files.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadedForNewWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloadedForNewWorker) return;
    reloadedForNewWorker = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

initMotion();
