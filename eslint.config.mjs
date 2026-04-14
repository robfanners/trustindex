import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees and other dirs
    ".worktrees/**",
    ".claude/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // TG-52 — module capability pages must source their icons from the
  // canonical registry at src/lib/capabilityIcons.ts. Inline <svg> in
  // these page files drifts from the sidebar and breaks the single source
  // of truth. Use `getCapabilityIcon("<key>")` instead.
  {
    // Scope limited to the three module hub pages which are fully
    // registry-sourced. Sub-pages still use raw <svg> for non-capability
    // UI (arrows, status glyphs, chart icons) and are out of scope for
    // this rule.
    files: [
      "src/app/govern/page.tsx",
      "src/app/monitor/page.tsx",
      "src/app/prove/page.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='svg']",
          message:
            "Raw <svg> is not allowed in module capability pages. Import the icon via getCapabilityIcon() from @/lib/capabilityIcons (TG-52).",
        },
      ],
    },
  },
]);

export default eslintConfig;
