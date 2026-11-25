# 跨设备同步

浮屿支持在多台 Windows / macOS 设备之间同步常用数据与配置，无需官方云账号。可在 **设置 → 同步** 中启用并管理。同步契约与文件布局细则见 [contracts.md](../architecture/contracts.md)「跨设备同步引擎」，历史规划见 [cross-device-sync-plan.md](../architecture/history/cross-device-sync-plan.md)。

## 同步方式

- **共享文件夹**：选择一个本地同步文件夹（如 iCloud Drive、OneDrive、Dropbox、坚果云或 Syncthing 同步目录），每台设备只在 `fuyu-sync/devices/<deviceId>/` 下写入自己的状态文件，避免多机互相覆盖。
- **WebDAV**：填写兼容 WebDAV 的服务地址、用户名与密码（支持先测试连接），密码存入系统凭据管理器 / macOS 钥匙串（`com.tixxin.fuyu.sync` / `webdav-password`），不写入明文配置文件。

## 同步内容与合并规则

- **默认开启类别**：待办与每日笔记（`todos`）、常用短语（`snippets`）、链接书签（`links`）、通用设置（`settings`，按 `settings_whitelist.json` 筛选，剔除屏幕尺寸与本机快捷键等设备相关字段）、样式预设（`presets`）。
- **可选类别与分组**：剪贴板文字收藏（`clipFavorites`，默认关闭，且严格排除隐私、打码与密钥内容）；设置中还支持按可选组开关同步（翻译服务商、截图设置、Agent 音效/推送、邮箱账号不含密钥、岛屿布局、更新通道）。
- **市场插件名单**：已安装的第三方市场插件列表与非密钥配置（`fuyu-market-plugins`）随设置同步；在新设备上不会静默自动安装或改写配置，而是在插件页提示用户一键确认装回。
- **冲突与安全防线**：按条目以混合逻辑时钟（HLC）后写者赢，删除留 90 天墓碑；每日笔记双端并发修改时保留两端文本并用分隔线拼接；当远端触发大比例删除或远端被清空时，同步会暂停并要求用户在界面显式确认，防止误删扩散。

## 端到端加密（可选）

- 可为同步目录启用端到端加密：设置口令后生成随机 32 字节数据密钥，以 Argon2id 派生密钥并包裹数据密钥写入 `meta.json`，全部远端设备文件以 XChaCha20-Poly1305 加密。
- 同时生成 `FUYU-` 格式恢复密钥（支持一键复制不进剪贴板历史，或保存到下载目录），新设备输入口令或恢复密钥即可解锁；本地数据密钥保存在系统凭据管理器 / 钥匙串中。

## 实现位置

- Rust 同步引擎、WebDAV 客户端与加密模块：`src-tauri/src/sync/`。
- 前端设置页与状态接口：`src/features/sync/`。
