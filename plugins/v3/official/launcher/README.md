# @fuyu/launcher

应用启动台（App Launcher）— 浮屿第 3 版官方插件，支持 Windows 与 macOS。

- 跨平台扫描本机已安装应用（macOS 的系统与用户应用程序目录，Windows 的系统与当前用户开始菜单程序快捷方式），在 `ctx.dataDir/launcher.json` 记录最近启动时间与启动次数，最近使用的应用排在最前。
- 提供岛展开启动台页（`island.page/v1`）与设置分节（`settings.section/v1`）：打开页面时搜索框自动聚焦，支持大小写不敏感子串与首字母缩写过滤、`ArrowUp` / `ArrowDown` 切换高亮、`Enter` 立即启动、`Escape` 清空搜索词；脱离宿主进程组启动应用，宿主重启不影响已打开程序。
