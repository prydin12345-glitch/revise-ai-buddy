import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // One React/router instance only — a second copy breaks hooks and Router context.
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  define: {
    global: 'window',
  },
  optimizeDeps: {
    // Pre-bundle core libraries up front so a mid-session re-optimisation
    // cannot split them into mismatched chunks.
    include: [
      'react-mathquill',
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react-router',
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },
}));
