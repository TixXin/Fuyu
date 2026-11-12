import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const ipcImportRestriction = {
  paths: [
    {
      name: "@tauri-apps/api/core",
      importNames: ["invoke"],
      message: "invoke 只能在 api.ts 中使用，请通过对应目录的 api.ts 调用。",
    },
    {
      name: "@tauri-apps/api/event",
      importNames: ["listen"],
      message: "listen 只能在 api.ts 中使用，请通过对应目录的 api.ts 订阅。",
    },
  ],
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src-tauri/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-imports": ["error", ipcImportRestriction],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression[source.value=/^@tauri-apps\\u002Fapi\\u002F(core|event)$/]",
          message: "不要用动态 import 绕过 api.ts 的 IPC 收口。",
        },
      ],
    },
  },
  {
    files: ["src/**/api.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["src/utils/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react/*", "react-dom", "react-dom/*"], message: "utils/ 不得依赖 React。" },
            { group: ["@tauri-apps/*"], message: "utils/ 不得依赖 Tauri。" },
          ],
        },
      ],
    },
  },
);
