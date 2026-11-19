# 交流群

设置 → 关于 → 帮助 最上面的「交流群」一组，列出用户群：微信群显示二维码，以后加 QQ 群、Discord、Telegram 也在这里。代码在 `src/features/updater/community/`，挂在更新模块的设置分区上（`about.community`）。

## 数据从哪来

二维码不打包进应用。微信群的码 7 天就过期，打包进去就要每周发版。应用打开帮助页时读本仓库 `main` 上的文件：

- `docs/assets/community/community.json`：群列表
- `docs/assets/community/<图片>`：二维码图片

读取顺序和应用更新、插件市场一样：先 GitHub 直连（`raw.githubusercontent.com`），连不上再换 `ghfast.top`、`gh-proxy.com` 前缀镜像，每个源等 6 秒。二维码图片先用读到列表的那个源，加载失败再换下一个。三个源都会缓存 1–5 分钟，合入 `main` 后几分钟内生效，**不用发版**。全部连不上时显示「重试」和「去网页看」（打开 GitHub 上的这个目录）。

这个地址、文件名和下面的格式已经被装好的应用在读，属于对外契约（见 [contracts.md](../architecture/contracts.md)），不要挪目录、不要改字段的含义。

## community.json 的格式

```json
{
  "version": 1,
  "updatedAt": "2026-11-19",
  "groups": [
    {
      "id": "wechat-users",
      "platform": "wechat",
      "name": { "zh-CN": "浮屿用户交流群", "en": "Fuyu users" },
      "qr": "wechat-group.png",
      "expiresAt": "2026-11-25"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `id` | 必填，唯一 |
| `platform` | `wechat` / `qq` / `discord` / `telegram` / `other`；旧应用不认识的平台显示成「其他」 |
| `name` | 必填，`{ "zh-CN", "en" }` 或一个字符串 |
| `note` | 可选，一行说明，写法同 `name` |
| `qr` | 可选，同目录下的图片文件名，只能用小写字母、数字和 `-`，扩展名 `png` / `jpg` / `jpeg` / `webp` |
| `expiresAt` | 可选，`YYYY-MM-DD`，**最后有效的那一天**（本地时间）。过了这天应用不显示二维码，改成「已过期，正在换新的」 |
| `number` | 可选，群号，旁边有「复制群号」 |
| `link` | 可选，加群链接，只认 `https://` |
| `locales` | 可选，`["zh-CN"]`、`["en"]`；不写就两种语言都显示 |

`qr`、`number`、`link` 至少要有一个，否则这一条不显示。`version` 不是 `1` 时整份不认，加新字段不用改版本号（旧应用忽略不认识的字段）。

## 每周换微信群二维码

微信截图上写的「X 月 Y 日前有效」，`expiresAt` 填 Y 的前一天。

1. 在微信里打开群二维码截图。用户把截图发给会话就行，会话来做下面几步。
2. 只裁出二维码，不带上面的群成员头像，转成白底黑码（截图是深色模式时要反色）。截图 966×1476 的深色版这样裁：

   ```bash
   ffmpeg -y -i <截图> -vf "crop=750:750:108:502,negate,format=gray,lut=c0='if(gt(val\,160)\,255\,if(lt(val\,90)\,0\,val))',scale=480:480:flags=neighbor" docs/assets/community/wechat-group.png
   ```

   尺寸不同就按截图调 `crop`（宽:高:左:上）；浅色截图去掉 `negate`。裁完打开看一眼，再确认能扫出来（macOS 上可以用 CoreImage 的 `CIDetector` 读出 `https://weixin.qq.com/g/...`）。
3. 改 `community.json` 的 `expiresAt` 和 `updatedAt`。
4. `pnpm test` 里的 `community-groups` 会检查这份 JSON 读得出、图片都在。
5. 提交这两个文件，再 `pnpm mq:land`：要合入 `main` 才生效。

群超过 200 人后微信不能再扫码进群，到时改用企业微信的群活码或「加我拉你进群」的个人码，换图片和名字就行，代码不用动。

## 加别的群

在 `groups` 里加一条。QQ 群写 `number` 和 `qm.qq.com` 的 `link`，可以再放二维码；Discord、Telegram 写 `link`，一般加 `"locales": ["en"]`。
