import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next";

const config = [
  { ignores: ["**/node_modules/**", "**/.next/**", "**/next-env.d.ts", "pnpm-lock.yaml"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  { settings: { next: { rootDir: "apps/web" } } },
];

export default config;
