# 浮屿的 QQ 机器人插件

这里放围绕浮屿这个项目写的 QQ 机器人插件，不进入岛屿的发布产物。插件跑在自己部署的 [AstrBot](https://github.com/AstrBotDevs/AstrBot) 上，QQ 由 [NapCat](https://github.com/NapNeko/NapCatQQ) 接入（AstrBot 的 aiocqhttp 平台，OneBot 11）。

```text
bot/
└── astrbot/
    └── astrbot_plugin_fuyu_release/   # 发版后把分享图推到 QQ
```

## 约定

- `astrbot/` 下每个插件一个目录，目录名就是插件名（`metadata.yaml` 的 `name`），以 `astrbot_plugin_fuyu_` 开头。
- 和仓库其他代码一样不写注释；能脱离 AstrBot 测的逻辑放在不 import `astrbot` 的模块里，`tests/` 用标准库 `unittest` 测。
- 服务器地址、QQ 号、会话 ID 这类部署信息不进仓库，写在 AstrBot 的插件配置或本机环境变量里。

## 部署

1. 把插件目录复制到 AstrBot 数据目录的 `plugins/` 下（Docker 部署时是挂载出来的 `data/plugins/<插件名>/`）。
2. 重启 AstrBot，或在面板的插件页重载。第一次加载后，插件配置出现在面板里，也可以改 `data/config/<插件名>_config.json` 再重启。
3. 在 QQ 里给机器人发插件的管理员命令，看日志确认。

## 测试

```bash
cd bot/astrbot/astrbot_plugin_fuyu_release && python3 -m unittest discover -s tests
```

## astrbot_plugin_fuyu_release

`pnpm release` 发完一版后会画分享图（`pnpm release:share`，见 `docs/releases/README.md`「分享图」）。设了环境变量 `FUYU_BOT_INBOX` 时，发版机把中文图和一份说明文件用 `scp` 传进插件的收件箱，插件每 10 秒看一次，发现新的就私聊推出去，再把两个文件移到 `sent/`。

- 收件箱在 AstrBot 数据目录的 `plugin_data/astrbot_plugin_fuyu_release/inbox/`。发版机上设 `FUYU_BOT_INBOX=<ssh 主机>:<这个目录的绝对路径>/`，要能免密 `scp` 过去。
- 说明文件 `fuyu-v<版本号>.json`：`version`、`channel`（`beta` / `stable`）、`image`（同目录的图片文件名）、`url`（Release 页面）。图片要先于说明文件传完；两个文件都放了 3 秒以上才处理。
- 推给谁：默认私聊 AstrBot 配置里的每个管理员（`admins_id`，QQ 号，要先加机器人为好友）；配置项 `targets` 可以再加任何 AstrBot 接入的会话，会话 ID 在那个会话里发 `/sid` 查。只推微信时关掉「推送给管理员」，`targets` 只填微信那一条。都发不出去时重试，三次后移到 `failed/`。
- 微信个人号机器人（weixin_oc）：要你先给机器人发过消息，AstrBot 才存下能主动回发的凭据；机器人重新扫码登录后要再发一条。会话 ID 形如 `<机器人名>:FriendMessage:<用户>@im.wechat`。
- 发不到 QQ 的「我的手机」：那是同一账号设备之间的会话，OneBot 没有对应接口，所以由机器人账号私聊你。
- 管理员命令：`/浮屿分享图` 在当前会话重发最近推过的一张；`/浮屿推送状态` 看收件箱里还有几个、推给几个对象。
- 手动推一次：`pnpm release:share <版本号> --push`。
