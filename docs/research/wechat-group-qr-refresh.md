# 微信群二维码到期自动更新

> 日期：2026-11-25。问题：GitHub README 和应用「交流群」里的微信群二维码 7 天就过期，每周要手动截图、裁图、改 `community.json`、提 PR，有没有办法自动换。范围：企业微信开发文档（客户群「加入群聊」）、第三方企微服务商帮助页、V2EX / GitHub issue 上的同类讨论、本仓库 CI 与 main 规则集、浮汐（`../Fuxi`）现有能力。相关任务：暂无。

## 结论

微信**没有任何官方 API 能给个人号的群生成二维码**，所以「GitHub Actions 定时刷新」这条路走不通；要么换成不会过期的码，要么让一个一直在线、本来就在群里的微信客户端去点开群码再截下来。按省事程度排：

1. **一劳永逸：改用企业微信客户群的「加入群聊」码（群活码）**。码不随 7 天过期，一个码挂最多 5 个群，群满自动建新群，README 和 `community.json` 里的图从此不用换。代价是要建企业微信、把群迁成客户群（老群成员要重新进），未认证企业扫码进群上限 200 人。
2. **保留现在的微信群，让浮汐每周自动换码（推荐的短期方案）**。浮汐已经在服务器容器里跑着官方 Linux 微信，能用 xdotool 点界面、OCR、拿着 GitHub token。给它加一个每周任务：打开浮屿用户群 → 群二维码 → 截图 → 解出 `weixin.qq.com/g/...` 链接 → 重新生成干净的白底黑码 → 往仓库开 PR 并开自动合并。全程不用人。
3. **再差一档：到期前提醒人**。浮汐 / GitHub Actions 在 `expiresAt` 前一天私聊提醒，人把截图发给会话，会话按 [community.md](../features/community.md)「每周换微信群二维码」做。这就是现在的流程加个闹钟。

另外有两个**不管选哪条都绕不开**的限制：

- **群超过 200 人，扫码就进不了群**，只能群成员邀请（V2EX、GitHub issue 都有人碰到，微信官方帮助没找到原文，未核实具体数字是否仍是 200）。到那时方案 2 也失效，只能走方案 1，或者改放「加我拉你进群」的个人码（个人名片码不过期）配机器人拉人。
- **群开了「群聊邀请确认」**，非群主 / 管理员点开的群码扫了也要审批（未核实最新行为，上线前用手机试一次）。方案 2 里浮汐的账号最好是群管理员。

建议：先做方案 2（改动都在浮汐和本仓库的小地方，一两天能用上），同时盯着群人数，快到 200 时转方案 1。

## 详细

### 现在怎么换的

- README（中文 + 5 种外语版）引用 `docs/assets/readme/wechat-group.png`；应用设置 → 关于 → 帮助的「交流群」读 `main` 上的 `docs/assets/community/community.json` 和 `wechat-group.png`（D115，地址和格式是对外契约，见 [contracts.md](../architecture/contracts.md)）。
- 每周：用户截图 → 会话用 ffmpeg 按固定坐标裁码、反色 → 改 `expiresAt` / `updatedAt` → 提交 → land。最近一次是 `da7718c90`（有效到 12-02）。
- 应用侧已经做了兜底：过了 `expiresAt` 不显示码，改成「已过期，正在换新的」。README 没有兜底，过期码会一直挂着。

### 方案 1：企业微信「加入群聊」码

