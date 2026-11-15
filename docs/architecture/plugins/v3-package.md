# 插件平台第 3 版：清单和 `.fuyu` 安装包格式

> 状态：实验（第 5 阶段转正前还可能微调，转正后只增不改）。实现在 `packages/plugin-manifest`（`@fuyu/plugin-manifest`），任务 E36.5.1（#480）。字段的用途和取舍见方案 [v3-everything-plugin.md](v3-everything-plugin.md)「插件包」，这里只写格式和规则。

浮屿专有的名字都能配置，基座公开改名时只改默认值：

| 名字 | 默认 | 配置项 |
|---|---|---|
| 清单里应用的键名，也是 `engines` 里的键 | `fuyu` | `validateManifest` 的 `appKey` |
| 官方作用域 | `fuyu`（`@fuyu/*`） | `officialScope` |
| 包的命名空间：后缀、签名文件名、摘要和签名的域前缀 | `fuyu` | 包函数的 `namespace` |
| 包的后缀 | `.<namespace>`，即 `.fuyu` | `extension` |
| 包内签名文件 | `<namespace>-signature.json`，即 `fuyu-signature.json` | `signatureFile` |

## 清单

清单就是插件的 `package.json`，应用的字段放在 `fuyu` 下。校验：

```js
import { validateManifest } from "@fuyu/plugin-manifest";
const { ok, errors, warnings, manifest, app } = validateManifest(pkg, options);
```

- `errors`、`warnings` 都是 `{ path, code, message }`，`path` 形如 `fuyu.client.island`、`engines.fuyu`。有错误时 `ok` 为 `false`，`manifest`、`app` 为 `null`。
- 选项：`appKey`、`officialScope`；`official`（默认 `false`，只有内置和官方插件传 `true`，才收 `@fuyu/*`）；`stage`（`"built"` 默认，`"source"` 表示作者仓库里的源码清单）；`appVersion`（传了就核对 `engines.fuyu`）；`allowExperimental`（默认 `true`，市场和手动安装的来源传 `false`）；`categories`（市场分类表，默认见下）。
- 校验只看清单本身，不看包里的文件是否存在；包里的文件由下面的包函数检查。
- JSON Schema：`manifestSchema({ appKey, categories })` 生成（draft 2020-12），给编辑器补全用。名字和仓库所有者、semver 范围这类 Schema 表达不了的规则只在 `validateManifest` 里。

### npm 的标准字段

| 字段 | 规则 | 错误码 |
|---|---|---|
| `name` | 必填。小写字母、数字、`-`、`.`、`_`、`~`，最长 214 个字符；必须带作用域 | `required`、`name`、`name-unscoped` |
| 作用域 | 第三方插件的作用域必须是 `repository` 的所有者（GitHub 用户或组织），大小写不敏感：`@someone/x` 配 `github:SomeOne/x`；`@fuyu/*` 留给官方（`official: true` 才收，不核对仓库所有者）；作用域内的名字可以带 `fuyu` | `name-owner`、`name-reserved` |
| `version` | 必填，semver（`1.2.0`、`1.2.0-beta.1`），不带 `v` | `semver` |
| `type` | 必填，固定 `"module"` | `module` |
| `license` | 必填，SPDX 标识；`UNLICENSED` 不收（必须开源） | `required`、`license` |
| `repository` | 必填。认 `owner/repo`、`github:` / `gitlab:` / `bitbucket:` 简写、`https://`、`git+https://`、`git+ssh://`、`git@host:owner/repo.git`，或 `{ "url": … }` | `required`、`repository` |
| `engines.fuyu` | 必填，npm 的 semver 范围（`^`、`~`、`>=`、`1.x`、`a - b`、`\|\|`）；预发布版只匹配写了同一版本预发布的范围 | `required`、`range`、`engine` |
| `description`、`homepage`、`keywords`、`files` | 可选，类型要对 | `type` |

其余 npm 认识的字段（`scripts`、`dependencies`、`exports`……）直接放过；npm 也不认识的顶层字段给告警 `unknown`。

### `fuyu` 下的字段

