export default {
  worktreeSuffix: "-lanes/",
  integrationBranch: "main",
  productionBranch: null,
  symlinks: [],
  installOnCreate: true,
  regenerableFiles: [],
  buildOutputDirs: ["dist", "src-tauri/target"],
  checkCommand: "node scripts/land-check.mjs",
  onLand: "node scripts/land-sync-dev.mjs",
};
