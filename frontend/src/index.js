import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/i18n";
import App from "@/App";

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  // When a new service worker takes control (new build activated), reload once
  // so the page runs the latest code instead of a stale cached bundle.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Proactively check for an updated worker on each load.
      reg.update().catch(() => {});
    }).catch((err) => {
      console.warn("SW registration failed", err);
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