| 字段 | 规则 | 错误码 |
|---|---|---|
| `manifest` | 必填，现在是 `1` | `manifest` |
| `displayName`、`description` | 必填，`{ 语言: 文本 }`，必须有 `zh-CN` 和 `en` | `required`、`localized` |
| `icon` | 必填，包内相对路径，`.png` 或 `.svg` | `required`、`path` |
| `categories` | 必填，至少一个，取自 `productivity`、`todos`、`developer`、`media`、`messages`、`information`、`utilities` | `required`、`type` |
| `screenshots` | 可选，最多 6 张，`{ path, caption? }`，图片是 `.png` / `.jpg` / `.jpeg` / `.webp` | `too-many`、`path` |
| `preview` | 可选，布尔 | `type` |
| `platforms` | 可选，取自 `windows`、`macos`、`linux` | `type` |
| `host` | 可选，`.js` / `.mjs` 入口 | `path` |
| `client` | 可选，`{ 窗口名: 入口 }` | `path` |
| `inject` | 可选，`{ required?, optional? }`，都是服务名列表 | `type` |
| `requires` | 可选，`{ "@作用域/名字": semver 范围 }` | `name`、`range` |
| `provides`、`replaces`、`slots`、`experimental` | 可选，非空字符串列表；重复的给告警 `duplicate` | `type` |
| `commands` | 可选，`{ id, title, keybinding? }`，`id` 不能重复，`title` 按语言写 | `required`、`duplicate` |
| `network` | 可选，小写域名，允许 `*.` 前缀和 `localhost`；不写协议和端口 | `type` |
| `config` | 可选，`.json` 文件 | `path` |
| `experimental` | 有内容且 `allowExperimental: false` 时报错：实验接口只在开发模式和内置插件里用 | `experimental` |
| `nodeApis`、`builtWith` | 打包时写入。`stage: "source"` 时出现就给告警 `generated`（会被构建覆盖）；`builtWith` 必须是版本号 | `semver` |

