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

const STALE_MODULE_PATTERNS = [
  "Importing a module script failed",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Load failed",
  "_result.default",
  "Cannot read properties of undefined (reading 'default')",
  "undefined is not an object (evaluating 'e._result.default')",
];

const matchesStaleModule = (msg: string) =>
  STALE_MODULE_PATTERNS.some((p) => msg.includes(p));

window.addEventListener("unhandledrejection", (event) => {
  const message = String(event.reason?.message ?? event.reason ?? "");
  if (matchesStaleModule(message)) {
    event.preventDefault();
    recoverFromStaleModule();
  }
});

window.addEventListener("error", (event) => {
  const message = String(event.error?.message ?? event.message ?? "");
  if (matchesStaleModule(message)) {
    event.preventDefault();
    recoverFromStaleModule();
  }
});

// Ensure Node-style global exists for browser (needed by some deps like react-mathquill)
if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis;
}

createRoot(document.getElementById("root")!).render(<App />);
