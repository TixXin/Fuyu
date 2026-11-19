# AI Agent Status Hooks

Fuyu can mirror Codex, Claude Code, WorkBuddy, Antigravity, DeepSeek Harness, Qoder, CodeBuddy Code, Qwen Code, TRAE, TRAE CN, ZCode, Kimi Code, Grok CLI, Copilot CLI, Droid and pi task activity on the collapsed island status light (opencode and MiMo Code have no status light; their sessions only count on the Agent page, see [opencode](#opencode)):

- running task: blue
- completed, idle, or no task: green
- failed task, or a running marker older than 10 minutes without a stop event: yellow

Do not use process or CPU detection for this integration. Codex and Claude Code can stay alive while idle, and Claude Code may run inside a VSCode terminal. The reliable path is to wire into lifecycle hooks.

## User Setup

For release users and source builds, use the in-app installer:

1. Open Fuyu.
2. Expand the island and open Settings.
3. Open **AI Agent** (its first tab, 岛上显示). The **AI Agent 状态灯** card is at the top; click **安装/修复**. Since 2026-11-16 (B67, #678) the card is on this page on both Windows and macOS; it used to be on the 连接 tab, which macOS hid, so on a Mac hooks could not be installed at all. The 连接 tab now holds only the reply status marker and the editor extension, and shows on macOS too. SSH 远程 shows on macOS too since 2026-11-18 (B64), after a test against a Debian OpenSSH container: adding a host, 安装/修复 on the remote, remote sessions on the island, 移除钩子 and the SSH proxy tunnel all work (移除钩子 was run through the same Rust function, not a click).
4. Restart Codex and any VSCode terminal running Claude Code.
5. For Codex, review and trust the new hooks when Codex prompts you, or use `/hooks`.

The installer writes the hook scripts to the current user's app data directory:

```text
%APPDATA%\com.tixxin.fuyu\
```

On macOS they are the `/bin/sh` scripts `fuyu-agent-*.sh` in `~/.fuyu` (755), and the files below are under `~` instead of `%USERPROFILE%`. Tried on a Mac on 2026-11-16 (B67): Install/repair wrote the scripts and the hooks of Claude Code (`~/.claude/settings.json`), Codex (`~/.codex/config.toml`, appended between the `# BEGIN Fuyu Agent Status Hooks` markers), Antigravity, WorkBuddy (`~/.workbuddy`, `~/.workbuddy-ai`), CodeBuddy, Copilot CLI, Grok CLI and the DSH hooks file. The hooks another island tool had put in `~/.claude/settings.json` (Vibe Island, 16 entries) were all kept; only Fuyu's entries were added, nothing was removed.

It then updates:

```text
%USERPROFILE%\.codex\config.toml
%USERPROFILE%\.claude\settings.json
```

When WorkBuddy is installed (`%USERPROFILE%\.workbuddy` or `%USERPROFILE%\.workbuddy-ai` exists), it also updates `settings.json` in each of them; see [WorkBuddy](#workbuddy). When Qoder, CodeBuddy Code or Qwen Code is installed, it also updates their `settings.json`; see [Qoder, CodeBuddy Code and Qwen Code](#qoder-codebuddy-code-and-qwen-code). When TRAE or TRAE CN is installed, it writes `~/.trae/hooks.json` or `~/.trae-cn/hooks.json`; see [TRAE and TRAE CN](#trae-and-trae-cn). When ZCode or Kimi Code is installed, it updates `~/.zcode/cli/config.json` or `~/.kimi-code/config.toml`; see [ZCode](#zcode) and [Kimi Code](#kimi-code). When Antigravity is installed, it also writes `%USERPROFILE%\.gemini\config\hooks.json`; see [Antigravity](#antigravity). When DeepSeek Harness is installed, it writes `fuyu-dsh-hooks.json` next to the scripts and tells you what to add to DSH's profile; see [DeepSeek Harness](#deepseek-harness). When opencode is installed, it writes a plugin for opencode 1.x into opencode's config folder; see [opencode](#opencode).

The status light card in Settings has one row per agent with hooks, showing whether its hooks are current. An agent that is not on this computer (`absent`) gets no row and never counts as outdated. When an install from before the rename is upgraded, the app reinstalls the hooks of every agent that had them, remote ones included ([rename compatibility](../architecture/contracts.md#改名兼容d17)).

**Development build.** `pnpm tauri dev` reads the installed app's agent status. Since 2026-11-16 (B65, #687) its **安装/修复** installs the installed app's hooks, exactly as the installed app would: the scripts go to the installed app's data folder (`~/.fuyu` by default), and Claude Code's approval hooks use the port and token in that folder's `agent-approval.json` (`agent_approval::hook_url`), not the development build's own endpoint. So the two never overwrite each other, the hooks keep working after the development build closes, and the "hooks are outdated" notice compares against the same values in both builds. Tried on a Mac: after the installed app had installed the hooks, Install/repair in the development build rewrote the scripts with the same bytes and left `~/.claude/settings.json`, `~/.codex/config.toml` and `~/.gemini/config/hooks.json` byte for byte the same. Approval cards still need an island listening on the installed app's port: the installed app, or on Windows the development build when it is set to go first. Codex / Claude Code's **清除状态** stays hidden, and the card says that Install/repair sets up the installed app's hooks.

The operation is repeatable. Running **安装/修复** again rewrites Fuyu's managed hooks to the current app-data script path and removes older Fuyu hook entries that referenced development paths, including the ones from before the rename ([rename compatibility](../architecture/contracts.md#改名兼容d17)). Fuyu hooks under events it no longer writes are removed too, and an event left with no hooks is dropped.

**Removing hooks, uninstall cleanup and fail-open guards** (B73, #808):

- **In-app removal (**移除钩子** / **Remove hooks**)**: When at least one built-in agent has Fuyu's hooks or plugin installed (`current` or `outdated`) and the app is not in isolated preview mode, the **AI Agent 状态灯** card shows a secondary **移除钩子** button next to **安装/修复** (`uninstall_agent_status_hooks`). Clicking it losslessly strips Fuyu's managed entries, TOML blocks, exclusive hook/plugin files and `dsh-plugin/` across all 18 local harnesses (preserving user and third-party hooks, dropping empty `"hooks"` keys, and skipping unchanged files), deletes `fuyu-agent-*` scripts in Fuyu's data folder, and removes Fuyu's hooks and notifications on enabled SSH remote hosts. It leaves the independent **回复状态标记** switch as configured. On macOS, click **移除钩子** (and turn off the reply status marker if enabled) before dragging `Fuyu.app` to the Trash.
- **Windows NSIS uninstall & reinstall recovery (`--uninstall-cleanup`)**: During a real Windows uninstall (skipped during auto-updates `/UPDATE` and installer-driven upgrades, downgrades or passive reinstalls `/REINSTALL`), `uninstall.exe` runs `fuyu.exe --uninstall-cleanup` after confirming Fuyu has exited and before deleting `fuyu.exe` or `%APPDATA%\com.tixxin.fuyu\home.json`. Every real uninstall removes all 18 local agents' hooks/plugins and local reply status markers (without opening SSH connections). When **Delete the application data** is unchecked, Fuyu records `{ "hooks": …, "replyMarker": … }` in `uninstalled-hooks.json` inside Fuyu's home folder so reinstalling Fuyu later restores them automatically on startup and deletes the marker file. When **Delete the application data** is checked (`--delete-data`), Fuyu also removes `tixxin.fuyu-*` editor extensions, deletes release `com.tixxin.fuyu` credentials from Windows Credential Manager (leaving `lane-*` development credentials untouched), and cleans Fuyu's home folder behind a path gatekeeper: the default `%USERPROFILE%\.fuyu` is removed in full, whereas a custom folder set through `home.json` or `FUYU_HOME` only has Fuyu's managed files and subdirectories removed so user files in a shared folder are never deleted.
- **Fail-open when scripts or `~/.fuyu` are deleted**: Written command hooks check that the target `fuyu-agent-*` script exists before running (`if exist` under `cmd.exe` on Windows, `[ -f … ]` under `/bin/sh` on macOS) and exit `0` silently when missing. External JS plugins (`opencode` 1.x, `MiMo Code`, `pi`, `DeepSeek Harness`) check with `stat` that `FUYU_DIR` already exists before writing markers or notifications and never `mkdir` the top-level home folder themselves, so manually deleting `~/.fuyu` causes neither hook errors nor folder resurrection.

While the approval endpoint runs (approving on the island), Claude Code also gets the approval hooks: an HTTP `PermissionRequest` hook, a `PreToolUse` hook for `AskUserQuestion`, and an activity hook on `PostToolUse`, `PostToolUseFailure`, `PermissionDenied`, `Stop`, `SubagentStop` and `UserPromptSubmit`. The activity hook runs `curl.exe` (part of Windows 10 and 11) in the background (`"async": true`) to post the hook's input to `/claude/activity`; it never delays Claude Code, and with the island closed it gives up after a second. It lets the island close a card whose request was already answered in the terminal (docs/architecture/agent/island-interaction.md, 第 2 条). Installs from before 2026-11-07 lack it and show as needing repair.

## Runtime Contract

Prompt submission uses a fast marker file instead of PowerShell JSON work:

```text
agent-codex-running.flag
agent-claudeCode-running.flag
```

Fuyu polls these marker files every 200ms. If either marker exists and is fresh, the island turns blue. If a marker is still present after 10 minutes, Fuyu treats it as stale and turns the island yellow instead of leaving the user waiting on a permanent blue light.

When the turn finishes, `fuyu-agent-status.ps1` removes the marker, writes `agent-status.json`, and keeps a short hold marker when the task completed too quickly. This makes very short prompts still visibly flash blue for about 800ms.

`agent-status.json` uses this shape:

```json
{
  "codex": {
    "phase": "running",
    "taskId": "optional-id",
    "updatedAt": 1783584000000
  },
  "claudeCode": {
    "phase": "completed",
    "taskId": "optional-id",
    "updatedAt": 1783584000000
  },
  "updatedAt": 1783584000000
}
```

`phase === "running"` turns the light blue. `phase === "failed"` turns the light yellow. Missing files, invalid JSON, missing fields, unknown phases, `idle`, and `completed` are treated as green states. A derived `stale` phase is returned by the app when a running marker remains for more than 10 minutes without a later status update.

## Sessions, Titles and Waiting

Session titles and the island's Agent page do not depend on hooks: `list_agent_sessions` reads the Claude Code transcripts (`~/.claude/projects/*/*.jsonl`) and the Codex rollouts (`~/.codex/sessions/`) of the last two hours directly. Titles come from a name the user gave with `/rename` (Claude Code's `custom-title` record, the newest one; B21), else Claude Code's `ai-title` records or the Codex `thread_name` in `~/.codex/session_index.jsonl`, else the first typed prompt, else the project folder. Each session also carries `titleSource` (`rename`, `agent`, `prompt` or `folder`) so the front end knows where its title came from. A rename read once is kept while the session is listed, even when a later tail no longer holds the record. Earlier versions copied the prompt-submit hook input (`capture`, `agent-*-hook-input.json`) for this; that copy held the whole prompt and is gone. Install/Repair deletes leftover copies, and the script ignores the `capture` argument older installs still pass.

**Codex threads database** (`codex_threads.rs`, B46). Codex keeps a thread list in `~/.codex/state_5.sqlite`. The island opens it read-only and lists the threads of the session window from `threads` (not archived; subagent and guardian threads skipped; at most 200). A thread whose rollout still exists is read from the rollout as before (state, tool, todos, context), even when the rollout sits in a date folder older than the last two days; `threads` fills in the model, effort, folder and host (`originator`) when the rollout lacks them, and its `name` is the title after `session_index.jsonl`. Threads whose rollout is gone (the 2026-11-12 storage migration moved older history into `~/.codex/thread_history_1.sqlite`) are listed too: the last prompt and reply are the last `userMessage` and `agentMessage` in `thread_items`, and the state is the last turn's `status` in `thread_turns` (`inProgress` running, `failed` failed, anything else done); such sessions have no current tool, todos or context size. A database with a `-wal` next to it is opened normally (busy timeout 250 ms); one without (no process has it open, as is usual for `thread_history_1.sqlite`) is opened as `immutable=1`, so no `-shm` is created and nothing is locked. Results are cached by the size and modification time of the database and its `-wal`. With no database, or without the `id`, `rollout_path` and `updated_at` columns, the island scans only the rollouts of the last two days, as before. Remote Codex sessions still come from rollouts only.

**Claude desktop app** (`claude_desktop.rs`, B46). Sessions in the Code tab of the Claude desktop app write their transcripts to `~/.claude/projects` like the CLI (`entrypoint` is `claude-desktop`), so they are listed once, as usual. The app keeps its own record of each in `<Claude data folder>/claude-code-sessions/<org>/<account>/local_<id>.json` (`~/Library/Application Support/Claude` on macOS, `%USERPROFILE%\AppData\Roaming\Claude` on Windows, `~/.config/Claude` on Linux); the island reads the records changed within the session window and, by `cliSessionId`, takes the app's title, model and effort for the matching session. A title with `titleSource: user` counts as a rename, others as the agent's title. A record whose `spawnedFrom.sessionId` names another record (a session a lead started with `start_session`) gets that record's `cliSessionId` as `parentId` (B50); the Agent page's list view then hangs it under its parent, behind a collapsed "n child sessions" button that shows a dot and a count when a child needs you, with grandchildren indented one step further. A child whose parent is not on the list (archived, outside the window) is shown on its own. MSIX installs on Windows redirect the data folder to `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude`, so the island reads that folder too. A record without a matching transcript is not listed. On the current macOS app every record matched (84 of 84); older Windows records from mid-2026 did not, and the current Windows app is still to be checked (#179). Cowork sessions are not listed: each has its own `.claude` folder under `local-agent-mode-sessions/`, which does not read `~/.claude/settings.json`, so the island's hooks do not run there, and it runs in the app's sandbox, so a click could not reach it.

Waiting is told by hooks that save their input: Claude Code's `PermissionRequest` (fires before every permission prompt) and `Notification` (matcher `permission_prompt|elicitation_dialog|agent_needs_input`), and Codex's `PermissionRequest`. Claude Code's `PreCompact` and `PostCompact` save their input the same way: from one to the other the session is compacting its context, which writes nothing to the transcript for up to a couple of minutes, so the Agent page says "Compacting context" and keeps it running (taken as over after 10 minutes in case `PostCompact` never comes). The waiting hooks:

```text
fuyu-agent-running.cmd claudeCode notification
fuyu-agent-running.cmd codex notification
```

With `notification`, the script copies the hook's stdin JSON (session id, the event or notification type, the tool name or a short message such as "Claude needs your permission to use Bash"; no prompt) to `agent-<provider>-notification.json` (temp file, then moved) and leaves the running marker alone. It prints nothing, so a `PermissionRequest` hook makes no decision and the normal approval prompt follows. A session is listed as `waiting` while its transcript (or Codex rollout) has not changed since then (2 s slack): answering the prompt runs the tool and the transcript grows. A waiting session never turns stale. `idle_prompt` is not counted: it comes after the turn ended. Clearing an agent's status deletes its saved notification.

**Session records.** `SessionStart` and `SessionEnd` (both agents) run `fuyu-agent-session.ps1 <provider> start|end`. The start writes `agent-sessions/<session id>.json`: the source (`startup`, `resume`, `clear`, `compact`, `fork`), the folder, the agent's process id and start time (the nearest ancestor of the hook named `claude.exe` / `codex.exe` / `node.exe`, looked up through WMI), `ORCA_TERMINAL_HANDLE`, `WT_SESSION` and `TERM_PROGRAM`. The end adds `endedAt` and the reason (`clear`, `resume`, `logout`, `prompt_input_exit`, `other`). It prints nothing, never fails the hook, only accepts session ids made of letters, digits, `-` and `_`, and deletes records older than 7 days. The process lookup takes about a second, so Claude Code runs the start hook with `async: true` (in the background). Codex hooks cannot run in the background yet, so a Codex session's first turn waits for it once. These records come from documented hooks and are preferred over Claude Code's undocumented `~/.claude/sessions` registry (`session_records.rs`). After `/clear` or `/resume` the process carries on under a new id, so the old record still leads to it. Codex reviews new hooks before running them: after Install/Repair, trust them with `/hooks`.

The settings page reads `get_agent_hooks_state` when it opens and after **安装/修复**. It builds the hooks Install/Repair would write and compares: each agent is `current` when all of them are there as written, `outdated` when Fuyu hooks differ (for example installed before the `Notification` hook, or pointing at an old script folder), or `notInstalled`; it also reports whether the app-data scripts differ from the ones in this build. When anything is outdated, the page shows a yellow notice and highlights **安装/修复**; nothing is changed until the user clicks it. Design notes: [architecture/agent-session-title.md](../architecture/agent/session-title.md).

**Bringing the window forward**: Windows refuses to activate another app's window unless the island got the last input, so the island attaches to the foreground thread's input first (`win32::window::force_foreground`). If Windows still keeps the window behind, its taskbar button flashes and the click counts as found. **Diagnosing**: each click appends one line to `agent-focus.log` in Fuyu's data folder (`%USERPROFILE%\.fuyu` since 0.3.7, `~/.fuyu` on a Mac; see [data-home.md](data-home.md)), naming each step and its result (for example `process=registry(5), tab=process, window=orca | focused`), without window titles or conversation text; ask for it when someone reports "没找到对应的窗口". An ended session that was never seen running by an island with this version cannot be traced and says so ("会话可能已经关掉了").

## Session Source

Each session on the Agent page can show where it runs, as the program's own icon and/or name before its status ("Orca · 正在运行 · 刚刚"). **Settings → AI Agent → 会话来源** picks icon and name (default), icon only (the name shows on hover), name only, or hidden (`agentHostDisplay` in `fuyu-settings`).

- **Claude Code**: `list_agent_sessions` finds each running session's process the same way window switching does (below) and takes the executable of the nearest ancestor with a window, skipping Explorer and other shell hosts (`agent_status/session_host.rs`). Known executables get a product name (Orca, Windows Terminal, VS Code, Cursor, ...); others show their file name. A host found once is remembered while the island runs, so a session keeps its source after it ends; sessions that ended before the island started have none. Windows are only enumerated when a running session has no known host yet.
- **Codex**: the `originator` of the rollout's `session_meta` ("Codex Desktop", `codex_cli_rs`, `codex_vscode`) gives Codex, Codex CLI or VS Code, without an executable.
- **Icons**: `get_agent_host_icon(path)` extracts the executable's large icon (`win32/icon.rs`) and returns a PNG data URL, cached per path. It only reads existing absolute `.exe` files. A host without an executable or icon gets a generic terminal, editor or app icon.

## Session List Settings

**Settings → AI Agent** also sets, in `fuyu-settings`: how far back the list goes (`agentSessionHours`: 1, 2 (default), 6 or 24 hours, passed to `list_agent_sessions` as `windowHours`); which agents are shown (**显示哪些 Agent**: one switch with its icon for each of Codex, Claude Code, WorkBuddy, Antigravity, DeepSeek Harness, opencode, Qoder, CodeBuddy, Qwen Code, TRAE, TRAE CN, ZCode, Kimi Code, MiMo Code, Grok CLI, Copilot CLI and Droid; stored as `agentHiddenProviders`, the ids of the hidden agents, so an agent added later shows by default; the older `agentShowClaudeCode` / `agentShowCodex` settings are carried over; hidden agents also leave the island's running count); only sessions in progress (`agentHideFinished`); per card, the running time (`agentShowElapsed`) and the model (`agentShowModel`); and whether subagent lists and Claude desktop child sessions start expanded (`agentExpandChildren`, off by default, B69; a row you open or close yourself keeps its state until the switch changes).

**Running time** counts from the newest typed prompt: Claude Code's last real `user` record, Codex's last `user_message` / `task_started` (`turnStartedAt` in each summary). A session in progress shows "已运行 3 分 20 秒", ticking every second in its own leaf component; a finished one shows "用时 …" up to its last write. When a long turn pushes the prompt out of the 256 KiB tail read, the start found earlier is kept; if it was never seen, no time is shown.

**Sessions that never say they ended.** A session quit mid-turn is listed as finished when its SessionStart record says so (SessionEnd ran, or the recorded process is gone). A Claude Code session the hooks did not record falls back on Claude Code's own registry (`~/.claude/sessions/<pid>.json`): once its file has been quiet for 30 seconds and its id is not among the live registered processes, it counts as finished. Sessions closed in the VS Code extensions often skip SessionEnd (Codex runs it only after the conversation has been idle for 30 minutes), so the Agent page also lets the user archive a row by hand: a grey archive button right of the provider icon shows while the cursor is on the row; the row slides out and folds away, and a "已归档 · 撤销" pill floats at the list's bottom left for 5 seconds (undo unfolds the row back). Archiving only hides the session (`fuyu-agent-hidden-sessions` in localStorage), from the list, the running count and the collapsed island; nothing is deleted, and a removed session that writes to its file again comes back.

**Waiting on you, looked at.** A session waiting on the user (an approval, a question, a turn that ended asking) or failed stops asking once the user has looked at it, the same way as below: it leaves the session ring's count, its dot goes grey and no reminder follows, while its row still says what it waits for (roadmap B15, docs/architecture/agent/session-states.md).

**Finished but not looked at.** A session whose turn completed or failed stays bright on the Agent page (title at full brightness, glowing dot) until the user clicks it there or its window comes to the front. While any session waits to be seen, the island asks `agent_sessions_in_front` every two seconds (focus.rs): a session counts as in front when the foreground window belongs to its process or one of its ancestors (the terminal or editor it runs in), found as in "Switching to a Session's Window" below; Explorer and other shell hosts never count, and a session with no known process never does. Turns are told apart by their prompt time, so the next turn of a session is unseen again. The state is kept in memory only: sessions that finished before the island started count as seen.

**Permission mode and subagents** (`session_mode.rs`, `permissionMode` and `subagents` in each summary). Claude Code writes `permissionMode` on each typed prompt (`bypassPermissions`, `auto`, `acceptEdits`, `plan`, `default`); the newest one in the tail is used, and the one found earlier is kept when a long turn pushes the prompt out. Codex's `turn_context` gives `approval_policy` and `sandbox_policy`: `never` with `danger-full-access` counts as bypass, `never` otherwise as auto. A session in progress gets a badge for any mode but the default ("跳过确认" in orange, "自动", "自动改文件", "计划"). Subagents are the `Agent` (formerly `Task`) calls of the current turn with no `tool_result` yet, shown as "2 个子 Agent" while the turn runs; a subagent started in the background answers at once, so it is not counted. Compacting the context is not in the transcript until it is done, so it is not shown; it needs the `PreCompact` / `PostCompact` hooks.

## Switching to a Session's Window

Clicking a session on the Agent page calls `focus_agent_window` (`provider`, `cwd`, `title`, and the optional `sessionId`). It tries, in order:

0. **The session's SessionStart record** (above): its process if it still runs with the recorded start time, and its Orca tab. Works for Claude Code and Codex.
1. **What was seen of the session before** (`agent-sessions-seen.json` in the app data folder, `session_memory.rs`). Every time the session list is read, each running Claude Code session not seen yet is recorded with its process id and start time, its host program and its Orca terminal, and kept for two days. `/clear` and `/resume` give a session a new id while its process and tab carry on, and an ended session leaves Claude Code's registry, so this is how such a session still finds its window: the remembered process is followed if it still runs with the same start time, else the remembered program's window is preferred.
2. **The session's own process, from Claude Code's registry.** Claude Code records each running session in `~/.claude/sessions/<pid>.json` (`pid`, `sessionId`, `procStart`). The recorded start time must match the live process, so a reused process id is ignored. From that process the island walks up the parent chain (`claude` → `pwsh` → terminal or editor) and focuses the nearest ancestor's window, skipping Explorer and other shell hosts. When that process owns several windows (an editor with several folders open), the folder or title picks one. This works in any terminal or editor, including ones whose window title says nothing about the session.
3. **Orca's window**, when the session's Orca terminal is known (below) but its process is gone.
4. **Orca's list**, when no process is known and Orca is open: `orca terminal list --json`, using a tab only when exactly one live tab of that agent has the session's title (Orca shows the title Claude Code sets; a title the island cut short matches the start of the tab title), or, for Codex, when it is the only Codex tab in the session's folder.
When a session's parent chain breaks before its terminal (Git Bash's fork and exec, as when Happy starts the session, leaves a parent that has already exited), its host comes from the environment it inherited (`session_host.rs`): `TERM_PROGRAM` names the innermost terminal (`WezTerm` with `WEZTERM_EXECUTABLE`, `vscode` with `VSCODE_GIT_ASKPASS_NODE`, `ghostty`, `Apple_Terminal`, `iTerm.app`, `mintty` for Git Bash), else `WT_SESSION` means Windows Terminal. That host gives the session its icon and is the program preferred in step 1. On macOS, a session running inside `tmux` (`TMUX` in its environment or `tmux` in its parent chain, `agent_status/tmux.rs`, A12) resolves its pane and attached `tmux` client through `tmux list-panes` / `list-clients`, appends the client's ancestor chain so the outer terminal (Alacritty, Ghostty, iTerm2, Terminal, WezTerm, VS Code) is found, and runs `tmux select-window` / `select-pane` after focusing.
5. **Title and folder matching**: editors whose title names the folder (markers such as "●", "(Workspace)", "[Administrator]" and the "[SSH: host]" of a remote window are ignored, and a folder above the session's, such as the repository of a worktree, also counts; VS Code, Cursor, Windsurf, VSCodium, TRAE, TRAE CN, Kiro, Zed, JetBrains IDEs and Antigravity IDE are recognized), terminals whose title is the session title, then the Codex app. On macOS, when Accessibility trust is already granted (`macos/accessibility.rs`, A14), the island reads `AXWindows` and `AXTitle` on candidate processes (150 ms messaging timeout), picks the matching window with the same scoring, unminimizes and raises it (`AXRaise`, logged as `ax-window=raised`), and activates its main window; without Accessibility trust it never prompts and activates the whole app as before.

**macOS terminals and WezTerm** (A12). After activating Terminal, iTerm2 or Ghostty (1.3+), the island runs AppleScript (`macos/terminal_tabs.rs`) against the session's tty (or the attached `tmux` client's tty) to select the tab and, in iTerm2 and Ghostty, focus the exact split pane (`mac-tab=selected` or `mac-tab=none`). WezTerm (`wezterm.rs`) runs the `wezterm` CLI beside `wezterm-gui` (`wezterm.exe` on Windows, `WezTerm.app/Contents/MacOS/wezterm` on macOS) to match the pane by `tty_name` first and then by the session title (`wezterm-tab=selected` or `wezterm-tab=none`).

**Window-only fallback notice** (A12). Desktop agent apps without a session-level deep link (Antigravity, Antigravity IDE, Claude desktop's Code tab, Codex desktop, WorkBuddy, DeepSeek Harness, OpenCode desktop, native TRAE sessions) and terminals whose tab could not be matched still bring the host window forward and return `true`, and also emit `agent-focus-window-only` (`{ provider, sessionId, app, name }`) to the main window so the clicked row shows a 3-second inline notice telling the user to pick the session inside the app; known desktop-only hosts also show a muted note in the row's hover card.

**Orca** runs many terminals in one window titled "Orca". After its window comes to the front, the island also runs `orca terminal switch --terminal <handle>` with the CLI shipped next to Orca (`<Orca.exe folder>\resources\bin\orca.exe`). The CLI is started without a console and not waited for, because it takes a few seconds to reach Orca. The handle comes from the session record above. Installs from before it ran `fuyu-agent-running.cmd claudeCode session` from SessionStart instead, which saved the hook input as `agent-terminals/<handle>.json` inside Orca; those files are still read (only `term_<hex and ->` names, deleted after 7 days). The handle is looked up in this order: (1) for a **running** Claude Code session, its own process's `ORCA_TERMINAL_HANDLE`, read from the process environment (`win32/process_env.rs`; Windows has no API for another process's environment, so it reads the PEB's process parameters, and anything that does not read back cleanly is ignored). This needs no hook and finds sessions opened before the hook was installed; (2) the session record, then the older `agent-terminals` record, which still cover sessions that have ended while their tab stays open; (3) for **Codex**, which has neither, `orca terminal list --json` (about a second; given up after 6 s): only when exactly one live terminal runs Codex in the session's folder is it used, so the island never guesses between several. Split panes in one Orca tab may share the tab: `terminal switch` brings the tab forward.
**Windows Terminal** keeps every tab of a window in one window, and has no command to switch to a tab by session ([microsoft/terminal#19783](https://github.com/microsoft/terminal/issues/19783)). After a Windows Terminal window comes to the front, the island reads the names of its tabs through UI Automation (`win32/uia_tabs.rs`, each call given up after 1 s) and selects the tab whose title is the session title, the title Claude Code sets, with the glyph in front ignored. A title the island cut short matches a tab title that starts with it. Only a tab that alone carries the title is selected, so the island never guesses between two tabs with the same title. When the tab is in another window of the same Windows Terminal process, that window is brought forward instead. The log notes `wt-tab=selected` or `wt-tab=none`; with `none` only the window is brought forward. Codex does not set the tab title, so its tabs are matched only when their title happens to be the session title.

**VS Code** and editors built on it (Cursor, Windsurf, VSCodium, Trae, Kiro) have no way to select one of their terminals from outside. With the **Fuyu extension** (`tixxin.fuyu`, source in `packages/vscode-extension/`) installed in that editor, after the editor window comes to the front the island opens `<scheme>://tixxin.fuyu/focus?pids=<session process chain>&title=<session title>` (`vscode`, `vscode-insiders`, `cursor`, `windsurf`, `vscodium`, `trae`, `kiro`). The editor hands the link to the window used last, which is the one just brought forward, and the extension shows the terminal whose shell is one of those processes, or else the only terminal named like the session; it does nothing when none matches. The island first looks for a `tixxin.fuyu-<version>` folder in the editor's extensions folder (`~/.vscode/extensions`, `~/.cursor/extensions`, ...; ignoring ones listed in `.obsolete`), since opening the link without the extension would make the editor offer to install it. It also skips the link when Windows kept the window behind. The log notes `editor-terminal=sent`, `no-extension` or `failed`.

The extension is on the VS Code Marketplace as `TixXin.fuyu` since 0.2.0 (published 2026-11-10 by uploading the .vsix on the publisher's management page; the publisher id is `TixXin`, so `package.json` says so in that case). It is not on Open VSX, which Cursor, Windsurf and VSCodium search. Either way the island installs it itself (task A9, `editor_extension.rs`). Its files are compiled into the island, which builds the `.vsix` when asked and runs the editor's command line with `--install-extension <vsix> --force`. The command line (`code.cmd`, `cursor.cmd`, ...) is looked for in the `bin` folder next to the running editor, then on `PATH`, then under `%LOCALAPPDATA%\Programs` and Program Files; afterwards the island checks the extensions folder again. Editors already open need Reload Window before the extension takes effect. There are two ways in:

- **Settings → AI Agent → Connection → Editor extension** lists the editors found (an extensions folder or a command line exists), each "Installed" or with an Install button (`get_editor_extension_states`, `install_editor_extension`).
- **After a click** that lands in an editor without the extension (`no-extension`), the island sends `agent-editor-extension-missing` and the Agent page floats a pill at its bottom: Install / Don't ask again. It shows once per editor while the island runs, and never again for an editor dismissed (`fuyu-agent-editor-extension-dismissed`).

What gets installed is the extension as it is in `packages/vscode-extension/` (`tixxin.fuyu`; the .vsix manifest takes its name, publisher, version and description from `package.json`). An editor that still has the extension from before the rename counts as having it, since the island links to that one too ([rename compatibility](../architecture/contracts.md#改名兼容d17)).

## Reply Status Marker

**Settings → AI Agent → reply status marker** asks each agent to end every reply with one character (`↩` your turn, `⋯` waiting on a background task, `✓` done), so the Agent page can tell what a finished session waits for. The island appends a marked section (`<!-- fuyu: reply marker v5 -->` … `<!-- /fuyu: reply marker -->`) to the end of each agent's global prompt file, and only where that agent's folder already exists:

| Agent | File |
|---|---|
| Claude Code | `$CLAUDE_CONFIG_DIR/CLAUDE.md` (default `~/.claude`) |
| Codex | `$CODEX_HOME/AGENTS.md` (default `~/.codex`) |
| WorkBuddy | `CODEBUDDY.md` in `~/.workbuddy` and `~/.workbuddy-ai`, whichever exist (only `$WORKBUDDY_CONFIG_DIR` when set; from WorkBuddy's source, not tested) |
| Antigravity | `~/.gemini/GEMINI.md` (from Antigravity's docs, not tested; Gemini CLI reads it too) |
| DeepSeek Harness | `AGENTS.md` in each DSH folder the island reads |
| opencode | `$XDG_CONFIG_HOME/opencode/AGENTS.md` (default `~/.config/opencode`) |
| Qoder | `AGENTS.md` in `~/.qoder` and `~/.qoder-cn` |
| CodeBuddy Code | `~/.codebuddy/CODEBUDDY.md` |
| Qwen Code | `~/.qwen/QWEN.md` |
| ZCode | `~/.zcode/AGENTS.md` |
| Kimi Code | `$KIMI_CODE_HOME/AGENTS.md` (default `~/.kimi-code`) |
| MiMo Code | `~/.config/mimocode/AGENTS.md` (or `$MIMOCODE_HOME/config`) |
| Grok CLI | `~/.grok/rules/fuyu-island.md` (a file of its own; Grok reads every `rules/*.md`) |

The rest of each file is kept. A file that is a symlink is written through to its target; when several agents point at the same file it gets one section; a dangling link is reported as an error on the settings page and left alone. Switching the marker off removes the section. Switching it on or off, and **安装/修复**, delete the rules file earlier versions wrote (`~/.claude/rules/fuyu-reply-marker.md`). Each agent's reader looks for the character at the end of the last reply: Claude Code, Codex and WorkBuddy in their transcripts, Antigravity in the transcript its hooks point to, DSH in the `turnOutline` response, opencode in the database. Windows needs Developer Mode to create symlinks; following one has not been tested there.

## Sessions on Other Computers

### Read over SSH (no setup on the server)

Settings → AI Agent → **Remote computers** lists the `Host` aliases in `~/.ssh/config`, and computers added on that page by address (user, host, port; kept in `agent-remote-hosts.json`, never in `~/.ssh/config`, and reached as `ssh -p <port> <user>@<host>`). For each one switched on, the island keeps one `ssh -F <island config> -o BatchMode=yes <alias> sh -s` open (the config is below; without it, `ssh -o BatchMode=yes -o ClearAllForwardings=yes <alias> sh -s`): the script is sent once, prints `FUYU_READY`, and then answers a request about every 3 seconds while sessions are listed (a request costs a few hundred milliseconds instead of a new login; a broken connection is opened again, after a minute when it failed). Each request reads that computer's Claude Code transcripts and Codex rollouts of the session window: for each file the first 40 lines (first prompt, starting folder, Codex's session meta) and the last 256 KiB, the same parts the local scan reads; unchanged files are only named, and a file whose head the island has gets only its tail. They go into `%APPDATA%\com.tixxin.fuyu\remote-sessions\<alias>\`, laid out like a home folder with the remote modification times, and the local scan reads that folder, so titles, models, effort and states work as for local sessions. `BatchMode` means key login only: a host that would ask for a password fails at once (its error shows on the settings row). The island config, `%APPDATA%\com.tixxin.fuyu\ssh\<alias>.conf`, is written from `ssh -G <alias>` each time a connection opens: every option the host resolves to except its own tunnels (`LocalForward`, `RemoteForward`, `DynamicForward`), control sockets, agent and X11 forwarding and the like, a `ProxyJump` turned into the `ProxyCommand` it means, and one `RemoteForward 127.0.0.1:0 127.0.0.1:<endpoint port>` with `ExitOnForwardFailure no`: port 0 lets the server's sshd pick a free port, so the forward never collides with another user's on a shared server, and ssh says which (`Allocated port N`, hence `LogLevel INFO`). The island passes that port and the host's approval token to the script, which keeps `<port there> <endpoint port> <node name> <token>` in `~/.fuyu/approval-port` while it runs and deletes it when the connection ends. The script runs with `umask 077`, so that file (and the saved notifications) only you can read; the approval hooks take the token from it, so it is never written into `~/.claude/settings.json`, which other users of a shared server may be able to read. Your `~/.ssh/config` is only read. When the endpoint is not running, the config cannot be made, or connecting through it fails, the connection is opened without it, with `ClearAllForwardings`, so the sessions still come and the settings row says why approvals do not. The same run lists the ids in the server's `~/.claude/sessions` whose process is alive (`kill -0`; entries of other machines sharing the home, told by `pidDomain` and `/etc/machine-id`, count as alive), so a Claude Code session quit there is told as for a local one: no longer running, and left out under **Hide sessions that have quit**. The server needs only `sh`, `find`, GNU `stat`, `head`, `tail`, `sed`, `grep` and `dd`. Without hooks there, a remote session never shows as waiting on you, and a Codex session quit mid-turn shows as running until it turns stale.

The same request also brings back DeepSeek Harness checkpoints and the inputs saved by Antigravity CLI's remote hooks (see [DeepSeek Harness](#deepseek-harness) and [Antigravity](#antigravity)). Unlike transcripts, these are whole JSON files: each is fetched in full, up to 512 KB, and a larger one is skipped. WorkBuddy has only a desktop app, so it has no remote sessions. opencode keeps its sessions in sqlite (`${XDG_DATA_HOME:-~/.local/share}/opencode/opencode.db`, or `$OPENCODE_DB`). When that database changes size or time, the remote script uses `sqlite3` (or Python's `sqlite3` module when the command is missing) to copy the sessions in the time window into `~/.fuyu/opencode-recent.db`: the session rows, each session's last 40 messages plus its first prompt, their text and tool parts without tool output or metadata, and the 1.x todos. That small database is fetched whole like a checkpoint (up to 512 KB) and read with the same code as a local one (`opencode_remote.rs`). With neither tool on the remote, opencode sessions are not listed. The remote service state is unknown, so remote sessions are never marked as exited because the service stopped. There is no plugin, approval or reply marker on the remote side for opencode.

**Install/repair** and the **reply status marker** also act on every computer switched on here (`remote_setup.rs`): the island reads the file over the same SSH, changes it as it changes the local one, and writes it back through a full temporary copy and `cat`, so a dropped connection never cuts the file short. A file that is a symlink is not written, here or there (the link would be cut, or a file kept elsewhere, such as an instructions repository, changed); the result says so, and that file is yours to change. The reply marker is the exception to the symlink rule: on a remote computer it goes into each agent's global prompt file as it does locally (see [Reply Status Marker](#reply-status-marker); `remote_reply_marker.rs`, B35): `${CLAUDE_CONFIG_DIR:-~/.claude}/CLAUDE.md`, `${CODEX_HOME:-~/.codex}/AGENTS.md`, `~/.gemini/GEMINI.md` when the server has `~/.gemini/antigravity-cli`, and `AGENTS.md` in `~/.dsh`, `~/.dsh-beta` and `$DSH_HOME`. One SSH call lists these files and brings their text back. A link is resolved with `readlink -f` and its target written, each target once; a dangling link is left alone and reported under that computer; a missing file is created when its folder exists, and a missing folder is skipped. Environment variables count only when ssh's non-interactive shell sees them. Switching it on or off deletes the rules file earlier versions wrote there (`~/.claude/rules/fuyu-reply-marker.md`, or its name from before the rename). Remote Install/repair brings the section up to date, and deletes the old file, only on a computer that already has the marker (a section in a prompt file, or the old rules file); one that never had it is left alone. opencode sessions are not read remotely yet, so its file is not written there. Remote Install/repair also writes Antigravity CLI's hooks when the server has `~/.gemini/antigravity-cli` (see [Antigravity](#antigravity)). The remote `~/.claude/settings.json` gets only `PermissionRequest`, the waiting `Notification`, `PreCompact` and `PostCompact` hooks (Claude Code only), each saving its input as one file in `~/.fuyu/agent-notifications/`, as the local hook script does in `%APPDATA%\com.tixxin.fuyu\agent-notifications\`; the fetch above brings the folder along and drops files older than a day, and the newest file of each session decides, so two sessions waiting at once both show as waiting, and a compacting remote session shows so. The settings page lists each computer's result under the card.

**Approvals from a remote computer.** While the approval endpoint runs, Install/repair also writes approval hooks into each remote `~/.claude/settings.json`: `PermissionRequest`, `PreToolUse` for `AskUserQuestion`, and the activity events, as the local install has them, but as commands that read the port file and run `curl -s --noproxy '*' -H "Host: 127.0.0.1:<endpoint port>" … --data-binary @- http://127.0.0.1:<port there>/…`, rather than HTTP hooks, because Claude Code sends HTTP hooks through `http_proxy`, which on a server often leads back out to this computer's proxy with the token and the tool input. Each carries `X-Fuyu-Remote: <alias>` and a token of its own for that computer (a hash of the island's token and the alias), so a token copied from one server is good only for requests claiming that server. The request goes through the reverse forward of the session connection above to the island, which shows the card with the computer's name before the project; **Terminal** on such a card looks for a window by folder and title only. The fallback is the terminal: with no port file (no connection), one written on another node (a home shared by login nodes; the forward listens on one), a refused connection or the island gone, the command exits 1 without output (never 2, which would deny) and Claude Code asks there, as it also does while the card waits. Run Install/repair once after updating from a version without these hooks.

On a shared server, another user can listen on a loopback port but cannot write your home, so the hooks only post to the port your own connection got. What is left: should the script be killed outright (`kill -9`) its port file stays behind, and until the next connection writes a new one, a user who then took that port would get the hooks' requests. If the server refuses the forward, the settings row says approvals from that computer cannot reach the cards.

### Reported by the server

Claude Code or Codex running on another computer (an SSH server, a dev container, VS Code Remote) writes its session files and runs its hooks there, so the island cannot see it, and `127.0.0.1` in a hook there means that computer. Such a session can still be listed: a hook there reports it over the local API (below), through an SSH tunnel back to this computer, or a plugin reports it with `agentStatus.report`. A report that names the machine (`host`) and the agent (`agent`: `claudeCode` or `codex`) is listed on the Agent page with the local sessions, the machine's name in place of the program; clicking it says where it runs instead of looking for a window. Other reports only light the island, as before. Reports are kept in memory (gone after a restart), at most 16 sources at once.

1. Turn on the built-in **Local API** plugin and its "allow changes" switch. `%APPDATA%\com.tixxin.fuyu\local-api.json` has the `port` (usually 39271) and the `token`.
2. Forward that port, unchanged, from the server back to this computer. The local API only answers requests addressed to `127.0.0.1:<its port>`, so the port number must be the same on both ends. In `~/.ssh/config` on this computer:

   ```
   Host dev-box
     RemoteForward 39271 127.0.0.1:39271
   ```

3. On the server, save this as `~/.local/bin/fuyu-remote-hook.sh` and make it executable. It needs `curl` and `python3`, gives up after a second and always exits 0, so a closed tunnel never holds the session up. A script set up before the rename under its old names keeps working ([rename compatibility](../architecture/contracts.md#改名兼容d17)); the names are only what this example uses.

   ```sh
   #!/bin/sh
   # fuyu-remote-hook.sh <running|waiting|completed|end> [claudeCode|codex]
   # Reports this session to Fuyu through the SSH tunnel. Needs FUYU_TOKEN.
   phase="$1"; agent="${2:-claudeCode}"; port="${FUYU_PORT:-39271}"
   input=$(cat)
   source=$(printf '%s' "$input" | python3 -c 'import json,sys; print("r-" + json.load(sys.stdin).get("session_id", "x")[:24].lower())') || exit 0
   url="http://127.0.0.1:$port/v1/agent-status/$source"
   if [ "$phase" = end ]; then
     curl -s -m 1 -X DELETE -H "Authorization: Bearer $FUYU_TOKEN" "$url" >/dev/null 2>&1
     exit 0
   fi
   body=$(printf '%s' "$input" | PHASE="$phase" AGENT="$agent" HOST_NAME="$(hostname)" python3 -c '
   import json, os, sys
   hook = json.load(sys.stdin)
   report = {"phase": os.environ["PHASE"], "agent": os.environ["AGENT"], "host": os.environ["HOST_NAME"][:64],
             "name": "Codex" if os.environ["AGENT"] == "codex" else "Claude Code"}
   if hook.get("cwd"): report["cwd"] = hook["cwd"][:260]
   if hook.get("prompt"): report["title"] = " ".join(hook["prompt"].split())[:120]
   print(json.dumps(report))') || exit 0
   curl -s -m 1 -X PUT -H "Authorization: Bearer $FUYU_TOKEN" -H "Content-Type: application/json" \
     --data "$body" "$url" >/dev/null 2>&1
   exit 0
   ```

4. Set `FUYU_TOKEN` on the server (for example in `~/.profile`) and add the hooks to `~/.claude/settings.json` there. Fields left out of a report keep their last value, so the title from the prompt stays after the turn ends.

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "~/.local/bin/fuyu-remote-hook.sh running" }] }],
       "Notification": [{ "hooks": [{ "type": "command", "command": "~/.local/bin/fuyu-remote-hook.sh waiting" }] }],
       "Stop": [{ "hooks": [{ "type": "command", "command": "~/.local/bin/fuyu-remote-hook.sh completed" }] }],
       "SessionEnd": [{ "hooks": [{ "type": "command", "command": "~/.local/bin/fuyu-remote-hook.sh end" }] }]
     }
   }
   ```

   Codex takes the same script with `codex` as the second argument, on its `UserPromptSubmit`, `PermissionRequest` (waiting), `Stop` and `SessionEnd` hooks.

Without the tunnel the requests fail at once and nothing else changes. A remote session that never sends `end` can be removed from the Agent page by hand like any other.

## WorkBuddy

WorkBuddy (Tencent's desktop agent) is listed on the Agent page with its own icon (task B23.2, issue #155). Both editions are read and shown as one agent (B49): the Chinese edition keeps its data in `~/.workbuddy`, WorkBuddy AI in `~/.workbuddy-ai` (the app sets `WORKBUDDY_CONFIG_DIR` to it when it starts its CLI), and the session files have the same format. What is known about both, with sources, is in [agent-harnesses.md](../research/agent-harnesses.md).

- **Sessions**: `projects/<encoded folder>/<session id>.jsonl` in both folders, read like Claude Code's transcripts (first lines and last 256 KiB, same session window). The title is the newest `ai-title` record, otherwise the first `<user_query>` of the session, otherwise the folder; the model is `providerData.requestModelName`. A turn is running from a user message, a `function_call`, a `function_call_result` or a `reasoning` record, and done at an assistant message; an assistant message with `status: "incomplete"` fails the turn, unless its error is `Interrupted by user`.
- **Quit sessions**: a session counts as quit when it is not in `sessions/<pid>.json` of either folder (`pid`, `sessionId`, like `~/.claude/sessions`) and no edition is running: `WorkBuddy.exe` or `WorkBuddyAI.exe` on Windows; on macOS the app with bundle id `com.workbuddy.workbuddy-ai`, found through LaunchServices, counts as running while a process runs an executable under its `Contents/MacOS/` (its main executable is a generic `Electron`, so the name says nothing; B37). After quitting, it takes a few seconds to half a minute to count as gone. 5.3.8 listed each session there; 5.9.3 lists only its host processes (`interactive-<pid>`, `prewarm-…`), so while the app runs its sessions stay listed. With both editions installed and only one running, the other's sessions are not marked quit either. The Chinese edition's Mac bundle id is not known, so on macOS only WorkBuddy AI is recognised.
- **Hooks**: **安装/修复** adds Fuyu's hooks to `settings.json` in each folder that exists (Claude Code's format; each a single `command` string, since WorkBuddy's support for `args` is unknown): `UserPromptSubmit` and `PreToolUse` (`*`) mark the turn running, `Stop` marks it completed, and two `PermissionRequest` hooks save the input in `agent-notifications\workbuddy-*.json` (waiting on you) and run the approval script. The rest of the file is kept, and nothing is written to a folder that does not exist. The hook status is the worse of the two folders. WorkBuddy reads the file only at start, so quit it completely and reopen it after installing.
- **Status light**: WorkBuddy has its own row in the status light card and lights the island running / completed like Claude Code.
- **Waiting on you**: from the saved `PermissionRequest` input, as for Claude Code.
- **Approving on the island**: with approvals on, the approval script posts to `/workbuddy/permission-request` and the island answers allow or deny in Claude Code's `hookSpecificOutput.decision` format. With approvals off, the prompt stays in WorkBuddy.
- **Clicking a session** brings up the window of the edition that runs (`WorkBuddy.exe` / `WorkBuddyAI.exe` on Windows, `WorkBuddy AI` on macOS).
- **Usage** (B25, #170): WorkBuddy has no quota window, only per-record credit consumption (`providerData.rawUsage.credit`). Switching **WorkBuddy** on under **Settings → AI Agent → Usage rings** (off by default) sums today's, 7-day and total credits across `~/.workbuddy/projects` and `~/.workbuddy-ai/projects` offline and appends them to the usage hover card without adding a percentage ring.
- Not done: SSH (WorkBuddy has only a desktop app, no CLI or server edition).

Only the session format was checked against real files (WorkBuddy 5.3.8 and 5.9.3, 2026-11-13). The hook path, the events, the `cmd.exe /d /s /c` command form and whether WorkBuddy accepts Claude Code's approval answer come from a community test and WorkBuddy's source, not its documentation (which names `~/.codebuddy/settings.json`); none of the hooks has been run with WorkBuddy yet (#179).

## Antigravity

Google Antigravity (the IDE and the `agy` CLI) is listed on the Agent page with its own icon (task B23.3, issue #155). It was written from Antigravity's hook documentation; on 2026-11-13 the hooks were run with the `agy` CLI 1.5.8 on Windows (SessionStart, PreInvocation and Stop all fired, with the input fields below), but not yet with the island showing the result, nor with the App or IDE, and the approval hook not at all (#179); what is known, with sources, is in [agent-harnesses.md](../research/agent-harnesses.md).

- **Hooks**: **安装/修复** writes a `fuyu` group to `~/.gemini/config/hooks.json`, but only when `~/.gemini/antigravity`, `antigravity-ide` or `antigravity-cli` exists: `SessionStart` and `PreInvocation` run `fuyu-agent-running.cmd antigravity start|running`, `Stop` runs `... antigravity stop` and the status script (`completed`), and `PreToolUse` (matcher `run_command`) runs the approval script. Other groups in the file are kept. The running script saves each hook's input in `agent-antigravity\<running|stop>-*.json` and sets the running marker, so Antigravity has its own row in the status light card and lights the island.
- **Sessions**: one per `conversationId`, from the newest saved input: folder from `cwd` (otherwise the first of `workspacePaths`, which the CLI writes as `C:/...`), title from `<data folder>/annotations/<conversationId>.pbtxt` (falling back to the first `USER_INPUT` in the transcript, `lastUserInput` before a transcript exists, and then the folder; `lastUserInput` stays as the latest prompt), model from `modelName`. Archived conversations (`archived:true` in `.pbtxt`) and subagent conversations (whose transcript starts with `SYSTEM_MESSAGE`) are skipped. `running` shows as running (stale after the usual 10 minutes), `stop` as done. The last reply is the last `PLANNER_RESPONSE` in the transcript the input's `transcriptPath` points to (used for the reply marker); older inputs of a conversation and inputs over a day old are deleted.
- **Approving on the island**: only `run_command` is stopped. With approvals on, the card shows the command line; allow, deny and **Terminal** answer `allow`, `deny` and `ask` (Antigravity then asks itself). With approvals off the script prints nothing and takes no side. Users on the TURBO (auto-run) preset get every `run_command` sent to the island first once approvals are on.
- **Waiting on you**: Antigravity's hooks have no approval or notification event, so a session shows as waiting only while one of its approvals waits on the island (the island writes `agent-notifications\antigravity-approval-<id>.json` and deletes it when the card closes).
- **Over SSH** (Antigravity CLI only): remote **安装/修复** adds the same `fuyu` group (`SessionStart`, `PreInvocation`, `Stop`) on a server that has `~/.gemini/antigravity-cli`, as inline `sh` commands using only `cat`, `sed`, `mv` and `find`. They save the input as `~/.fuyu/agent-antigravity/running-<conversationId>.json` or `stop-<conversationId>.json` (one file per conversation, files over a day old removed), which the session fetch brings back together with any matching `~/.gemini/antigravity-cli/annotations/<conversationId>.pbtxt` title file, and the island reads like the local ones. Remote sessions show running and done, only on the Agent page. While the approval endpoint runs, remote Install/repair also adds `PreToolUse` (matcher `run_command`) to the group (B36): the same `curl` as Claude Code's remote hooks reads `~/.fuyu/approval-port` and posts to `/antigravity/pre-tool-use` through the reverse forward with `X-Fuyu-Remote`, and the island's allow, deny or **Terminal** goes back as it does locally. When the island cannot be reached, the hook prints nothing and exits 0, leaving the call to Antigravity. Remote approvals write no `agent-notifications` file, so a remote session does not show as waiting on you while its card waits (as for Claude Code). The CLI's glibc requirement on servers is not verified. Not yet run on a server (#179).
- **Clicking a session** brings up the Antigravity window (A10, #646). Antigravity is several programs: the IDE (`Antigravity IDE.exe`, `Antigravity IDE.app`; `antigravity-ide` on Linux), the 2.0 agent app and pre-rename versions (`Antigravity.exe`, `Antigravity.app`), and the `agy` CLI. The island takes the `transcriptPath` from the session's newest saved hook input: under `~/.gemini/antigravity-ide` it looks for the IDE first, under `~/.gemini/antigravity` for `antigravity` first, and under `~/.gemini/antigravity-cli` for no program (the CLI runs in a terminal, so the usual terminal match by folder and title applies); with no path it tries the IDE names, then `antigravity`. On Windows, when that program has several windows, the one whose title names the session's folder (the first of `workspacePaths`) wins, otherwise any of its windows; the three names also count as editors, so the folder match works when no program name matched. On a Mac the whole app is brought forward, not one window. The hooks record no process id, so the log says `process=unknown` for Antigravity sessions: the `.cmd` hook only saves its input, and which process runs the hook (the IDE's `language_server`, its `node`) is not verified; the log line carries `product=ide|desktop|cli` and `prefer=` with the names tried.
- **macOS** (B67, 2026-11-16): tried with the Antigravity 2.32.1 App, which still reads `~/.gemini/config/hooks.json` alongside its plugins' `hooks.json` (another tool's plugin group under `~/.gemini/config/plugins/` is left alone). After Install/repair, a conversation showed on the island with its title, model (`gemini-3.8-flash`, effort high) and current tool while running, and as done after `Stop`; a `run_command` raised an approval card on the island, and **Allow** let Antigravity run it. The IDE and the `agy` CLI were not tried on the Mac.
- **Usage** (B25, #170): switching **Antigravity** on under **Settings → AI Agent → Usage rings** (off by default) adds a concentric 5-hour / 7-day ring (`--usage-antigravity`) for Gemini models and lists the Claude / GPT (`3p-5h`, `3p-weekly`) windows and tier name in the hover card. It queries the running local Antigravity `language_server` (`RetrieveUserQuotaSummary` and `GetUserStatus` over loopback with `--csrf_token` read in Rust memory) first, and falls back to `~/.gemini/jetski-standalone-oauth-token` or `~/.gemini/oauth_creds.json` against Cloud Code (`retrieveUserQuotaSummary` + `fetchAvailableModels`) when Antigravity is closed. Because both endpoints are undocumented, an unrecognized response or 404 reports **接口失效 / Endpoint changed** rather than `0%`.
- Not done: telling whether a session has quit.

## DeepSeek Harness

DeepSeek Harness (DSH) sessions are listed on the Agent page with DeepSeek's icon (task B24, issue #155). The approach follows flyl1u/fly-island's DSH integration. DSH was not installed on the Windows machine it was written on, so none of this has been run there (#179). Details and sources are in [agent-harnesses.md](../research/agent-harnesses.md).

- **Folders**: the island reads these DSH folders, in this order; a folder is read once, and the same session in two folders shows once, from the newer checkpoint:
  - `DSH_HOME` and `DSH_DESKTOP_NEXT_HOME` (trimmed; `~`, `~/` and `~\` expand to your home folder; a relative path is not read);
  - `~/.dsh` (the official app, anywhere-labs DSH NEXT), `~/.dsh-beta` (anywhere-labs DSH Desktop Beta), `%APPDATA%\dsh-desktop\harness`;
  - dshed's `<AppData>\dshed\dsh`;
  - the folder picked inside DSH NEXT or DSH Desktop Beta (`<AppData>\DSH NEXT\home\desktop-next-location.json` or `desktop-next-last-home.json`, and the same under `DSH Desktop Beta\home`) and inside DSH Desktop (`<AppData>\DSH Desktop\data-directory\state.json`, `activeHome`).

  `<AppData>` is `%APPDATA%` on Windows and `~/Library/Application Support` on macOS. A folder picked in an app is picked up without restarting the island. The environment variables are read once, when the island starts: after setting `DSH_HOME` or `DSH_DESKTOP_NEXT_HOME`, restart the island.
- **Sessions**: one per `session-<UUID>` from DSH's projection checkpoint `storages/session_projcache/sessions/<id>.json`, which is plain JSON (up to 512 KB; larger ones are skipped); the zstd-compressed conversation log is never opened, only checked to exist, so deleted sessions are skipped. Only checkpoint versions 3–7 and session formats 3–4 are read, each row checked by its `ver`; anything else is skipped.
- **Title, model, last prompt and reply** come from the `title`, `modelSelection`, `turnOutline` rows; the context size from `contextPressure`. The reply marker is read from the `turnOutline` response.
- **Plugin (hooks & approvals)**: **安装/修复** generates a zero-dependency native Cordis plugin under `dsh-plugin/` in Fuyu's data folder (`package.json`, `cordis.patch.yml`, `index.js`, task B72.1) and removes the legacy `fuyu-dsh-hooks.json`. When a DSH home does not yet have a custom `cordis.patch.yml`, **安装/修复** writes `- insert: [{ id: fuyu-island, name: "<path>/dsh-plugin/index.js" }]` into `<DSH home>/cordis.patch.yml`, which DSH's `app-boot` loads across every profile (`desktop`, `web`, etc.). When `<DSH home>/cordis.patch.yml` already contains custom rules and does not mount `fuyu-island`, Fuyu keeps the file untouched and returns the 3-line `- insert:` snippet to append to `cordis.patch.yml` (or you can install the bundle into a profile with `dsh plugin --profile <name> add <fuyu-home>/dsh-plugin`).
- **State**: with `fuyu-island` mounted, the plugin listens to `session/event` (`turn/start`, `tool/call`, `turn/end`) and `session/disposed` to light the island running / completed / failed and DSH has a row in the status light card. Without it, only the session list shows state: an open question in `userQuestions` is "waiting on you"; an open turn in `turnBoundary` is running (stale after the usual 10 minutes); otherwise done. Checkpoints are written in batches, so the state can lag the app by a little.
- **Approving on the island**: the plugin prepends a listener on DSH's `approval/request` waterfall (`ctx.inject(['approval'], ...)`), firing only when DSH actually asks for approval (not by guessing tool-name regexes) and pairing with the preceding `tool/call` arguments so the card displays the command or file path alongside DSH's approval reason. Posting to `/dsh/permission` (legacy `/dsh/pre-tool-use` still accepted): **Allow** returns `'allowed-once'`, **Deny** returns `'rejected'`, and **Terminal** (back to DSH), a 2-minute timeout, approvals off or Fuyu closed calls `next()` so DSH's own approval dialog takes over. Cancelling the turn in DSH (`req.signal` abort) immediately aborts the pending HTTP request and closes the island card. While a card waits, the session shows as waiting on you (`agent-notifications\dsh-approval-<id>.json`).
- **Over SSH**: the session fetch also looks in the server's `~/.dsh`, `~/.dsh-beta` and `$DSH_HOME` (only an absolute path, and only when ssh's non-interactive shell sees it, for example set near the top of `~/.bashrc` or in `~/.ssh/environment`; one exported only in an interactive shell is not seen). It brings back each checkpoint whose session still has its `session.v3.jsonl.zstd` or `session.v4.jsonl.zstd` log, whole; `$DSH_HOME`'s go under `.dsh-home/` in the mirror. Remote sessions show running, waiting and done the same way as local ones. There are no remote hooks or approvals. Not yet run on a server (#179).
- **Clicking a session** brings up the running DSH desktop window (`DeepSeek Harness.exe`, `DSH Desktop.exe`, `DSH NEXT.exe` and so on). There is no link to open a specific conversation. dshed and other third-party clients' windows are not recognized yet.
- **Usage** (B25, #170): switching **DeepSeek Harness** on under **Settings → AI Agent → Usage rings** (off by default) reads `.credentials.yaml` from the active DSH store in Rust memory (refusing stores whose `cordis*.yml` overrides the default DeepSeek endpoints) and queries `api.deepseek.com/user/balance` (`deepseek-official`) or `platform.deepseek.com/api/v0/users/get_user_summary` (`deepseek-account`) at most once a minute, showing the wallet balance in the usage hover card without adding a percentage ring.
- Not done: telling which desktop app a session belongs to.

## opencode

opencode sessions are listed on the Agent page with opencode's icon (task B30, issue #349). The island opens opencode's own sqlite database read-only; the only thing installed is a plugin for opencode 1.x (below). None of this has been run against a real opencode with the island yet (#179). Details and sources are in [agent-harnesses.md](../research/agent-harnesses.md).

- **Database**: `~/.local/share/opencode/opencode.db` on every system, Windows included (`%USERPROFILE%\.local\share\opencode`, not `%APPDATA%`); `OPENCODE_DB` and `XDG_DATA_HOME` take precedence. opencode 2.x sessions come from `session_v2`, `session_message` and `session_part`, 1.x sessions from `session`, `message` and `part`; the same id in both shows once, from 2.x. Subagent sessions and archived sessions are not listed.
- **What shows**: title (opencode's default "New session - …" counts as no title), model (its variant in the effort spot), folder, last prompt and reply, and running / done / failed. 2.2 and later 2.x read `time_busy`, `time_idle` and `idle_outcome`; 1.x and older 2.x are judged from the last message. opencode has no status light row: it only counts through the Agent page's sessions.
- **Quit sessions**: in 2.x every session runs in a background service that writes its pid to `~/.local/state/opencode/service.json`. When that process is gone, its sessions show as ended and a running one as done. 1.x has no service, so only the usual 10-minute timeout applies.
- **Waiting on you and approvals** (2.x, while the background service runs): the island reads `service.json` every 5 seconds and does nothing else while no live opencode process owns it. While the service runs, it asks `GET /api/session/active` every 1.5 seconds, then each running session's `GET /api/session/:id/permission`, with the service's password (Basic auth, only to a loopback `http://` address; the password stays in Rust memory and is never logged or passed to the page). Each pending request makes its session show as waiting on you (`agent-notifications\opencode-permission-<id>.json`, removed when the request goes), whether or not approvals are on. With approvals on, the request also gets a card: allow answers `once`, deny answers `reject` with your reason, **Terminal** only closes the card. There is no "always allow", because opencode stores `always` as a permanent rule for the project. A request answered in opencode first closes its card on the next poll; a card nobody clicks closes after 2 minutes and does not come back.
- **Waiting on you and approvals** (1.x, through a plugin; B34): 1.x has no background service, so **安装/修复** writes `fuyu-island.js` into `plugin/` of opencode's config folder (`$XDG_CONFIG_HOME/opencode`, default `~/.config/opencode`), with the island's data folder written in, when opencode is installed. Its status (absent, not installed, outdated, current) is reported with the other agents' hooks, but opencode has no row in the status light card, so an outdated plugin is not pointed out. The 1.19.5 plugin types declare `permission.ask`, but opencode never calls it, so the plugin listens to `event`: on `permission.asked` it writes `agent-notifications/opencode-plugin-<request id>.json` (`{"hook_event_name":"PermissionRequest","session_id":…}`, as other agents' waiting files) and posts the request, with its `cwd`, to the approval endpoint's `/opencode/permission` (port and token from `agent-approval.json` in the island's data folder). The island answers `{"reply":"once"|"always"|"reject","message"?}`, or `{}` for **Terminal**, a timeout or approvals off; the plugin passes the reply to opencode through its own `client`. opencode's own prompt still shows and whoever answers first wins: on `permission.replied`, `session.idle` or `session.error` the plugin drops its request and deletes the waiting file, and the card closes. The default export carries both `server` (1.x) and an empty `setup`, since 2.x scans the same folder; whether 2.x loads it quietly is not yet checked. Checked with opencode 1.19.5 against a fake endpoint (allow, deny with a reason, answering in opencode first), not yet with the island.
- **Clicking a session** brings up the OpenCode desktop window when it runs, otherwise looks for a terminal by folder and title. It cannot open a specific session.
- Not done: waiting and approvals for `opencode --standalone` (2.x: its private server's password is only in the child process's `OPENCODE_PASSWORD` and its address only on the pipe to the TUI, and it writes no `service.json`; a 2.x server plugin would be the way, if ever), answering questions, usage (only OpenCode Go subscriptions have quota windows), SSH, cc-connect.

## MiMo Code

Xiaomi's MiMo Code is a fork of opencode, so the island reads it the same way as opencode 1.x (task B54, issue #530). Not yet run with the island (#179).

- **Sessions**: `~/.local/share/mimocode/mimocode.db` (`MIMOCODE_DB`, or `data/` under `MIMOCODE_HOME`), opened read-only; only the main agent's messages count when the table records which agent wrote them. The same folders are used on Windows and macOS.
- **Waiting on you and approvals**: **安装/修复** writes the opencode plugin into `~/.config/mimocode/plugin/fuyu-island.js`, posting to `/mimo/permission` and writing `agent-notifications/mimo-plugin-<id>.json`. No status light row, as for opencode.
- Not read: databases of other release channels (`mimocode-<channel>.db`).

## Qoder, CodeBuddy Code and Qwen Code

These three CLIs copy Claude Code's hooks and session folders, so the island reads them through one shared layer (`claude_compat.rs`, B48); each has its own icon and switch on the Agent page. None has been run with the island yet (#179).

| | Qoder (and Qoder CN) | CodeBuddy Code | Qwen Code |
|---|---|---|---|
| Folder | `~/.qoder` (`QODER_CONFIG_DIR`) and `~/.qoder-cn` (`QODERCN_CONFIG_DIR`), both handled | `~/.codebuddy` (`CODEBUDDY_CONFIG_DIR`) | `~/.qwen` (`QWEN_HOME`) |
| Sessions | `projects/<project>/<id>.jsonl`, Claude Code's format; title from `<id>-session.json` next to it; `agent-*.jsonl` (subagents) skipped | `projects/<project>/<id>.jsonl`, each record wrapped in `{type, uuid, timestamp, payload}` | `projects/<project>/chats/<id>.jsonl`, Gemini-style `parts`; title from the `system` / `custom_title` record (manual or auto) |
| Hooks | `settings.json`: `UserPromptSubmit`, `PreToolUse`, `Stop`, `StopFailure`, `PermissionRequest` | same | same (a timeout of 1000 or more counts as milliseconds; the island's 150 seconds is unaffected) |
| Waiting on you | saved `PermissionRequest` input | saved `Notification` input with matcher `permission_prompt` (its auto mode also sends `PermissionRequest` for tools it allows itself) | saved `PermissionRequest` input |
| Approving on the island | `/qoder/permission-request`, answered in `hookSpecificOutput.decision` | `/codebuddy/permission-request` | `/qwen/permission-request` |

Each has its own row in the status light card (`agent-<id>-running.flag`). Clicking a session looks for a terminal by folder and title. Not done: usage, SSH (all three have Linux CLIs), cc-connect.

**Agents that also run Claude Code's hooks** (Grok CLI and Copilot CLI, B56): each gets its own hooks, so the island also sees their events on the Claude Code routes. A request there whose `transcript_path` lies in that agent's folder, or that carries one of its own field names, is answered `{}` and not shown twice. Claude Code's status light still lights up when such an agent runs Claude Code's hooks, since the script writes the marker without reading the input; to avoid that, turn off Claude hooks in that agent (Grok: `[compat.claude] hooks = false` in `~/.grok/config.toml`).

## Grok CLI

xAI's Grok CLI is listed with its own icon (task B57, issue #544). Checked with Grok 1.0.77 on macOS in headless mode (hook input and session reading); the interactive TUI, waiting and the reply marker are not yet checked (#179).

- **Sessions**: `~/.grok/sessions/<encoded folder>/<session id>/` (or under `GROK_HOME`): `summary.json` for the title, model and reasoning effort, `events.jsonl` for whether a turn runs, ended or waits on a permission prompt (an internal format that may change), `chat_history.jsonl` for the latest prompt, reply and tool call. Non-primary sessions are skipped.
- **Hooks**: **安装/修复** writes `~/.grok/hooks/fuyu-island.json`, a file of its own (Grok merges the whole folder): `UserPromptSubmit` and `PreToolUse` mark the turn running, `Stop` and `StopCancelled` completed, `StopFailure` failed, and `Notification` with `permission_prompt` saves the input (waiting on you).
- **No approving on the island**: Grok's docs say a hook's `allow` only means "not blocked", never approval on the user's behalf.
- Not done: usage (Grok has no local file or public endpoint for it), SSH, cc-connect.

## GitHub Copilot CLI

Listed with its own icon (task B55, issue #542). Not yet run with the island (#179).

- **Sessions**: `~/.copilot/session-state/<id>/events.jsonl` and `workspace.yaml` (or under `COPILOT_HOME`); the title is `summary` in `workspace.yaml`.
- **Hooks**: **安装/修复** writes `~/.copilot/hooks/fuyu-island.json`, a file of its own (`version: 1`, `bash` and `powershell` commands, `timeoutSec`). Waiting on you comes only from the hooks, since the session files record no waiting event.
- **Approving on the island**: `/copilot/permission-request`, answered with `{behavior, message, interrupt}`.
- Copilot also runs Claude Code's hooks; see the note above on agents that do.
- Not done: usage, SSH.

## Droid

Factory's Droid is listed with its own icon (task B58, issue #546; island approvals in B72.2, issue #782). Not yet run with the island (#179).

- **Sessions**: `~/.factory/sessions/<project>/<uuid>.jsonl` with `<uuid>.settings.json` for the model and reasoning effort (or under `FACTORY_HOME`).
- **Hooks**: written into `~/.factory/hooks.json` when it exists (events at the top level), otherwise into `hooks` in `~/.factory/settings.json`, since Droid ignores the latter when the former exists. The user's own hooks stay. Reopen the Droid session after installing.
- **Approving on the island**: `PreToolUse` (matcher `^(Bash|Execute|RunCommand|Edit|Write|MultiEdit)$`) posts to `/droid/pre-tool-use` and is answered with `hookSpecificOutput.permissionDecision` (`allow` to run without Droid's interactive prompt, `deny` with your reason, or `ask` to hand back to the terminal). Read-only tools are not stopped. Waiting on you comes from `Notification` with `permission_prompt` and while an island approval is pending.
- Not done: usage, SSH.

## pi (pi-coding-agent / PiDeck)

`@earendil-works/pi-coding-agent` (CLI `pi` and the `PiDeck` / `PiCove` desktop app) is listed with its own icon (task B71, issue #745). Not yet run with the island (#179).

- **Sessions**: `~/.pi/agent/sessions/<encoded folder>/<ISO>_<session-id>.jsonl` (or under `PI_CODING_AGENT_DIR`): `session` header for `id` and `cwd`, `session_info` for renamed titles, `model_change` and `thinking_level_change` for the model and effort, and `message` for prompts, replies, tool calls (`toolCall` / `toolResult`), token `usage` and the reply status marker. Also mirrored over SSH remote.
- **Extension (hooks)**: **安装/修复** writes `~/.pi/agent/extensions/fuyu-island.js` when `~/.pi` (or `PI_CODING_AGENT_DIR`) exists. It hooks `session_start`, `agent_start`, `agent_end`, `tool_call` and `session_shutdown` to light the status light (`agent-pi-running.flag` and `agent-status.json`) and record `agent-sessions/<id>.json` for quit detection and window focus.
- **Approving on the island**: since pi does not prompt on every tool call by default, set `FUYU_PI_APPROVAL=1` to have `tool_call` wait on `/pi/permission` and block denied calls.
- **Reply marker**: `~/.pi/agent/AGENTS.md`.
- **Clicking a session** focuses the terminal (or `PiDeck` / `PiCove` when running).

## TRAE and TRAE CN

TRAE IDE's international and Chinese editions are two agents with the same icon: `trae` (`~/.trae`) and `traeCn` (`~/.trae-cn`), each with its own hooks, status light row and switch (task B29, issue #312). TRAE's session database is encrypted, so sessions are pieced together from what the hooks save, as for Antigravity: a session shows up only after the hooks are installed. Neither has been run with the island yet (#179).

- **Hooks**: **安装/修复** writes `hooks.json` (Claude Code's grouped format; a top-level `"version": 1` is added when missing) when the folder exists: `UserPromptSubmit`, `PreToolUse` and `PostToolUse` save the input in `agent-trae/` (or `agent-traeCn/`) and mark the turn running, `Stop` saves it and marks it completed, `Notification` saves it in `agent-notifications`. Saved inputs keep the first and last prompt, the latest reply and the newest record of each session, and are deleted after 24 hours.
- **Sessions**: title from the first prompt; latest prompt, current tool (`tool_name`, the command or file) and the reply after the last prompt. No model, permission mode, to-dos or context tokens, and no quit detection (TRAE sends no session end).
- **Waiting on you**: `Notification` with `permission_prompt`, `ask_user_question`, `document_review` or `browser_interaction`, and while an island approval is pending.
- **Approving on the island**: commands, file edits/writes/deletions and MCP tools (`^(RunCommand|Bash|Write|Edit|MultiEdit|StrReplace|CreateFile|DeleteFile|WriteToFile|ReplaceInFile|mcp__.*)$`; read-only tools are not stopped), posted to `/trae/pre-tool-use` or `/traeCn/pre-tool-use` and answered with `hookSpecificOutput.permissionDecision` (`allow`, `deny` with a reason, or `ask` to leave it to TRAE); the main session's `agent_id` is ignored so it is not treated as a subagent (B72.3). When TRAE's tool is set to confirm manually, `allow` does not skip TRAE's own prompt; set TRAE to **Auto Run** so allowing on the island runs directly without a second click in TRAE, denying blocks it, and handing back (`ask`) prompts in TRAE.
- **Clicking a session** brings up the TRAE or TRAE CN window.
- **Two things to check in TRAE's settings**: if Hooks run "in the sandbox", the scripts may be unable to write to the island's data folder, so switch to running them locally (the default is not known yet); and if "import Claude Code hooks" is on, the hooks the island installed for Claude Code also run in TRAE and its sessions show up as Claude Code, so turn that switch off.
- Not done: reply marker (the path of TRAE's personal rules file is not documented), usage, SSH, cc-connect.

## ZCode

Zhipu's ZCode (desktop app and `zcode` CLI) is listed with its own icon (task B53, issue #529). Its session database uses opencode 1.x's tables, so the island reads it with the opencode reader. Not yet run with the island (#179).

- **Sessions**: `~/.zcode/cli/db/db.sqlite` (or `ZCODE_SESSION_DB_PATH`), opened read-only; title, folder, model, latest prompt and reply, current tool, to-dos and context tokens. Deleted sessions, subagents and workflow subtasks are skipped.
- **Hooks**: **安装/修复** writes `hooks.events` in `~/.zcode/cli/config.json` (Claude Code's grouped format) and turns `hooks.enabled` on, when `~/.zcode` exists: `UserPromptSubmit` and `PreToolUse` mark the turn running, `Stop` marks it completed, `PermissionRequest` saves the input (waiting on you) and runs the approval script. ZCode reads the hooks when a session starts, so open a new session after installing. Turning hooks off in ZCode's settings shows the hooks as needing repair.
- **Approving on the island**: `/zcode/permission-request`, answered in Claude Code's `hookSpecificOutput.decision` format.
- Not done: quit detection, usage, SSH.

## Kimi Code

Moonshot's Kimi Code CLI (the TypeScript `kimi`, data in `~/.kimi-code` or `KIMI_CODE_HOME`) is listed with its own icon (task B52, issue #528). Not yet run with the island (#179).

- **Sessions**: `sessions/<workspace>/<session>/state.json` for the title, rename, latest prompt and folder (archived and child sessions are skipped), and `agents/main/wire.jsonl` for whether a turn is running, the reply, model and current tool.
- **Hooks**: **安装/修复** appends a marked `[[hooks]]` block to `config.toml`: `UserPromptSubmit` marks the turn running, `Stop` and `Interrupt` mark it completed, `StopFailure` failed, and `PermissionRequest` saves the input (waiting on you). Each entry has only `event`, `command` and `timeout`, since any other field makes Kimi reject the whole file. If `hooks` is an inline array, or the file cannot be read, nothing is written and an error is shown. Open a new session after installing.
- **No approving on the island**: `PermissionRequest` cannot answer, and `PreToolUse` fires for every tool call before Kimi's own permission check and only accepts deny. When a session waits on you, answer it in the terminal.
- **Usage**: the existing Kimi usage ring (API key in settings).
- Not read: the old Python `kimi-cli` (`~/.kimi`), and the runtime inside the Kimi desktop app.
- Not done: quit detection, SSH, cc-connect.

## Other Agents

Tools other than the agents above can report their status and sessions too, with no Fuyu release needed:

- **Hook scripts & `agent-status.json` (B71)**: `fuyu-agent-running` and `fuyu-agent-status` accept any valid third-party provider id (`[A-Za-z][A-Za-z0-9_-]{0,31}`), writing `agent-<id>-running.flag` and updating `<id>` in `agent-status.json` (with optional `name`, `title`, `cwd`, `sessionsDir`). Non-built-in entries in `agent-status.json` and `agent-<id>-running.flag` automatically join the snapshot's `others` list and drive the status light.
- **Third-party session directories (B71)**: configure `{ "id": "<provider>", "name": "<label>", "sessionsDir": "~/..." }` in `<fuyu-home>/agent-providers.json` (or `sessionsDir` on the provider's entry in `agent-status.json`), or drop `.jsonl` (Claude Code / pi / Droid format) or `.json` session files into `<fuyu-home>/agent-third-party/<provider>/`. They are listed on the Agent page with a robot icon and support window switching by folder and title.
- **Plugin & Local API**: from a plugin with the `agent-status:write` permission (`agentStatus.report`), or over the local API (`PUT /v1/agent-status/{source}`). See [local-api.md](local-api.md#ai-agent-状态) and [plugins/README.md](../plugins/README.md).

## Manual Smoke Test

After using the in-app installer, run these commands with the app-data scripts:

```powershell
$dir = Join-Path $env:APPDATA 'com.tixxin.fuyu'
& "$dir\fuyu-agent-running.cmd" codex
powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\fuyu-agent-status.ps1" codex completed

& "$dir\fuyu-agent-running.cmd" claudeCode
powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\fuyu-agent-status.ps1" claudeCode completed

powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\fuyu-agent-status.ps1" claudeCode failed
```

Expected behavior:

- The island turns blue after the `fuyu-agent-running.cmd` command.
- The island returns green after the `fuyu-agent-status.ps1 ... completed` command.
- The island turns yellow after the `fuyu-agent-status.ps1 ... failed` command and returns green after clearing that status from the app.

## Notes For Manual Configuration

Manual configuration is usually unnecessary. Prefer the in-app installer because it uses the user's actual app-data path and handles Claude Code's Windows command behavior.

If you do edit Claude Code hooks manually on Windows, prefer Claude Code's exec form: put `cmd.exe` or `powershell.exe` in `command` and pass every argument through `args`. This avoids shell-selection differences between VSCode, Git Bash, PowerShell, and `cmd.exe`.
