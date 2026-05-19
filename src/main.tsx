import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const recoverFromStaleModule = () => {
  const reloadKey = "examly:module-reload-at";
  const lastReload = Number(sessionStorage.getItem(reloadKey) ?? "0");
  const now = Date.now();

  if (now - lastReload < 30_000) return;

  sessionStorage.setItem(reloadKey, String(now));
  window.location.reload();
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleModule();
});

window.addEventListener("unhandledrejection", (event) => {
  const message = String(event.reason?.message ?? event.reason ?? "");
  if (
    message.includes("Importing a module script failed") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Load failed")
  ) {
    event.preventDefault();
    recoverFromStaleModule();
  }
});

// Ensure Node-style global exists for browser (needed by some deps like react-mathquill)
if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis;
}

createRoot(document.getElementById("root")!).render(<App />);
