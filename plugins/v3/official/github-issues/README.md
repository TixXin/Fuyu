# @fuyu/github-issues

GitHub Issue — 浮屿第 3 版官方插件，支持 Windows 与 macOS。

- 显式声明 `fuyu.network: ["api.github.com"]`，在设置分节配置一个或多个 `owner/repo` 公开仓库。
- 拉取未关闭的公开 issue（自动过滤 PR、带 ETag 缓存与请求频次保护），在岛展开页（`island.page/v1`）按仓库分组展示，支持筛选和点击在浏览器打开，并可选在新 issue 出现时经 `messages/v1.notify` 提醒。