企业微信开发文档 [客户群「加入群聊」管理](https://developer.work.weixin.qq.com/document/path/92229)（页面 2026-11-09 更新）：

- `add_join_way` 生成配置，返回 `config_id`，`get_join_way` 取 `qr_code` 图片地址。
- `chat_id_list` 最多 5 个客户群；`auto_create_room` 默认 1，群满自动建新群，群名用 `room_base_name` + 递增序号 `room_base_id`，或用群模板。
- 自建应用要配进「客户联系 → 可调用接口的应用」；2023-12-01 起新企业不能再用客户联系的系统 secret 调。每个企业最多 50 万个「加入群聊」/「联系我」配置。
- 文档**没写**码的有效期、群人数上限、未认证企业限制。不用 API 也行：管理后台「客户联系 → 加客户 → 加入群聊」手工建一个码，效果一样。

第三方服务商的说法（非官方，各家有出入）：

- 「加入群聊」码不删就一直有效（[企微云](https://www.wescrm.com/helpcenter/417.html)、[搜狐 / 呼活](https://www.sohu.com/a/515225958_121207816)）。
- 客户群最多 500 人，但扫码只能进到 200 人；未认证企业扫码上限 200、可建客户群数量也有限（[CSDN](https://blog.csdn.net/lssbk/article/details/111519292)、[企微云](https://www.wescrm.com/helpcenter/718.html)）。

对浮屿的影响：

- 好处：README 和 `community.json` 放一次码就不用再动；人多了自动开 2 群、3 群；客户群天然支持个人微信用户进。
- 坏处：要有企业微信主体（个人可以注册未认证企业，但限制多）；群是企业微信群，群里显示「@企业名」后缀，部分功能（群机器人 webhook 等）在外部群不能用；**浮汐是个人微信号**，进客户群后能不能照常收消息、发图要实测；老群不能转换，只能在老群里发新码引导迁移。

### 方案 2：浮汐每周自动换码

浮汐（`../Fuxi`）已有的能力正好够：

| 需要 | 浮汐现状 |
|---|---|
| 一直在线的微信客户端 | 服务器 Docker 里的官方 Linux 微信 4.x（Xvfb，专用虚拟桌面，没人抢焦点） |
| 点开群、点按钮 | `sender` 用 xdotool + 剪贴板搜会话、OCR 核对聊天标题 |
| 知道哪个是浮屿用户群 | `groupwork.py` 已经在处理浮屿用户群的后台工作 |
| 写 GitHub | `community.py` 读 `FUXI_GITHUB_TOKEN` 调 GitHub API |

要加的流程（建议放浮汐仓库，单独一个 `qrcode` 任务，每天跑一次，离 `expiresAt` ≤ 2 天才真的换）：

1. 用现有搜索逻辑打开浮屿用户群 → 群聊信息 → 群二维码（菜单位置要在容器里的 Linux 微信 4.x 上量一次，OCR 找「群二维码」字样比写死坐标稳）。
2. 截图后**不裁图，直接解码**：OpenCV 的 `wechat_qrcode` 模块或 `zxing-cpp` 读出 `https://weixin.qq.com/g/...`；读不出或域名不对就停，不提交。
3. 用 `segno` / `qrcode` 从链接**重新生成** 480×480 白底黑码，写成 `wechat-group.png`；README 那张也可以改成同一张纯码（现在 README 图带群名标题，生成时用 Pillow 加一行字即可）。上线前用手机扫一次重新生成的码，确认微信认（未核实，按理链接相同就能进）。
4. 有效期：微信码页面写着「该二维码 7 天内（X 月 X 日前）有效」，OCR 读出日期，`expiresAt` 填前一天；读不出就按「今天 + 6 天」。
5. 链接没变（码还没刷新）就什么都不做。
6. 用 GitHub API 建分支 `community/wechat-qr-<日期>`，改 `docs/assets/community/community.json`、`docs/assets/community/wechat-group.png`、`docs/assets/readme/wechat-group.png`，开 PR 并开 auto-merge。

本仓库侧要配合的小改动：

- **main 规则集**：必须走 PR、必须过 `check`，且 strict（要和 main 同步）；仓库已开 `allow_auto_merge` 和合并后删分支，所以浮汐开 PR + auto-merge 就能自己合，不违反「main 不直推」。落后 main 时 `update-behind-prs.yml` 会帮着更新。
- **CI 会跑全量**：`scripts/land-check.mjs` 的 `docsOnly()` 只认 `.md`，这个 PR 带 png 和 json，会跑 Windows 前端 + Rust 全套，十几二十分钟才合。可以在 `docsOnly` 里把 `docs/assets/community/` 下的 json / 图片也算文档，再保留 `tests/unit/community-groups.test.mjs` 那几条检查（JSON 能读、图片在、日期格式对）放进 docs 分支跑。
- **token 权限**：浮汐现在的 token 只读 PR；要换成只授权 Fuyu 仓库 `contents: write` + `pull_requests: write` 的 fine-grained token。PR 由浮汐的 GitHub 账号开，提交信息按仓库规则写英文标题、不带 Claude 署名行。
- 失败通知：任一步失败，浮汐在文件传输助手里给主人发一条，退回人工流程。

风险：

- 微信更新界面后点击路径会变（浮汐发消息那套也有同样风险，已有 OCR 核对 + 熔断的做法可以照搬）。
- 浮汐账号不是群主、群开了邀请确认时，生成的码扫了要审批或直接不让进，见上面「绕不开的限制」。
- 自动操作个人号有被风控的可能；每周只开一次群码，频率远低于浮汐现在收发消息，风险增量很小。

### 方案 3：只提醒

最省事的版本，不用碰微信界面：GitHub Actions 定时读 `community.json`，`expiresAt` 前一天开个 issue 或通过浮汐的对外发送 API 私聊提醒。还是要人截图，只是不会忘。

### 不推荐的路

- **个人号 iPad / PC 协议框架**（WeChatPadPro 一类，有「获取群二维码」接口）：能直接拿到码，但是非官方协议，封号风险高，浮汐已经选了「官方客户端 + 界面自动化」这条更稳的路，没必要再接一套。
- **第三方「群活码」网站**：给一个固定码，扫了跳到它的页面再显示真实群码。还是要每周上传新码，只是把「改仓库」换成「改网站」，而且多一层跳转，微信里长按识别网页里的图体验也差。应用的 `community.json` 本身就是这个思路。
- **把码挪出 main**（单独分支 / 官网 fuyu.ing）：README 和应用都读 main，挪地方要改对外契约，收益只是少走一次 PR；方案 2 有 auto-merge 后这点不再是负担。

## 来源

- 企业微信开发文档：[客户群「加入群聊」管理](https://developer.work.weixin.qq.com/document/path/92229)
- [silenceper/wechat#631](https://www.github.com/silenceper/wechat/issues/631)（加入群聊接口的 SDK 讨论）
- [企微云：企业微信群二维码是永久有效的吗](https://www.wescrm.com/helpcenter/417.html)、[企微云：企业微信可添加的客户数量上限](https://www.wescrm.com/helpcenter/718.html)
- [搜狐 / 呼活：企业微信群二维码能加多少客户](https://www.sohu.com/a/515225958_121207816)
- [CSDN：企业微信正式开放 500 人外部客户群](https://blog.csdn.net/lssbk/article/details/111519292)
- [V2EX：群超过 200 人二维码失效](https://www.v2ex.com/t/821445)、[GitHub issue：群超过 200 人不能扫码](https://www.github.com/JDAI-CV/fast-reid/issues/354)
- 本仓库：[community.md](../features/community.md)、`.github/workflows/ci.yml`、`scripts/land-check.mjs`、main 规则集（`gh api repos/TixXin/fuyu/rulesets/26831958`，2026-11-25 查）
- 浮汐：`../Fuxi/README.md`、`bridge/fuxi_bridge/community.py`
