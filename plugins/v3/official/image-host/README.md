# 截图图床 · Image host

`@fuyu/image-host` · 浮屿官方插件 · Windows / macOS

把截图传到你自己的 S3 兼容存储（R2、S3、OSS、COS 或 MinIO），并复制链接。

## 装好后在哪里

- **截图卡片和截图历史**：多一个「上传图床」按钮。
- **设置 → 插件 → 截图图床**：服务地址、桶、密钥和链接格式。

这个插件不在岛上加页面和收起条。

## 怎么用

1. 在存储服务商那里建一个桶，再建一对只用来写这个桶的密钥（Access Key ID 和 Secret Access Key）。
2. 打开设置里的截图图床，填服务地址、桶和区域，把两把密钥粘进去，离开输入框就保存。
3. 点「上传一张测试图」，上面会显示测试图的链接，在浏览器里打开看看能不能看到。
4. 截完图，在截图卡片上点「上传图床」。传完链接已经在剪贴板里，卡片上显示「已上传，链接已复制」。

还没设好时点「上传图床」，会打开这个插件的设置。

### 各家怎么填

| 服务商 | 服务地址 | 区域 | 公开访问地址 |
|---|---|---|---|
| Cloudflare R2 | `https://<账号 ID>.r2.cloudflarestorage.com` | `auto` | 必填：桶的公开开发地址（`https://pub-….r2.dev`）或绑定的自己的域名 |
| Amazon S3 | `https://s3.<区域>.amazonaws.com` | 桶所在区域，如 `ap-northeast-1` | 桶允许公开读时可以留空，也可以填 CloudFront 的地址 |
| 阿里云 OSS | `https://oss-<地域>.aliyuncs.com` | 照 OSS 的「S3 兼容」说明填 | 桶是公共读时可以留空，也可以填绑定的域名 |
| 腾讯云 COS | `https://cos.<地域>.myqcloud.com` | 地域，如 `ap-guangzhou` | 桶是公有读时可以留空，也可以填绑定的域名 |
| 本机的 MinIO | `http://localhost:9000` | `us-east-1` | 可以留空 |

服务地址只能是上面这几家（和本机），这是插件在清单里声明的联网范围，填别的地址时上传会说「插件连不了这个服务地址」。

## 设置

**存储**

- **服务地址**：服务商给的 S3 接口地址，默认空。
- **桶**：默认空。
- **区域**：默认 `auto`（R2 用）。
- **桶名放在路径里，不放在域名里**：默认关。服务商要求路径式地址时打开；本机的 MinIO 总是用路径式。

**密钥**

- **Access Key ID**、**Secret Access Key**：粘进去、离开输入框就保存，存在 Windows 凭据管理器或 macOS 钥匙串里，不写进文件，设置页上只显示「已保存」。「删除密钥」把两把都删掉。

**链接**

- **桶里的文件夹**：默认 `fuyu/`。截图存成 `fuyu/2026/11/20261120-143000-a1b2c3.png`（年 / 月 / 日期-时间-随机后缀）。
- **公开访问地址**：默认空，空时用服务地址拼出链接，只有桶允许公开读才打得开。
- **复制**：链接（默认）或 Markdown（`![](链接)`）。

**试一下**

- **上传一张测试图**：传一张 1×1 的小图，名字固定是 `<文件夹>fuyu-image-host-test.png`，多试几次也只有这一个文件。

## 开销和数据来源

- 只在你点「上传图床」或「上传一张测试图」时联网，把这一张图用 S3 的签名方式（AWS Signature V4）`PUT` 到你填的桶里。不在后台定时做任何事。
- 联网范围（清单的 `fuyu.network`）：`*.r2.cloudflarestorage.com`、`*.amazonaws.com`、`*.aliyuncs.com`、`*.myqcloud.com`、`localhost`。
- 两把密钥经浮屿的 `secrets/v1` 存在系统凭据里，只有这个插件的宿主部分读得到，不进设置窗口、不写日志。在插件市场卸载时勾上「同时删除数据」会一起删掉；卸载浮屿时也会删掉。
- 其余设置和「上次上传的链接」存在本机的插件数据目录（`config.json`）里。
- 读截图文件；复制链接用浮屿的剪贴板服务，没有它时卡片上直接显示链接。

