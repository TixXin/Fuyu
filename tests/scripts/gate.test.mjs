import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { earlierCalls, hasRead, readTargets } from "../../scripts/gate/evidence.mjs";
import { activeRules, gate as runGate, markerDir, run, touches, transcriptFile } from "../../scripts/gate/gate.mjs";
import { RULES } from "../../scripts/gate/rules.mjs";
import { writeTargets } from "../../scripts/gate/shellWrites.mjs";

const HARNESS = RULES.find((rule) => rule.id === "fuyu-agent-harness");
const SKILL = HARNESS.require.skill;
const touchesWiring = (input, root, exists) => touches(HARNESS, input, root, exists);
const gate = (input, options) => runGate(input, { ...options, rules: [HARNESS] });

const ROOT = resolve("/", "repo");
const edit = (file, tool = "Edit") => ({ tool_name: tool, tool_input: { file_path: file } });
const shell = (command) => ({ tool_name: "Bash", tool_input: { command } });

test("edits to the per-agent lists and new agent modules count as wiring; other files do not", () => {
  assert.equal(touchesWiring(edit(join(ROOT, "src", "features", "agent-status", "status.ts")), ROOT), "src/features/agent-status/status.ts");
  assert.equal(touchesWiring(edit("src-tauri/src/agent_status/hooks/fuyu-agent-running.cmd"), ROOT), "src-tauri/src/agent_status/hooks/fuyu-agent-running.cmd");
  assert.equal(touchesWiring(edit("src-tauri/src/agent_status/kimi.rs", "Write"), ROOT, () => false), "src-tauri/src/agent_status/kimi.rs");
  assert.equal(touchesWiring(edit("src-tauri/src/agent_status/title.rs", "Write"), ROOT, () => true), null);
  assert.equal(touchesWiring(edit("src/features/todo/TodoList.tsx"), ROOT), null);
  assert.equal(touchesWiring(edit(resolve("/", "elsewhere", "src", "features", "agent-status", "status.ts")), ROOT), null);
});

test("shell commands count only when they write to a wiring file", () => {
  assert.equal(touchesWiring(shell("sed -i 's/a/b/' src-tauri/src/agent_status/session_scan.rs"), ROOT), "src-tauri/src/agent_status/session_scan.rs");
  assert.equal(touchesWiring(shell("grep -n codex src-tauri/src/agent_status/session_scan.rs"), ROOT), null);
  assert.equal(touchesWiring({ tool_name: "Read", tool_input: { file_path: "src/features/agent-status/status.ts" } }, ROOT), null);
});

test("the gate blocks once per session and lets through once the skill is loaded", () => {
  let marked = false;
  const options = (transcript) => ({ root: ROOT, readTranscript: () => transcript, marked: () => marked, mark: () => { marked = true; } });
  const input = edit("src/features/agent-status/status.ts");
  assert.equal(gate(input, options(`{"name":"Skill","input":{"skill":"${SKILL}"}}`)), null);
  assert.equal(gate(input, options(`<command-name>/${SKILL}</command-name>`)), null);
  assert.equal(marked, false);
  assert.match(gate(input, options(`skills listed: ${SKILL}`)), new RegExp(SKILL));
  assert.equal(marked, true);
  assert.equal(gate(input, options("")), null);
});

const rule = (id) => RULES.find((entry) => entry.id === id);
const calls = (list, cwd = ROOT) =>
  JSON.stringify({ type: "assistant", cwd, message: { role: "assistant", content: list.map(([name, input], index) => ({ type: "tool_use", id: `call-${index}`, name, input })) } });
const loaded = (path, content = "") => JSON.stringify({ type: "attachment", attachment: { type: "instructions", files: [{ path, type: "Project", content }] } });
const targets = (command, options = {}) => writeTargets(command, { base: ROOT, ...options }).map((path) => path.replaceAll("\\", "/").replace(/^[A-Za-z]:/, ""));
const inRepo = (...paths) => paths.map((path) => `/repo/${path}`);

