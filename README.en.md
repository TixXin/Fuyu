<div align="center">
  <a href="https://fuyu.ing/logo/"><img src="docs/assets/logo-placeholder.svg" alt="Fuyu logo wanted" width="96" height="96"></a>
  <br>
  <sub><a href="https://fuyu.ing/logo/">We're looking for a logo — send yours</a></sub>

  <h1>Fuyu</h1>

  <p><b>One island for your desktop</b></p>

  <p>A desktop island for Windows: tasks, clipboard, messages, translation, music and AI status on one small island at the top of your screen.</p>

  <p>English · <a href="README.md">中文</a></p>

  <p>
    <a href="https://github.com/TixXin/fuyu/releases/latest"><b>Download</b></a>
    ·
    <a href="https://fuyu.ing">Website</a>
    ·
    <a href="https://fuyu.ing/plugins/">Plugin market</a>
    ·
    <a href="docs/plugins/README.md">Write a plugin</a>
    ·
    <a href="https://github.com/TixXin/fuyu/issues">Report an issue</a>
  </p>

  <p>
    <a href="https://github.com/TixXin/fuyu/releases/latest"><img alt="Version" src="https://img.shields.io/github/v/release/TixXin/fuyu?label=version"></a>
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D4">
    <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB">
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-GPL--3.0-3DA639"></a>
    <a href="https://github.com/TixXin/fuyu/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/TixXin/fuyu?style=flat&label=stars"></a>
  </p>

  <p>
    <a href="docs/assets/promo-001-one-island-en.mp4"><img src="docs/assets/readme/tour-en.gif" alt="Fuyu tour: the windows scattered over a desktop fold into the island at the top of the screen, which then opens todos, music with lyrics, new messages, the clipboard, translation and an AI agent approval before tucking itself away" width="800"></a>
    <br>
    <sub>The whole tour in 43 seconds. The island on screen is the real frontend, not a screen recording (<a href="video/README.md">how it is made</a>, in Chinese) · <a href="docs/assets/promo-001-one-island-en.mp4">Watch the full video with sound</a></sub>
  </p>
</div>

## What is this?

Fuyu (浮屿, "floating islet") is a lightweight, borderless, always-on-top floating island. It sits at the top of the screen, expands when you need it and tucks away when you are done, so the things you use all day are one glance away instead of one window switch away.

<p align="center">
  <img src="docs/assets/readme/collapsed-en.webp" alt="Fuyu collapsed: a narrow black island at the top of the screen showing synced lyrics and an audio waveform" width="800">
  <br>
  <sub>Collapsed, it takes only this strip at the top of the screen; here it is following a song with lyrics and a waveform</sub>
</p>

## What is on the island

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/readme/todo-en.webp" alt="The expanded island showing today's tasks, with the finished ones struck through below">
      <br>
      <b>Tasks and notes</b>
      <br>
      Today's tasks, the one you are focused on, a daily note and past archives.
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/readme/music-en.webp" alt="The music page on the island: cover art, synced lyrics, a progress bar and playback controls">
      <br>
      <b>Music</b>
      <br>
      Control what is playing, with a live audio waveform and synced lyrics.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/readme/messages-en.webp" alt="New messages dropping down from the island: a mail, a WeChat message and a QQ message">
      <br>
      <b>Messages</b>
      <br>
      QQ and WeChat alerts and several mailboxes, with mail you can read and answer on the island.
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/readme/clipboard-en.webp" alt="Clipboard history on the island: a command, a link, a line of text and an image, each with the app it came from">
      <br>
      <b>Clipboard and file shelf</b>
      <br>
      Text and image clipboard history; drop files on the island and drag them into another app later.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/readme/translate-en.webp" alt="The translation page on the island: the source text on the left, the translation on the right">
      <br>
      <b>Quick translation</b>
      <br>
      One shortcut away, with a choice of LLM translation services.
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/readme/agents-en.webp" alt="An approval request from Claude Code on the island: the command it wants to run, with Deny and Allow buttons">
      <br>
      <b>AI agents</b>
      <br>
      The state and usage of your Claude Code and Codex sessions; approve a request right on the island, click a session to jump to its window, and get pushed to your phone while you are away.
    </td>
  </tr>
</table>

And also:

- **Calendar**: today's and tomorrow's events next to a month view with lunar dates and holidays, a countdown on the island before a meeting, and one-click join.
- **System hints**: volume and brightness changes, and which app is using your camera or microphone.
- **Plugins and themes**: extend the island from the plugin market (sensitive data needs your permission), and pick a ready-made look from the theme market.

