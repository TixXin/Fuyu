# 浮屿 Fuyu 隐私政策 / Privacy Policy

生效日期：2026-11-20

## 中文

浮屿（Fuyu）是在你的电脑上运行的桌面工具。我们不运营收集用户数据的服务器，应用里没有统计、遥测或广告。

**只在本机处理的数据**：待办、笔记、设置、剪贴板历史、截图和录屏、系统通知（QQ、微信、即时通讯消息提醒）、媒体播放信息、AI 代理（如 Claude Code、Codex）的会话状态。这些数据保存在你电脑上的 `%USERPROFILE%\.fuyu` 和应用数据目录里，不会上传给我们。

**你开启或填写后才会联网的功能**：下面的功能只有在你开启、填写账号或主动使用时才会连接对应的服务。传输的只是该功能需要的内容，适用对方服务的隐私政策：

- 邮箱提醒：用你填写的账号连接你的邮箱服务器（IMAP）。
- 日历：连接你填写的 CalDAV 服务或日历订阅链接。
- 快捷翻译、AI 改写：把你选中的文字发给你选择的翻译或 AI 服务（如 DeepSeek、OpenAI、Kimi、智谱等），使用你自己填写的密钥。
- 歌词：在你开启在线歌词后，用歌名、歌手查询 LRCLIB 等歌词服务。
- 跨设备同步：把加密后的数据写到你指定的文件夹或 WebDAV 服务，加密密码只保存在你的设备上。
- 手机推送：通过你填写的 Bark 设备地址发送提醒。
- AI 用量：在你开启后，用本机已有的凭据向 Anthropic、智谱、Kimi 查询你的用量。
- 插件和主题市场：从 GitHub 下载插件、主题和列表。

**账号和密钥**：你填写的密码、授权码和 API 密钥保存在 Windows 凭据管理器里，只用于连接对应的服务。

**更新**：从 Microsoft Store 安装的版本由 Microsoft Store 负责更新，应用自己不检查更新。

**删除数据**：卸载应用，并删除 `%USERPROFILE%\.fuyu` 文件夹，即可清除本机数据。凭据可以在设置里移除，或在 Windows 凭据管理器里删除。

**儿童**：浮屿不面向儿童收集任何信息。

**变更和联系**：本政策更新时会修改这个页面和生效日期。有问题请在 https://github.com/TixXin/fuyu/issues 提出。

## English

Fuyu is a desktop tool that runs on your computer. We do not run servers that collect user data, and the app contains no analytics, telemetry or ads.

**Data processed only on your device**: todos, notes, settings, clipboard history, screenshots and recordings, system notifications (QQ, WeChat and messenger alerts), media playback information, and the session status of AI agents such as Claude Code and Codex. This data is stored on your computer in `%USERPROFILE%\.fuyu` and the app data folder and is never uploaded to us.

**Features that go online only when you turn them on or fill them in**: each of the following connects to its service only after you enable it, enter an account, or use it. Only the content the feature needs is sent, and that service's own privacy policy applies:

- Mail alerts: connect to your mail server (IMAP) with the account you enter.
- Calendar: connect to the CalDAV service or calendar subscription link you enter.
- Quick translation and AI rewrite: send the text you select to the translation or AI service you choose (such as DeepSeek, OpenAI, Kimi or Zhipu), using your own API key.
- Lyrics: after you turn on online lyrics, look up the song title and artist on lyrics services such as LRCLIB.
- Cross-device sync: write encrypted data to the folder or WebDAV service you choose; the encryption password stays on your devices.
- Phone push: send alerts through the Bark device address you enter.
- AI usage: after you turn it on, query your usage from Anthropic, Zhipu or Kimi with credentials already on your computer.
- Plugin and theme market: download plugins, themes and lists from GitHub.

**Accounts and keys**: passwords, authorization codes and API keys you enter are kept in Windows Credential Manager and used only to connect to the matching service.

**Updates**: the version installed from Microsoft Store is updated by Microsoft Store; the app does not check for updates itself.

**Deleting your data**: uninstall the app and delete the `%USERPROFILE%\.fuyu` folder to remove the data on your device. Credentials can be removed in Settings or in Windows Credential Manager.

**Children**: Fuyu does not collect any information from children.

**Changes and contact**: when this policy changes, this page and its effective date are updated. Questions are welcome at https://github.com/TixXin/fuyu/issues.