function workspace(skills = []) {
  const root = mkdtempSync(join(tmpdir(), "fuyu-gate-test-"));
  for (const skill of skills) {
    mkdirSync(join(root, ".claude", "skills", skill), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", skill, "SKILL.md"), "");
  }
  const transcript = join(root, "session.jsonl");
  writeFileSync(transcript, "");
  const input = (base, extra = {}) => ({ session_id: "s1", transcript_path: transcript, cwd: root, ...base, ...extra });
  return { root, temp: join(root, "markers"), transcript, input, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("the table has the eight rows and each one names when it applies, what it needs and a hint", () => {
  assert.deepEqual(RULES.map((entry) => entry.id), ["fuyu-agent-harness", "src-rules", "src-tauri-rules", "fuyu-release", "fuyu-video", "fuyu-lead", "fuyu-task", "fuyu-skill-writing"]);
  for (const entry of RULES) {
    assert.ok(entry.when.paths || entry.when.commands || entry.when.tool, entry.id);
    assert.ok(Boolean(entry.require.skill) !== Boolean(entry.require.read), entry.id);
    assert.equal(typeof entry.hint, "string");
  }
  const present = (file) => !file.replaceAll("\\", "/").includes("/fuyu-task/");
  assert.deepEqual(activeRules(ROOT, present).map((entry) => entry.id), RULES.map((entry) => entry.id).filter((id) => id !== "fuyu-task"));
});

test("writes under src/ and src-tauri/ hit their rows; build output and files outside the repo do not", () => {
  assert.equal(touches(rule("src-rules"), edit(join(ROOT, "src", "features", "todo", "TodoList.tsx")), ROOT), "src/features/todo/TodoList.tsx");
  assert.equal(touches(rule("src-rules"), edit("src-tauri/src/lib.rs"), ROOT), null);
  assert.equal(touches(rule("src-tauri-rules"), edit("src-tauri/src/lib.rs", "Write"), ROOT), "src-tauri/src/lib.rs");
  assert.equal(touches(rule("src-tauri-rules"), edit("src-tauri/target/agents/x.d"), ROOT), null);
  assert.equal(touches(rule("src-tauri-rules"), edit("src-tauri/gen/schemas/desktop-schema.json"), ROOT), null);
  assert.equal(touches(rule("src-rules"), edit(resolve("/", "elsewhere", "src", "x.ts")), ROOT), null);
  assert.equal(touches(rule("src-rules"), { tool_name: "NotebookEdit", tool_input: { notebook_path: "src/x.ipynb" } }, ROOT), "src/x.ipynb");
  assert.equal(touches(rule("src-rules"), shell("cd packages/plugin-base && cat > src/host/x.mjs <<'EOF'\nx\nEOF"), ROOT), null);
  assert.equal(touches(rule("src-rules"), { ...shell("sed -i '' 's/a/b/' api.ts"), cwd: join(ROOT, "src", "features") }, ROOT), "src/features/api.ts");
  assert.equal(touches(rule("fuyu-video"), edit("video/src/cut.ts"), ROOT), "video/src/cut.ts");
  assert.equal(touches(rule("fuyu-skill-writing"), edit(".claude/skills/fuyu-task/SKILL.md", "Write"), ROOT), ".claude/skills/fuyu-task/SKILL.md");
});

test("the harness row sees inline writes to a wiring file and ignores commands that only name one", () => {
  const python = "python3 - <<'EOF'\np = \"src-tauri/src/agent_status/mod.rs\"\ns = open(p).read()\nopen(p, \"w\").write(s)\nEOF";
  assert.equal(touchesWiring(shell(python), ROOT), "src-tauri/src/agent_status/mod.rs");
  assert.equal(touchesWiring(shell("cat > src-tauri/src/agent_status/hooks/fuyu-agent-status.sh <<'EOF'\nx\nEOF"), ROOT), "src-tauri/src/agent_status/hooks/fuyu-agent-status.sh");
  assert.equal(touchesWiring(shell("pnpm task:claim B46 --as x --scope src-tauri/src/agent_status/session_scan.rs 2>&1 | tail -5"), ROOT), null);
  assert.equal(touchesWiring(shell("ls src/features/agent-status/status.ts 2>&1; git log --oneline -3 -- src/features/agent-status/status.ts > /tmp/log.txt"), ROOT), null);
  assert.equal(touchesWiring(shell("cp src/features/agent-status/status.ts /tmp/status.ts"), ROOT), null);
});

test("shell writes are found by where they write: redirects, heredocs, tee, sed -i, perl -i, mv and cp", () => {
  assert.deepEqual(targets("cat > src/x.ts <<'EOF'\nconst a = () => 1 > 2;\nEOF"), inRepo("src/x.ts"));
  assert.deepEqual(targets("printf 'x' >> src/x.ts; echo hi | tee -a src/log.txt"), inRepo("src/x.ts", "src/log.txt"));
  assert.deepEqual(targets("sed -i '' -e 's/a/b/' src/a.ts src/b.ts"), inRepo("src/a.ts", "src/b.ts"));
  assert.deepEqual(targets("sed -i 's/a/b/' src/a.ts && perl -pi -e 's/a/b/' src/b.ts"), inRepo("src/a.ts", "src/b.ts"));
  assert.deepEqual(targets("mv src/a.ts src/b.ts && cp /tmp/x src-tauri/src/y.rs"), [...inRepo("src/a.ts", "src/b.ts"), "/repo/src-tauri/src/y.rs"]);
  assert.deepEqual(targets("cd src-tauri && sed -i '' 's/a/b/' src/lib.rs"), inRepo("src-tauri/src/lib.rs"));
  assert.deepEqual(targets("F=src/a.ts; echo x > \"$F\""), inRepo("src/a.ts"));
  assert.deepEqual(targets("for f in src/a.ts src/b.ts; do sed -i '' 's/a/b/' \"$f\"; done"), inRepo("src/a.ts", "src/b.ts"));
  assert.deepEqual(targets("rg -l foo src/features | xargs sed -i '' 's/foo/bar/g'"), inRepo("foo", "src/features"));
  assert.deepEqual(targets("find src -name '*.orig' -delete; git rm -q src/old.ts"), inRepo("src", "src/old.ts"));
  assert.deepEqual(targets("echo done > \"$(pwd)/src/out.txt\""), inRepo("src/out.txt"));
  assert.deepEqual(targets("bash -c \"echo x > src/a.ts\""), inRepo("src/a.ts"));
});

test("inline python, node and patches are read for the files they write", () => {
  assert.deepEqual(targets("python3 - <<'PY'\nimport pathlib\np = pathlib.Path('src/features/x.ts')\ns = p.read_text()\np.write_text(s.replace('a', 'b'))\nPY"), inRepo("src/features/x.ts"));
  assert.deepEqual(targets("python3 - <<'PY'\nfiles = [\n  'src/a.ts',\n  'src/b.ts',\n]\nfor f in files:\n    s = open(f).read()\n    open(f, 'w').write(s)\nPY"), inRepo("src/a.ts", "src/b.ts"));
  assert.deepEqual(targets("cd src-tauri && python3 -c \"p='src/lib.rs'; s=open(p).read(); open(p,'w').write(s)\""), inRepo("src-tauri/src/lib.rs"));
  assert.deepEqual(targets("F=src/a.ts; node -e \"require('fs').writeFileSync(process.argv[1], 'x')\" \"$F\""), inRepo("src/a.ts"));
  assert.deepEqual(targets("node --input-type=module -e \"import { writeFileSync } from 'node:fs'; const p = 'src/z.ts'; writeFileSync(p, '')\""), inRepo("src/z.ts"));
  assert.deepEqual(targets("git apply <<'EOF'\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-a\n+b\nEOF"), inRepo("src/a.ts"));
  assert.deepEqual(targets("git apply --check <<'EOF'\n--- a/src/a.ts\n+++ b/src/a.ts\nEOF"), []);
});

test("commands that only read are not taken for writes", () => {
  assert.deepEqual(targets("rg foo src/ > /tmp/out.txt"), ["/tmp/out.txt"]);
  assert.deepEqual(targets("sed -n '1,20p' src/a.ts; grep -n foo src/a.ts 2>/dev/null | head -5; cat src/a.ts 2>&1"), []);
  assert.deepEqual(targets("git commit -q -m \"$(cat <<'EOF'\nfix: a > b (1)\nEOF\n)\" -- src/a.ts"), []);
  assert.deepEqual(targets("python3 -c \"open('/tmp/o.json','w').write(open('src/a.ts').read())\""), ["/tmp/o.json"]);
  assert.deepEqual(targets("node scripts/x.mjs src/a.ts; python3 fix.py src/a.ts"), []);
  assert.deepEqual(targets("cat > /tmp/note.md <<'EOF'\necho x > src/a.ts\n[IO.File]::WriteAllText('src/b.ts', 'x')\nEOF"), ["/tmp/note.md"]);
  assert.equal(touches(rule("src-rules"), shell("rg foo src/ > /tmp/out.txt"), ROOT), null);
});

test("PowerShell writes are found by their target", () => {
  const ps = (command) => targets(command, { powershell: true });
  assert.deepEqual(ps("Set-Content -Path src\\x.ts -Value 'a'; 'x' | Out-File src\\y.ts; Get-Content a.txt > src\\w.txt"), inRepo("src/x.ts", "src/y.ts", "src/w.txt"));
  assert.deepEqual(ps("$p = 'src\\z.ts'; [IO.File]::WriteAllText($p, 'x')"), inRepo("src/z.ts"));
  assert.deepEqual(ps("@'\nhello > there\n'@ | Set-Content src\\h.ts\nMove-Item a.txt -Destination src\\m.ts"), inRepo("src/h.ts", "a.txt", "src/m.ts"));
  assert.deepEqual(ps("Get-Content src\\x.ts | Select-String foo"), []);
  assert.equal(touches(rule("src-rules"), { tool_name: "PowerShell", tool_input: { command: "Set-Content src\\x.ts 'a'" } }, ROOT), "src/x.ts");
});

test("a rule file counts as read through the Read tool, a shell reader or an auto-loaded attachment, and nothing else", () => {
  const read = (text, file = "src/AGENTS.md") => hasRead(text, file, { root: ROOT });
  assert.equal(read(calls([["Read", { file_path: join(ROOT, "src", "AGENTS.md") }]])), true);
  assert.equal(read(calls([["Bash", { command: "cat src/AGENTS.md | head -5" }]])), true);
  assert.equal(read(calls([["Bash", { command: "cd src && sed -n '1,80p' AGENTS.md" }]])), true);
  assert.equal(read(calls([["Bash", { command: "tail -20 AGENTS.md" }]], join(ROOT, "src"))), true);
  assert.equal(read(calls([["PowerShell", { command: "Get-Content src\\AGENTS.md -TotalCount 5" }]])), true);
  assert.equal(read(loaded(join(ROOT, "src", "AGENTS.md"))), true);
  assert.equal(read(loaded(join(ROOT, "AGENTS.md"), "修改 `src/` 时还须遵守 [src/AGENTS.md](src/AGENTS.md)")), false);
  assert.equal(read(calls([["Read", { file_path: join(ROOT, "AGENTS.md") }], ["Read", { file_path: join(ROOT, "src-tauri", "AGENTS.md") }]])), false);
  assert.equal(read(calls([["Bash", { command: "wc -l src/AGENTS.md; ls src/AGENTS.md; grep -n rule src/AGENTS.md; git add src/AGENTS.md" }]])), false);
  assert.equal(read(calls([["Bash", { command: "sed -i '' 's/a/b/' src/AGENTS.md" }]])), false);
  assert.equal(read(JSON.stringify({ type: "user", message: { content: "cat src/AGENTS.md" } })), false);
  assert.equal(read("not json src/AGENTS.md \"type\":\"assistant\""), false);
  assert.equal(read(calls([["Bash", { command: "cat src-tauri/AGENTS.md" }]]), "src-tauri/AGENTS.md"), true);
  assert.deepEqual(readTargets("cat a.md; wc -l b.md", { base: ROOT }).map((path) => path.replaceAll("\\", "/").replace(/^[A-Za-z]:/, "")), ["/repo/a.md"]);
});

test("each rule blocks once per session, remembers a rule that is already met and keeps its markers apart", () => {
  const space = workspace();
  try {
    const first = space.input(edit(join(space.root, "src", "a.ts")));
    const blocked = run(first, { root: space.root, temp: space.temp, env: {} });
    assert.match(blocked, /src\/AGENTS\.md/);
    assert.match(blocked, /这次会话只拦一次/);
    assert.equal(run(first, { root: space.root, temp: space.temp, env: {} }), null);
    assert.match(run(space.input(edit(join(space.root, "src-tauri", "src", "lib.rs"))), { root: space.root, temp: space.temp, env: {} }), /src-tauri\/AGENTS\.md/);
    assert.match(run(space.input(first, { session_id: "s2" }), { root: space.root, temp: space.temp, env: {} }), /src\/AGENTS\.md/);
    writeFileSync(space.transcript, `${calls([["Bash", { command: "cat src/AGENTS.md" }]], space.root)}\n`);
    assert.equal(run(space.input(first, { session_id: "s3" }), { root: space.root, temp: space.temp, env: {} }), null);
    writeFileSync(space.transcript, "");
    assert.equal(run(space.input(first, { session_id: "s3" }), { root: space.root, temp: space.temp, env: {} }), null);
  } finally {
    space.done();
  }
});

test("a subagent is judged on its own transcript and blocked separately from its session", () => {
  const space = workspace();
  try {
    const main = space.input(edit(join(space.root, "src", "a.ts")));
    const sub = space.input(main, { agent_id: "abc123", agent_type: "general-purpose" });
    assert.equal(transcriptFile(sub), join(space.root, "session", "subagents", "agent-abc123.jsonl"));
    assert.notEqual(markerDir(sub, space.temp), markerDir(main, space.temp));
    writeFileSync(space.transcript, `${calls([["Read", { file_path: join(space.root, "src", "AGENTS.md") }]], space.root)}\n`);
    assert.equal(run(main, { root: space.root, temp: space.temp, env: {} }), null);
    assert.match(run(sub, { root: space.root, temp: space.temp, env: {} }), /这个子代理只拦一次/);
    assert.equal(run(sub, { root: space.root, temp: space.temp, env: {} }), null);
    mkdirSync(join(space.root, "session", "subagents"), { recursive: true });
    writeFileSync(join(space.root, "session", "subagents", "agent-def456.jsonl"), `${calls([["Bash", { command: "head -40 src/AGENTS.md" }]], space.root)}\n`);
    assert.equal(run(space.input(main, { agent_id: "def456" }), { root: space.root, temp: space.temp, env: {} }), null);
  } finally {
    space.done();
  }
});

test("one operation that meets several rules gets one message and each rule is blocked once", () => {
  const space = workspace(["fuyu-agent-harness"]);
  try {
    const both = space.input(edit(join(space.root, "src", "features", "agent-status", "status.ts")));
    const message = run(both, { root: space.root, temp: space.temp, env: {} });
    assert.match(message, /碰到 2 条规则/);
    assert.match(message, /fuyu-agent-harness/);
    assert.match(message, /src\/AGENTS\.md/);
    assert.equal(message.split("\n").length, 3);
    assert.equal(run(both, { root: space.root, temp: space.temp, env: {} }), null);
    const crossing = space.input(shell("sed -i '' 's/a/b/' src/x.ts src-tauri/src/lib.rs"), { session_id: "s2" });
    assert.match(run(crossing, { root: space.root, temp: space.temp, env: {} }), /碰到 2 条规则/);
  } finally {
    space.done();
  }
});

test("FUYU_GATE=off turns the gate off, and a gate that cannot keep its markers lets the call through", () => {
  const space = workspace();
  try {
    const input = space.input(edit(join(space.root, "src", "a.ts")));
    assert.equal(run(input, { root: space.root, temp: space.temp, env: { FUYU_GATE: "off" } }), null);
    assert.equal(run(input, { root: space.root, temp: space.transcript, env: {} }), null);
    assert.equal(run({ ...input, transcript_path: join(space.root, "missing.jsonl"), session_id: "s2" }, { root: space.root, temp: space.temp, env: {} }) === null, false);
    assert.equal(run({ tool_name: "Bash", tool_input: { command: "echo \"unterminated $(cat <<'EOF'" } }, { root: space.root, temp: space.temp, env: {} }), null);
    assert.equal(run({}, { root: space.root, temp: space.temp, env: {} }), null);
  } finally {
    space.done();
  }
});

test("command rows match the command that is run, not text that mentions it", () => {
  const release = (command) => touches(rule("fuyu-release"), shell(command), ROOT);
  assert.equal(release("pnpm release"), "pnpm release");
  assert.equal(release("cd /repo && pnpm -s release:version 0.4.0 2>&1 | tail -3"), "pnpm release:version");
  assert.equal(release("pnpm run release:prebuild"), "pnpm release:prebuild");
  assert.equal(release("FUYU_SYNC_SHORTCUT=1 node scripts/release/release.mjs --dry-run"), "scripts/release/release.mjs");
  assert.equal(release("pwsh -File scripts/release/smoke-test.ps1"), "scripts/release/smoke-test.ps1");
  assert.equal(release("cat scripts/release/release.mjs; git add scripts/release/bump.mjs; rg \"pnpm release\" docs"), null);
  assert.equal(release("git commit -m \"docs: how to run pnpm release\" -- docs/x.md"), null);
  assert.equal(release("node --check scripts/release/release.mjs; node --test tests/scripts/release-manifest.test.mjs"), null);
  assert.equal(release("pnpm release:notes; pnpm tasks release F1 --reason x"), null);
  assert.equal(touches(rule("fuyu-release"), edit("scripts/release/release.mjs"), ROOT), null);
  const task = (command) => touches(rule("fuyu-task"), shell(command), ROOT);
  assert.equal(task("pnpm task:claim F42 --as gate-table --scope scripts/gate/"), "pnpm task:claim");
  assert.equal(task("pnpm -s tasks add F50 --title x --issue 5 --claim --as me --scope docs/"), "pnpm tasks add --claim");
  assert.equal(task("pnpm tasks add F50 --title x --issue 5; pnpm tasks show F42; pnpm tasks note F42 \"pnpm task:claim 之后\""), null);
});

test("the lead row waits for the second session a session starts on request", () => {
  const space = workspace(["fuyu-lead"]);
  try {
    const start = (id, initiation = "user_asked") => space.input({ tool_name: "mcp__ccd_session__start_session", tool_input: { initiation, title: "x" }, tool_use_id: id });
    const earlier = (ids) => ids.map((id) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "mcp__ccd_session__start_session", input: { initiation: "user_asked" } }] } })).join("\n");
    assert.equal(touches(rule("fuyu-lead"), start("a", "own_initiative"), space.root), null);
    writeFileSync(space.transcript, earlier(["a"]));
    assert.equal(earlierCalls(earlier(["a", "b"]), "mcp__ccd_session__start_session", { initiation: "user_asked" }, "b"), 1);
    assert.equal(run(start("a"), { root: space.root, temp: space.temp, env: {} }), null);
    writeFileSync(space.transcript, earlier(["a", "b"]));
    assert.match(run(start("b"), { root: space.root, temp: space.temp, env: {} }), /fuyu-lead/);
    assert.equal(run(start("b"), { root: space.root, temp: space.temp, env: {} }), null);
    writeFileSync(space.transcript, `${earlier(["a", "b"])}\n{"name":"Skill","input":{"skill":"fuyu-lead"}}`);
    assert.equal(run(space.input(start("b"), { session_id: "s2" }), { root: space.root, temp: space.temp, env: {} }), null);
  } finally {
    space.done();
  }
});