The look, size, tucking, shortcuts and every feature can be adjusted in the Settings window, and the app updates itself. Your data stays on your computer.

## Resource use

Collapsed and idle with no music playing (default settings, no plugins):

| | Measured |
|---|---|
| CPU | About 10% of one core (about 0.5% of a 20-core machine in total) |
| Memory | About 16 MB for Fuyu itself |
| The Agent page reading the session list once a second | 0.1% of one core |
| Each PowerShell plugin | About 60 MB more |

How it was measured, with the numbers: [idle-usage.md](docs/investigations/idle-usage.md) (in Chinese).

## Getting started

1. Download and install from [Releases](https://github.com/TixXin/fuyu/releases/latest). The installers are not code-signed; if SmartScreen warns, choose "More info → Run anyway".
2. Move the pointer onto the island at the top of the screen to expand it; the gear button or the tray icon opens Settings.
3. Mail, translation and AI agents need a one-time setup in Settings. See [mail](docs/features/mail.md), [AI agents](docs/features/agent-status-hooks.md), [QQ](docs/features/qq-notifications.md) and [WeChat](docs/features/wechat-reminders.md) (in Chinese).

Fuyu runs on Windows 10 and 11 today. A macOS port (macOS 15 or later, Apple silicon) is in progress; [platforms.md](docs/architecture/platforms.md) tracks it feature by feature, and [macos-install.md](docs/features/macos-install.md) explains installing it and allowing it on first launch (both in Chinese).

## Plugins

If the island is missing something, add it yourself. A plugin is a folder: a manifest plus a program the island starts (a PowerShell script, an exe, or a Node.js script). Plugins only send data; the island draws pages, the collapsed bar and settings from templates, so a plugin looks like the rest of the island.

```sh
npm create fuyu-plugin@latest
```

- **Install one**: from Settings → Plugin market on the island, or browse the [plugin market on the website](https://fuyu.ing/plugins/) first.
- **Write one**: the [quick start](docs/plugins/quickstart.md) takes you from nothing to a working plugin in about an hour, and the [plugin docs](docs/plugins/README.md) cover the rest (both in Chinese).
- **Share one**: add it to the [plugin market](https://github.com/TixXin/fuyu-plugins), or keep it on your own computer; see [publishing](docs/plugins/publish.md) (in Chinese).

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

## Community

Questions, ideas, or just want to chat? Scan to join our WeChat user group (mostly in Chinese):

<img src="docs/assets/readme/wechat-group.png" alt="QR code of the Fuyu WeChat user group" width="240">

## Contributing

Fuyu is a shared effort, and there is room for you:

- **Report a problem or an idea**: open an [issue](https://github.com/TixXin/fuyu/issues) and say what gets in your way or what you are missing.
- **Change code, docs or translations**: open a pull request. [CONTRIBUTING.md](CONTRIBUTING.md) covers how, and which checks to run first; [AGENTS.md](AGENTS.md) explains how the code is laid out (in Chinese).
- **Write a plugin**: no need to touch the island itself; publish it to the [plugin market](https://github.com/TixXin/fuyu-plugins).
- **Draw a logo**: Fuyu has no real logo yet, and the [logo call](https://fuyu.ing/logo/) is open.

<a href="https://github.com/TixXin/fuyu/graphs/contributors"><img src="https://contrib.rocks/image?repo=TixXin/fuyu" alt="Fuyu's contributors"></a>

## Star trend

Every star keeps Fuyu moving.

<a href="https://star-history.com/#TixXin/fuyu&amp;Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=TixXin/fuyu&amp;type=Date&amp;theme=dark">
    <img alt="Fuyu's stars over time" src="https://api.star-history.com/svg?repos=TixXin/fuyu&amp;type=Date" width="600">
  </picture>
</a>

## License

[GPL-3.0](LICENSE). Plugin authors choose their own license. Third-party dependencies and bundled assets keep their own licenses; see the [font notices](src/assets/fonts/README.md) for bundled fonts.

> [!NOTE]
> This project is maintained together by [TixXin](https://github.com/TixXin) and [ShengLin1001](https://github.com/ShengLin1001); it was renamed from fly-island to Fuyu in November 2026. The original author, [flyl1u](https://github.com/flyl1u/fly-island), prefers a lean, minimal island. To give the island more to do, and to let more people put their own DIY features on it, this project went its own way as a jointly maintained one and grew a plugin market. Pull requests are welcome (see [Contributing](CONTRIBUTING.md)), and so are your own components in the [plugin market](https://github.com/TixXin/fuyu-plugins), or plugins you install locally (see the [plugin docs](docs/plugins/README.md)).
