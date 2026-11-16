# 推广渠道

> 日期：2026-11-16。问题：想在 V2EX、linux.do 发帖推广浮屿，但两边都还进不去；还有哪些中文和国外的技术站能发、门槛和规矩是什么。范围：各站官方公告和投稿说明（NodeLoc 公告与版块、HelloGitHub 和 ruanyf/weekly 的 README、awesome-tauri 贡献指南、Show HN 规则、少数派 Matrix 说明），加上 WebSearch 找到的论坛帖子。

## 结论

现在就能发、最值得先做的四个，都不用邀请码：

1. **阮一峰《科技爱好者周刊》**：在 [ruanyf/weekly](https://github.com/ruanyf/weekly) 提 issue 自荐软件，每周五出刊。读者多，成本最低。
2. **HelloGitHub 月刊**：通过 [hellogithub.com/periodical](https://hellogithub.com/periodical) 推荐或自荐，每月 28 号出刊。
3. **NodeLoc**：2026-09-18 起开放注册（靠风控，不要邀请码）。发到「科技与创作 › 开源」（版块说明是「分享您自己的或他人的有趣开源项目」），或者「工具控」「创作者互助」。
4. **Hacker News 的 Show HN**：浮屿能直接下载试用，符合规则；用英文 README，作者要在帖子里回复问题。

其次：少数派 Matrix「开发者说」（要实名，新作者的文章先审核），小众软件论坛「发现频道」（Windows 小工具的老牌自荐地，注册要求未核实），Reddit 的 r/windowsapps，Product Hunt；B 站、小红书、知乎可以直接发 `video/` 里现成的宣传片。

暂时去不了：

| 站点 | 卡在哪 |
|---|---|
| V2EX | 2024 年起新号要邀请码；用户的 Google 账号没有老号 |
| linux.do | GitHub 换邀请码要求注册满 5 年，ShengLin1001 要到 2026-12-21 |
| NodeSeek | 仍是邀请制，lv3 以上用户才能兑换邀请码 |
| awesome-tauri | 贡献指南写明不再收录应用 |

## 详细

浮屿的情况（2026-11-16）：开源（AGPL-3.0），GitHub 270 star，官网 fuyu.ing，Windows 和 macOS，有中英文 README（`docs/readme/README.en.md`）和宣传片。

### 中文

| 站点 | 门槛 | 怎么发 | 注意 |
|---|---|---|---|
| 科技爱好者周刊 | GitHub 账号 | ruanyf/weekly 提 issue | 阮一峰说周刊很多内容来自投稿，他每隔几天看一遍 issue 区 |
| HelloGitHub | GitHub 账号 | 官网推荐或自荐页；issue 区也能看到「【开源自荐】」开头的帖子 | 月刊，每月 28 号 |
| NodeLoc | 开放注册，环境被风控判高风险时注册不了 | 开源 / 工具控 / 创作者互助 版块 | 站内有一帖「关于推广相关规则的建议」（2026-07-01），发前看一眼 |
| 少数派 Matrix | 实名认证；新作者「新手上路」，前 3 篇要审核 | 写「开发者说」 | 开发者自荐要在文首写利益相关声明，不能冒充用户写评测；两周内没获推荐算未通过 |
| 小众软件 发现频道 | 论坛账号（注册要求未核实） | meta.appinn.net 发现频道发帖 | 小众软件主站常从这里挑开发者自荐的软件写文章 |
| B 站 / 小红书 / 知乎 | 无 | 发宣传片、写介绍 | 素材在 `video/`，流程见 `fuyu-video` skill |
| V2EX | 邀请码，或持有它的 Solana token | 「分享创造」节点 | 等有老号的人帮忙，或拿到邀请码 |
| linux.do | 邀请码 | 待定 | 2026-12-21 起用 GitHub 领；Clash 已让 linux.do 直连，不然 Cloudflare 会封机房出口 |

### 国外

| 站点 | 门槛 | 规矩 |
|---|---|---|
| Show HN | HN 账号 | 必须是能试用的东西，不能是落地页；项目要有分量；作者要在场讨论；小版本更新不算；不许找人点赞或评论 |
| Reddit | 账号 | 各版规矩不同，发前看侧栏；普遍要求自我推广少于发帖的 10%。r/windowsapps 常有开源应用发布帖 |
| Product Hunt | 账号 | 未细查 |
| awesome-tauri | — | 不再收应用，只收插件和集成 |

### 发帖时的共同点

- 写成作者自己的开发故事，配动图或截图，别写成广告词。
- 写明开源、免费，并给下载地址。
- 新号先在站内正常参与一阵子再发，有些站对新号自荐的帖子很敏感。

## 来源

- NodeLoc 公告：[nodeloc 已经开放注册，但是我们提高了要求](https://www.nodeloc.com/t/topic/109519)（2026-09-18）、[社区注册机制调整通知（启用邀请制）](https://www.nodeloc.com/t/topic/82092)、[关于推广相关规则的建议](https://www.nodeloc.com/t/topic/97067)；版块列表来自 `https://www.nodeloc.com/site.json`（2026-11-16 查）
- [ruanyf/weekly README](https://github.com/ruanyf/weekly)：「欢迎投稿文章/软件/资源，请提交 issue」
- [HelloGitHub README](https://github.com/521xueweihan/HelloGitHub)、[HelloGitHub 月刊页](https://hellogithub.com/periodical)
- [awesome-tauri 贡献指南](https://github.com/tauri-apps/awesome-tauri/blob/main/.github/contributing.md)
- [Show HN Guidelines](https://news.ycombinator.com/showhn.html)
- 少数派：[开发者说投稿说明](https://sspai.com/post/53144)、[Matrix 新共创体系](https://sspai.com/post/72089)（2022 年的说明，细节可能已变）
- 小众软件发现频道的开发者自荐例子：[appinn.com](https://www.appinn.com/page/12/)
- NodeSeek 邀请码规则：[站务帖](https://www.nodeseek.com/post-893437-1)（2026-07-10）
- V2EX 邀请码：[20240505 邀请码系统](https://www.v2ex.com/t/1037849)、[Livid 的说明](https://x.com/Livid/status/2005948924310536508)
- linux.do 邀请码门槛：invite.linuxdo.org 登录后页面上的「申请规则」（2026-11-16 实测）
- Reddit 自我推广比例：[r/opensource 规则的转述](https://runtimewire.com/article/r-opensource-bars-ai-projects-and-requires-a-year-of-maintenance-for-promotion)（二手来源）