test("a row whose skill is not in the repo yet stays off", () => {
  const without = workspace();
  const withSkill = workspace(["fuyu-task", "fuyu-skill-writing"]);
  try {
    const claim = (space) => space.input(shell("pnpm task:claim F42 --as x"));
    assert.equal(run(claim(without), { root: without.root, temp: without.temp, env: {} }), null);
    assert.equal(run(without.input(edit(join(without.root, ".claude", "skills", "x", "SKILL.md"), "Write")), { root: without.root, temp: without.temp, env: {} }), null);
    assert.match(run(claim(withSkill), { root: withSkill.root, temp: withSkill.temp, env: {} }), /fuyu-task/);
    assert.match(run(withSkill.input(edit(join(withSkill.root, ".claude", "skills", "x", "SKILL.md"), "Write")), { root: withSkill.root, temp: withSkill.temp, env: {} }), /fuyu-skill-writing/);
  } finally {
    without.done();
    withSkill.done();
  }
});

test("the hook script exits 2 with the message on stderr, then 0 on the retry and whenever it is switched off", () => {
  const space = workspace();
  try {
    const script = resolve("scripts", "gate", "gate.mjs");
    const payload = JSON.stringify({ session_id: "cli", transcript_path: space.transcript, cwd: resolve("."), hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: resolve("src", "gate-probe.ts"), content: "" }, tool_use_id: "t" });
    const env = { ...process.env, TMPDIR: space.root, TEMP: space.root, TMP: space.root, FUYU_GATE: "" };
    const hook = (input, extra = {}) => spawnSync(process.execPath, [script], { input, env: { ...env, ...extra }, encoding: "utf8" });
    const off = hook(payload, { FUYU_GATE: "off" });
    assert.deepEqual([off.status, off.stderr], [0, ""]);
    const blocked = hook(payload);
    assert.equal(blocked.status, 2);
    assert.match(blocked.stderr, /src\/AGENTS\.md/);
    assert.deepEqual([hook(payload).status, hook("not json").status, hook("").status], [0, 0, 0]);
  } finally {
    space.done();
  }
});
