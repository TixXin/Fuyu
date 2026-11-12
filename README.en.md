<div align="center">
  <img src="src-tauri/icons/mark.svg" alt="Fuyu logo" width="96" height="96">

  <h1>Fuyu</h1>

  <p>English · <a href="README.md">中文</a></p>

  <p>A desktop island for Windows: tasks, clipboard, messages, translation, music and AI status on one small island at the top of your screen.</p>

  <p>
    <a href="https://fuyu.ing">Website</a>
    ·
    <a href="https://github.com/TixXin/fuyu/releases/latest">Download</a>
    ·
    <a href="https://github.com/TixXin/fuyu/issues">Report an issue</a>
  </p>

  <p>
    <img alt="Version" src="https://img.shields.io/github/v/release/TixXin/fuyu?label=version">
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0078D4">
    <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB">
  </p>
</div>

> [!NOTE]
> This project is maintained independently by [TixXin](https://github.com/TixXin) and [ShengLin1001](https://github.com/ShengLin1001); it was renamed from fly-island to Fuyu in November 2026. The original author, [flyl1u](https://github.com/flyl1u/fly-island), prefers a lean, minimal island. To give the island more to do, and to let more people put their own DIY features on it, this project became independently maintained and grew a plugin market. You are welcome to publish your own components to the [plugin market](https://github.com/TixXin/fuyu-plugins), or install your own plugins locally (see the [plugin docs](docs/plugins/README.md)).

## What is this?

Fuyu (浮屿, "floating islet") is a lightweight, borderless, always-on-top floating island. It sits at the top of the screen, expands when you need it and tucks away when you are done, so the things you use all day are one glance away instead of one window switch away.

## Features

- **Tasks and notes**: today's tasks, the one you are focused on, a daily note and past archives.
- **Clipboard and file shelf**: text and image clipboard history; drop files on the island and drag them into another app later.
- **Messages**: QQ and WeChat alerts and several mailboxes, with mail you can read and answer on the island.
- **Quick translation**: one shortcut away, with a choice of LLM translation services.
- **AI agents**: the state of your Claude Code and Codex sessions; click one to jump to its window.
- **Music**: control what is playing, with a live audio waveform.
- **Plugins**: extend the island from the plugin market; sensitive data needs your permission.

The look, size, tucking, shortcuts and every feature can be adjusted in the Settings window, and the app updates itself. Your data stays on your computer.

## Resource use

Collapsed and idle with no music playing (default settings, no plugins): about 10% of one CPU core (about 0.5% of a 20-core machine in total), and about 16 MB of memory for Fuyu itself. The Agent page reads the session list once a second, which measured at 0.1% of one core. Each PowerShell plugin adds about 60 MB. How it was measured, with the numbers: [idle-usage.md](docs/investigations/idle-usage.md).

## Getting started

1. Download and install from [Releases](https://github.com/TixXin/fuyu/releases/latest). The installers are not code-signed; if SmartScreen warns, choose "More info → Run anyway".
2. Move the pointer onto the island at the top of the screen to expand it; the gear button or the tray icon opens Settings.
3. Mail, translation and AI agents need a one-time setup in Settings. See [mail](docs/features/mail.md), [AI agents](docs/features/agent-status-hooks.md), [QQ](docs/features/qq-notifications.md) and [WeChat](docs/features/wechat-reminders.md) (in Chinese).

To write your own plugin, see the [plugin docs](docs/plugins/README.md).

## Build from source

You need Windows 10/11, Node.js, pnpm, Rust, Visual Studio C++ Build Tools and WebView2 Runtime.

```powershell
git clone https://github.com/TixXin/fuyu.git
cd fuyu
pnpm install
pnpm tauri dev      # development
pnpm tauri build    # installers
```

Built with Tauri 2, React 19 + TypeScript and Rust. Releases and in-app updates are described in [docs/features/updater.md](docs/features/updater.md) (in Chinese).

## License

[GPL-3.0](LICENSE). Plugin authors choose their own license. Third-party dependencies and bundled assets keep their own licenses; see the [font notices](src/assets/fonts/README.md) for bundled fonts.