---

## English

`@fuyu/image-host` · Official Fuyu plugin · Windows / macOS

Uploads a screenshot to your own S3-compatible storage (R2, S3, OSS, COS or MinIO) and copies the link.

### Where it shows up

- **Screenshot cards and the screenshot history**: a new **Upload** button.
- **Settings → Plugins → Image host**: the endpoint, bucket, keys and link format.

It adds no island page and nothing to the collapsed bar.

### How to use it

1. At your storage provider, create a bucket and a key pair that can only write to it (an access key ID and a secret access key).
2. Open Image host in the settings, fill in the endpoint, bucket and region, and paste both keys. Each key is saved when you leave its box.
3. Click **Upload a test picture**. Its link shows at the top; open it in a browser to check that it loads.
4. After taking a screenshot, click **Upload** on the screenshot card. When it's done the link is on the clipboard and the card says "Uploaded. Link copied."

Clicking **Upload** before everything is set up opens this plugin's settings.

#### What to fill in

| Provider | Endpoint | Region | Public address |
|---|---|---|---|
| Cloudflare R2 | `https://<account ID>.r2.cloudflarestorage.com` | `auto` | Required: the bucket's public development address (`https://pub-….r2.dev`) or your own domain |
| Amazon S3 | `https://s3.<region>.amazonaws.com` | Your bucket's region, such as `ap-northeast-1` | Empty if the bucket allows public reads, or your CloudFront address |
| Alibaba Cloud OSS | `https://oss-<region>.aliyuncs.com` | As in OSS's S3 compatibility guide | Empty for a public-read bucket, or your bound domain |
| Tencent Cloud COS | `https://cos.<region>.myqcloud.com` | The region, such as `ap-guangzhou` | Empty for a public-read bucket, or your bound domain |
| MinIO on this computer | `http://localhost:9000` | `us-east-1` | Can be empty |

The endpoint must belong to one of these providers (or this computer): that is the network range the plugin declares in its manifest. With any other address the upload says "This plugin can't connect to that endpoint."

### Settings

**Storage**

- **Endpoint**: your provider's S3 API address. Empty by default.
- **Bucket**: empty by default.
- **Region**: `auto` by default (for R2).
- **Put the bucket in the path instead of the host name**: off by default. Turn it on if your provider asks for path-style addresses; MinIO on this computer always uses them.

**Access keys**

- **Access key ID**, **Secret access key**: paste them and leave the box to save. They are kept in Windows Credential Manager or the macOS Keychain, never in a file, and the settings only show "Saved". **Forget keys** removes both.

**Link**

- **Folder in the bucket**: `fuyu/` by default. A screenshot is stored as `fuyu/2026/11/20261120-143000-a1b2c3.png` (year / month / date-time-random suffix).
- **Public address**: empty by default. When empty, the link is built from the endpoint and only opens if the bucket allows public reads.
- **Copy**: the link (default) or Markdown (`![](link)`).

**Try it**

- **Upload a test picture**: uploads a 1×1 picture, always named `<folder>fuyu-image-host-test.png`, so trying again does not pile up files.

### Cost and data

- It only goes online when you click **Upload** or **Upload a test picture**, and then sends that one picture to your bucket with an S3-signed `PUT` (AWS Signature V4). Nothing runs in the background.
- Network range (`fuyu.network` in the manifest): `*.r2.cloudflarestorage.com`, `*.amazonaws.com`, `*.aliyuncs.com`, `*.myqcloud.com`, `localhost`.
- The two keys are stored through Fuyu's `secrets/v1` in the system credential store. Only this plugin's host part can read them; they never reach the settings window or a log. Uninstalling it from the plugin market with "Also delete its data" removes them, and so does uninstalling Fuyu.
- The other settings and the last uploaded link are kept in the plugin's data folder on this computer (`config.json`).
- It reads the screenshot file, and copies the link with Fuyu's clipboard service; without that service the card shows the link instead.
