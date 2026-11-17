export function sessionProject(cwd: string | null) {
  if (!cwd) return null;
  const parts = cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
  const last = parts[parts.length - 1] || null;
  if (!last) return null;
  const parent = parts[parts.length - 2] ?? "";
  if (/^\d+$/.test(last) && /.-lanes$/.test(parent)) return parent.slice(0, -"-lanes".length);
  const lane = /^(.+)-lane-\d+$/.exec(last);
  if (lane) return lane[1];
  if (parent === "worktrees" && parts[parts.length - 3] === ".claude" && parts[parts.length - 4]) return parts[parts.length - 4];
  return last;
}
