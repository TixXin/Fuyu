# 消息来源品牌图标

以下图标于 2026-10-19 从对应产品的官方网站取得，保留原始图片，仅在界面中等比例显示，用于标识消息来源。

| 文件 | 官网 | 原始资源 |
| --- | --- | --- |
| `qq.png` | [QQ](https://im.qq.com/index) | [官网图标](https://static-res.qq.com/static-res/imqq/qq-logo.png) |
| `wechat.png` | [微信 Windows](https://pc.weixin.qq.com/) | [官网 Apple Touch 图标](https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png) |
| `telegram.svg` | [Telegram](https://telegram.org/) | [官网站点图标](https://telegram.org/img/website_icon.svg)，2026-11-17 取得 |
| `discord.svg` | [Discord](https://discord.com/branding) | [官方品牌页图标](https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d80db9971f10a9757c99_Symbol.svg)，2026-11-17 取得 |
| `whatsapp.svg` | [WhatsApp](https://www.whatsapp.com/) | [官网站点图标](https://static.whatsapp.net/rsrc.php/y1/r/FJbTMJqMap7.svg)，2026-11-17 取得 |
| `tim.png` | [TIM](https://office.qq.com/) | [官网图标](https://mma.qq.com/timtest/img/logo-tim.png)（60×60），2026-11-17 取得 |
| `feishu.svg` | [飞书](https://open.feishu.cn/) | [开放平台站点图标](https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/open/website/favicon-logo.svg)，2026-11-17 取得 |
| `dingtalk.png` | [钉钉](https://www.dingtalk.com/) | [官网站点图标](https://gw.alicdn.com/imgextra/i3/O1CN014ZbI6ZTEhdC0ttN2_!!6000000003783-2-tps-444-444.png)（444×444，缩到 180×180），2026-11-17 取得 |
| `wecom.png` | [企业微信](https://work.weixin.qq.com/) | [官网站点图标](https://wwcdn.weixin.qq.com/node/wwnl/wwnl/style/images/independent/favicon/favicon_48h$c976bd14.png)（48×48），2026-11-17 取得 |

邮箱图标跟着邮箱地址的域名走（`src/features/messages/mail/mailProvider.ts`）：以下几家显示自己的图标，其他邮箱显示 `mail.png`。2026-11-09 取得：

| 文件 | 邮箱 | 原始资源 |
| --- | --- | --- |
| `mail-qq.png` | [QQ 邮箱](https://mail.qq.com/)（qq.com、foxmail.com） | [官网图标](https://res.wx.qq.com/t/webmail/webmail/res/images/qqmail_favicon_96h.8d124a7.png)，2026-10-19 取得 |
| `mail-netease.png` | [网易邮箱](https://mail.163.com/)（163.com、126.com、yeah.net） | [官网 Apple Touch 图标](https://mail.163.com/apple-touch-icon.png)（163 和 126 是同一张） |
| `mail-gmail.png` | [Gmail](https://mail.google.com/) | [Google 产品图标](https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png) |
| `mail-outlook.png` | [Outlook](https://outlook.live.com/)（outlook.com、hotmail.com、live.com） | [Microsoft 产品图标](https://res.cdn.office.net/files/fabric-cdn-prod_20230815.002/assets/brand-icons/product/png/outlook_96x1.png) |

认不出的邮箱用 `mail.png`，它不用任何产品的标识：2026-11-09 用 ChatGPT 生成的通用信封图标（蓝靛渐变圆角底板、白色信封），裁去透明边距、缩到 180×180 并转为 8 位调色板 PNG。

以下 AI Agent 图标于 2026-11-04 取得，用于在小岛上标识正在运行的 Agent：

| 文件 | 官网 | 原始资源 |
| --- | --- | --- |
| `claude-code.png` | [Claude](https://claude.ai/) | [官网 Apple Touch 图标](https://claude.ai/apple-touch-icon.png) |
| `codex.webp` | [ChatGPT / Codex](https://chatgpt.com/) | [官网 Apple Touch 图标](https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nytnj.webp) |
| `workbuddy.svg` | [WorkBuddy](https://www.workbuddy.cn/) | [官网图标](https://assets.workbuddy.cn/web/workbuddy/8e036eb06f87c6b08437546b3cbd58e60af45b10/assets/logo.svg)，2026-11-13 取得 |
| `antigravity.png` | [Google Antigravity](https://antigravity.google/) | [官网图标](https://antigravity.google/apple-touch-icon.png)，2026-11-13 取得 |
| `dsh.png` | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT） | 仓库里网页版的 [`apps/web/public/apple-touch-icon.png`](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/web/public/apple-touch-icon.png)（180×180，自带浅色底），2026-11-13 取得 |
| `opencode.png` | [opencode](https://opencode.ai/)（MIT） | 仓库里网页版的 [`packages/ui/src/assets/favicon/apple-touch-icon-v3.png`](https://github.com/anomalyco/opencode/blob/d432a06b9c07bab0be4e8d642173b1cb14137f11/packages/ui/src/assets/favicon/apple-touch-icon-v3.png)（180×180，深色底），2026-11-15 取得 |
| `qoder.png` | [Qoder](https://qoder.com/) | [官网 Apple Touch 图标](https://img.alicdn.com/imgextra/i4/O1CN01QkSxiCocd3D0prc8_!!6000000008124-2-tps-412-412.png)（412×412，缩到 180×180），2026-11-15 取得 |
| `codebuddy.svg` | [CodeBuddy](https://www.codebuddy.ai/) | [官网图标](https://codebuddy-1328495429.cos.accelerate.myqcloud.com/web/ide/logo.svg)（codebuddy.cn 上是同一张），2026-11-15 取得 |
| `qwen.png` | [Qwen Code](https://github.com/QwenLM/qwen-code)（Apache-2.0） | 官方文档站的 [`favicon.png`](https://qwenlm.github.io/qwen-code-docs/favicon.png)（512×512，缩到 180×180），2026-11-15 取得 |
| `trae.png` | [TRAE](https://www.trae.ai/) / [TRAE CN](https://www.trae.cn/) | 官网图标（[国际版](https://lf16-web-neutral.traecdn.ai/obj/trae-ai-static/trae_website/favicon.png)和[国内版](https://lf-cdn.trae.com.cn/obj/trae-com-cn/trae_website_prod_cn/favicon.png)是同一张，48×48），TRAE 和 TRAE CN 共用，2026-11-15 取得 |
| `zcode.png` | [ZCode](https://zcode.z.ai/) | 开源仓库 [zai-org/ZCode](https://github.com/zai-org/ZCode) 里桌面版的应用图标 `packages/desktop/build/icon.png`（1024×1024，缩成 48×48），2026-11-15 取得 |
| `mimo.png` | [MiMo Code](https://mimo.xiaomi.com/mimocode) | 官网图标 [mimo.ico](https://cdn.cnbj1.fds.api.mi-img.com/aife/mimo-blog-fe/doc_build/mimo.ico)（Xiaomi MiMo 字样，32×32，转成 PNG，没有放大），2026-11-15 取得 |
| `grok.png` | [Grok CLI](https://x.ai/cli) | grok.com 的站点图标 [android-chrome-192x192.png](https://grok.com/images/android-chrome-192x192.png)（192×192，缩成 48×48），2026-11-15 取得 |
| `kimi-code.png` | [Kimi Code](https://github.com/MoonshotAI/kimi-code)（MIT） | 仓库里 VS Code 扩展的图标 `apps/vscode/resources/kimi-icon-storefront.png`（128×128），2026-11-15 取得 |
| `copilot.png` | [GitHub Copilot CLI](https://github.com/features/copilot/cli) | 官方仓库 [github/copilot-sdk](https://github.com/github/copilot-sdk) 的 `assets/copilot.png`（256×256，深色图案、透明底）；深色岛上看不见，垫了白底并缩成 64×64，2026-11-15 取得 |
| `droid.png` | [Factory Droid](https://factory.ai/) | 官网图标 [favicon.svg](https://factory.ai/favicon.svg)（自带黑底），渲染成 64×64 PNG，2026-11-15 取得 |
| `pi.svg` | [pi (`pi-coding-agent`)](https://pi.dev/)（MIT） | 按 pi 命令行标识绘制的深色底 `π` 矢量图标，2026-11-17 制作 |
| `cursor.png` | [Cursor](https://cursor.com/) | [官网 Apple Touch 图标](https://cursor.com/apple-touch-icon.png)（180×180），2026-11-18 取得；去掉不透明黑底，只留立方体，深色面板上才分得开 |

QQ、微信、TIM、企业微信、QQ 邮箱的品牌标识及相关权利归腾讯及对应权利人所有；Telegram 标识归 Telegram Messenger Inc. 所有，Discord 标识归 Discord Inc. 所有，WhatsApp 标识归 WhatsApp LLC / Meta 所有，飞书（Feishu / Lark）与 TRAE 标识归字节跳动所有，钉钉（DingTalk）、Qoder、Qwen 标识归阿里巴巴所有；网易邮箱标识归网易所有，Gmail、Antigravity 标识归 Google 所有，Outlook 标识归 Microsoft 所有；Claude 标识归 Anthropic 所有，OpenAI 标识归 OpenAI 所有，WorkBuddy、CodeBuddy 标识归腾讯所有，DeepSeek 标识归杭州深度求索所有，opencode 标识归 opencode 项目所有，ZCode 标识归北京智谱华章科技所有，MiMo 标识归小米所有，Kimi 标识归北京月之暗面科技所有，Grok 标识归 xAI 所有，GitHub Copilot 标识归 GitHub 所有，Factory / Droid 标识归 Factory 所有，pi 标识归 pi-coding-agent 项目所有，Cursor 标识归 Anysphere 所有。图标随应用打包，不在运行时请求远程图片。
