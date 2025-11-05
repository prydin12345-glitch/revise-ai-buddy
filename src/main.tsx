import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure Node-style global exists for browser (needed by some deps like react-mathquill)
if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis;
}

createRoot(document.getElementById("root")!).render(<App />);
