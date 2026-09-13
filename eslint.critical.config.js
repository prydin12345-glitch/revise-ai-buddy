import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// A separate blocking gate; the full existing `npm run lint` remains unchanged.
// Existing style/type lint debt must not hide hook-order runtime failures.
export default tseslint.config({
  files: ["**/*.{ts,tsx}"],
  // Other rules run only in the full lint command, so their existing suppression
  // comments are intentionally irrelevant to this small, blocking check.
  linterOptions: { reportUnusedDisableDirectives: false },
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { "react-hooks": reactHooks },
  rules: { "react-hooks/rules-of-hooks": "error" },
});