- 路径（`icon`、`host`、`client.*`、`config`、截图）一律是包内的相对路径：用 `/`，不以 `/` 或盘符开头，没有空段、`.`、`..`，不含 `\`。
- `fuyu` 下和嵌套对象（`inject`、命令、截图）里不认识的字段给告警 `unknown`，不报错：以后加字段只会是新增可选字段。

## `.fuyu` 包

文件名 `<作用域>-<名字>-<版本>.fuyu`（`packageFileName`，例如 `someone-fuyu-weather-1.2.0.fuyu`），内容是 zip。包内结构见方案「发布包是什么文件」：顶层必须有 `package.json`，其余是 `dist/`、`assets/`、README、CHANGELOG、LICENSE，可选的签名文件也在顶层。

### 写（`packFiles`、`packDirectory`）

确定性：同样的文件内容永远打出逐字节相同的包。

- 路径按 UTF-8 字节排序；每个条目都用 deflate（级别 9），时间戳固定为 1980-01-01 00:00，文件权限固定 `0644`，名字标成 UTF-8，不写目录条目和额外字段。
- 文本文件（`.js .mjs .cjs .json .css .html .htm .md .txt .svg .map .yml .yaml .xml .csv`）是合法 UTF-8 时把 `\r\n` 和单独的 `\r` 统一成 `\n`；不是合法 UTF-8 的按二进制原样放。
- `packDirectory(dir)` 把整个文件夹打进去（挑选文件是 `fuyu-plugin build` 的事），遇到符号链接或特殊文件就失败。

### 拒绝的东西（写和读都查）

| 规则 | 错误码 |
|---|---|
| 绝对路径、盘符、`\`、空段、`.`、`..`、控制字符 | `path` |
| 任何一级目录叫 `node_modules`（大小写不敏感） | `node-modules` |
| `.node` 原生扩展 | `native` |
| 可执行程序和编译过的代码（和 `.node` 一样没法从源码审核，审核分析器 `@fuyu/plugin-review` 也判红）：按文件头认 PE（开头 `MZ`）、ELF、Mach-O（含 fat）、Java class（`CAFEBABE` 后面是 45 以上的类文件版本号，否则按 fat Mach-O 算）、WebAssembly（`\0asm`）、jar（zip 里有 `META-INF/MANIFEST.MF` 或 `.class` 条目）；按扩展名认 `.exe .dll .sys .scr .com .msi .so .dylib .bin .elf .app .appimage .deb .rpm .pkg .dmg .wasm .jar .class` | `executable` |
| 同一路径出现两次（按 NFC 和大小写折叠后比较，防止在不区分大小写的文件系统上互相覆盖） | `duplicate` |
| 顶层没有 `package.json`，或它不是 JSON | `manifest` |
| 包超过 20 MB（`maxPackageBytes`） | `too-large` |
| 解压后超过 100 MB（`maxUnpackedBytes`）或超过 5000 个文件（`maxFiles`） | `too-large`、`too-many-files` |

读包（`readPackage`）另外查：

| 规则 | 错误码 |
|---|---|
| 符号链接（zip 里 Unix 权限位是 `S_IFLNK`）、设备文件这类非普通文件 | `symlink`、`special` |
| 加密条目、zip64、分卷、除 stored / deflate 以外的压缩方式、目录或本地头损坏 | `zip` |
| 防 zip 炸弹：先按中央目录声明的大小累计，超限就停；解压时把输出限制在声明的大小，实际更大就失败；解压后核对大小和 CRC-32 | `too-large`、`zip` |
| 文件名不是 UTF-8 | `path` |

出错时抛 `PackageError`（`code`、`path`）。`readPackage` 返回 `{ files, manifest, digest, signatures }`：`files` 不含签名文件，`manifest` 是解析后的 `package.json`（还要另外调 `validateManifest`），`signatures` 是签名文件的内容（没有时为 `null`，未校验）。

## 包的摘要

```text
sha256(
  "fuyu-package-digest/1\n" +
  对每个文件，按路径的 UTF-8 字节排序："<该文件内容的 SHA-256 小写十六进制> <路径>\n"
)
```

- 结果是小写十六进制。签名文件不计入，所以签名、加签不改变摘要。
- 摘要只认路径和内容，不认 zip 的压缩方式和时间戳；文本统一 LF 发生在算摘要之前。
- 路径里不允许换行等控制字符，所以每行的边界是确定的。域前缀里的 `fuyu` 跟着 `namespace` 变。

## 签名

包内签名文件 `fuyu-signature.json`：

```json
{
  "format": 1,
  "name": "@someone/fuyu-weather",
  "version": "1.2.0",
  "digest": "<包的摘要>",
  "signatures": [
    { "role": "author", "keyId": "<16 位十六进制>", "signature": "<base64>" },
    { "role": "market", "keyId": "<16 位十六进制>", "signature": "<base64>" }
  ]
}
```

- `role` 只有两种：`author`（作者签，手动安装时显示「谁签的」并固定密钥）和 `market`（市场构建后签）。同一角色可以有几把密钥（换密钥过渡期）；同一角色、同一密钥再签一次会替换旧的那条。条目按角色、再按 `keyId` 排序。
- 签的文本（UTF-8），每个字段一行：

  ```text
  fuyu-package-signature/1
  <role>
  <name>
  <version>
  <digest>
  ```

  有域前缀和角色，所以作者签名不能冒充市场签名，也不能拿去当第 2 版的包签名（`focusd-plugin-package/1`）或市场索引、提交号签名用。
- 算法 Ed25519（`node:crypto`）。密钥格式沿用第 2 版：公钥是 32 字节原始公钥的 base64，`keyId` 是原始公钥 SHA-256 的前 16 位十六进制；第 2 版作者的密钥文件可以直接用来签。
- 签名文件里的 `name`、`version`、`digest` 必须和包对得上，对不上整份签名都不算（`verifyPackage` 的 `problems` 写明原因）。

函数：

| 函数 | 作用 |
|---|---|
| `signPackage(zip, role, privateKey)` | 读包、算摘要、加上或替换这一条签名，重新打包（摘要不变） |
| `verifyPackage(zip, { author, market })` | 用各角色的可信公钥列表校验，返回 `{ manifest, digest, files, author, market, signed, problems }`，`author` / `market` 是验过的 `keyId` 或 `null` |
| `signDigest`、`verifyDigestSignature`、`signatureText` | 只对摘要签和验，市场 CI 的签名任务用：它只拿到构建任务给的摘要，不碰包 |
| `generateSigningKey`、`publicKeyOf`、`keyIdOf` | 生成密钥、从私钥（`KeyObject` 或 PEM）算公钥和 `keyId` |

信任哪把密钥不由包决定：作者公钥来自市场的提交文件并在首次安装时固定，市场公钥编进浮屿。作者给提交号签的名（`fuyu-plugin-commit/1`，见方案的细则）属于市场提交，不在包里，由 E36.5.2 / E36.5.4 定。

## 不在这个包里的

- 挑选哪些文件进包（`files` 字段、默认带上的 README 等）、扫描 `nodeApis`、写 `builtWith`：`fuyu-plugin build` / `pack`（E36.5.4）。
- 市场索引、撤销名单、冷静期：`@fuyu/plugin-market`（E36.5.2）。
- 安装到哪、文件关联、安装确认：E36.5.8。
