# Microsoft Store 商店版（D116）

浮屿在 Windows 上有两个渠道：官网和 GitHub 的 NSIS 安装包（自带更新），以及 Microsoft Store 的 MSIX 包（商店签名、商店更新）。两者是同一个 `fuyu.exe`，运行时按「是不是从 MSIX 包里启动的」（`Package.Current` 能不能拿到，`system/msix.rs` 的 `is_packaged()`）切换行为，不另出一个构建。做法参考 Snow Shot，调研见 [microsoft-store-msix.md](../research/microsoft-store-msix.md)。

## 商店版和安装版的差别

| 方面 | 安装版 | 商店版 |
|---|---|---|
| 签名 | 没签（SignPath 申请中，D114） | 提交不签名的 MSIX，由商店签名 |
| 更新 | 内置 updater 读 `latest.json` | `updater_configured` 返回 `false`，检查和下载在 Rust 里直接拒绝；关于页显示「由 Microsoft Store 更新」 |
| 开机自启 | 写 `HKCU\…\Run` 的 `Fuyu` | 清单里的 `windows.startupTask`（`TaskId="FuyuStartup"`，默认关）；`get/set_launch_at_startup` 改读写它。在任务管理器里被关掉、被策略禁用或强制开启时，设置里那一行显示原因（错误码 `startup.disabledByUser` / `startup.disabledByPolicy` / `startup.enabledByPolicy`） |
| 改名迁移（D17） | 跑 | 不跑：商店版没有旧安装 |
| 卸载清理 | NSIS 卸载时跑 `--uninstall-cleanup` | MSIX 卸载不能跑自定义程序，外部 AI 钩子留下；靠设置里的「移除钩子」和钩子命令的存在性守卫兜底 |
| 数据 | 家目录 `%USERPROFILE%\.fuyu` | 同一个家目录（MSIX 只重定向 AppData 和 HKCU，不碰家目录），所以 AI 代理钩子照常工作；家目录的锁让两个版本不能同时运行。WebView2 的数据（`localStorage`）和应用数据目录 `%APPDATA%\com.tixxin.fuyu` 在商店版里被重定向到 `%LOCALAPPDATA%\Packages\<包族名>\LocalCache\`，和安装版不是一份 |

## 清单

模板在 `src-tauri/msix/AppxManifest.xml.in`，中英文名称在 `src-tauri/msix/Strings/<语言>/Resources.resw`。要点：

- 完全信任的桌面应用：`runFullTrust`，`uap10:RuntimeBehavior="packagedClassicApp"`，`mediumIL`，最低 Windows 10 19041，只出 x64。
- 能力：`userNotificationListener`（QQ 和即时通讯来源读系统通知）、`graphicsCaptureProgrammatic` 和 `graphicsCaptureWithoutBorder`（截图、录屏不弹黄框）、`microphone`（语音输入、录屏收音）、`bluetooth`（蓝牙电量）。提交时 `runFullTrust` 要写用途说明。
- 扩展：开机自启任务、`.fuyu` 插件包的文件关联。

商店身份（包名、Publisher、发布者显示名、商店产品 ID）在 `src-tauri/msix/store-identity.json`，要在 Partner Center 保留名字后从「产品标识」页抄进来；一旦用了就不要再改，换身份等于换一个应用，自启设置和商店版的数据都会丢。

## 打包

```powershell
pnpm build:exe
pnpm msix
```

`pnpm msix` 读 `tauri.conf.json` 的版本（`0.3.12` → `0.3.12.0`，商店要求第四段是 0，测试版本默认拒绝），把 `fuyu.exe`、图标和名称资源放进 `src-tauri/target/msix/work/stage`，用 Windows SDK 的 MakePri 生成 `resources.pri`、MakeAppx 打成 `src-tauri/target/msix/<包名>_<版本>_x64.msix`，旁边写一份 `.sha256`。要装 Windows SDK（10.0.26100 或更新）。参数见 `pnpm msix --help`：

- `--test-identity`：身份还没填时用本地测试身份 `Fuyu.LocalTest` / `CN=FuyuLocalTest`。
- `--allow-prerelease`：允许测试版本号，只用于本地测试。
- `--test-cert <指纹>`：用当前用户证书库里的证书签一份，用于本地安装。

## 本地测试

商店提交用的包没签名，不能直接装。本地测试要自签一份：

```powershell
$cert = New-SelfSignedCertificate -Type Custom -Subject "CN=FuyuLocalTest" -CertStoreLocation Cert:\CurrentUser\My -KeyUsage DigitalSignature -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddDays(90) -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
```

```powershell
Export-Certificate -Cert $cert -FilePath .\FuyuLocalTest.cer
```

用管理员 PowerShell 把公钥导入「本地计算机 → 受信任的人」（这是整台机器的信任决定，测完删掉）：

```powershell
Import-Certificate -FilePath .\FuyuLocalTest.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople
```

回到普通 PowerShell 打包并安装（先退出正在运行的浮屿，两个版本共用家目录，后启动的会提示后退出）：

```powershell
pnpm msix --test-identity --allow-prerelease --test-cert $cert.Thumbprint
```

```powershell
Add-AppxPackage -Path .\src-tauri\target\msix\Fuyu.LocalTest_0.3.12.0_x64.msix
```

用完卸载：`Get-AppxPackage Fuyu.LocalTest | Remove-AppxPackage`，再从 `Cert:\LocalMachine\TrustedPeople` 删掉那张证书。

## 提交到商店（只有用户本人能做）

1. 注册 Partner Center 开发者账号，保留「浮屿」和「Fuyu - Island」两个名字（清单的 `DisplayName` 要和保留的名字一致，`Strings` 里的中英文名就是这两个；「Fuyu」已被别的应用占用，2026-11-20 保留了「Fuyu - Island」）。
2. 把「产品标识」页的包名、Publisher、发布者显示名、商店产品 ID 填进 `src-tauri/msix/store-identity.json` 并提交。
3. 准备中英文隐私政策（浮屿读剪贴板、系统通知、邮箱、AI 代理会话，要写清楚只在本机处理、哪些会联网），填年龄分级问卷，说明 `runFullTrust` 和 `userNotificationListener` 的用途。
4. `pnpm build:exe` 后 `pnpm msix`，在 Partner Center 上传 `.msix`。
