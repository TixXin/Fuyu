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

const ipcDynamicImport = {
  selector: "ImportExpression[source.value=/^@tauri-apps\\u002Fapi\\u002F(core|event)$/]",
  message: "不要用动态 import 绕过 api.ts 的 IPC 收口。",
};

const pluginSwitchDirs = ["src/features/plugin-kernel/**", "src/windows/settings/**", "src/windows/island/**"];

const buildKindGate = {
  selector: "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][property.name='env']",
  message: "插件平台和设置页显示与否只看 Rust 报告的开关（getPluginHostConnection().enabled），不看前端构建类型 import.meta.env。",
};

const hostFiles =["src/features/*/host/**/*.{js,mjs,ts,mts}", "packages/plugin-base/src/host/**/*.{js,mjs,ts,mts}"];

const hostMessage = "宿主部分跑在 Node 里，不能依赖浏览器和 Tauri，见 docs/architecture/plugins/v3-builtins.md「内置插件的宿主部分怎么写」。";

const hostBrowserModules = [
  "@tauri-apps/*",
  "react",
  "react/*",
  "react-dom",
  "react-dom/*",
  "lucide-react",
  "lucide-react/*",
  "dompurify",
  "@fuyu/plugin-base/client",
  "@fuyu/plugin-base/client/*",
  "**/api",
  "**/api.ts",
  "**/*.tsx",
  "**/*.css",
  "**/lib/*",
  "**/components/*",
  "**/windows/*",
  "**/client/*",
];

const hostBrowserImportExpression = `/${[
  "^@tauri-apps\\u002F",
  "^react(-dom)?($|\\u002F)",
  "^lucide-react($|\\u002F)",
  "^dompurify$",
  "^@fuyu\\u002Fplugin-base\\u002Fclient",
  "(^|\\u002F)api(\\.ts)?$",
  "\\.(tsx|css)$",
  "(^|\\u002F)(lib|components|windows|client)\\u002F",
].join("|")}/`;

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
      "no-restricted-syntax": ["error", ipcDynamicImport],
    },
  },
  {
    files: pluginSwitchDirs.map((dir) => `${dir}/*.{ts,tsx}`),
    rules: {
      "no-restricted-syntax": ["error", ipcDynamicImport, buildKindGate],
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
    files: pluginSwitchDirs.map((dir) => [`${dir}/*.ts`, "**/api.ts"]),
    rules: {
      "no-restricted-syntax": ["error", buildKindGate],
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
  {
    files: hostFiles,
    extends: [tseslint.configs.base],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: hostBrowserModules, message: hostMessage }] }],
      "no-restricted-syntax": [
        "error",
        { selector: `ImportExpression[source.value=${hostBrowserImportExpression}]`, message: hostMessage },
      ],
      "no-restricted-globals": [
        "error",
        ...["window", "document", "localStorage", "sessionStorage"].map((name) => ({ name, message: hostMessage })),
      ],
    },
  },
);
