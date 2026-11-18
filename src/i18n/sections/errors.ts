import { isMacOS } from "../../lib/platform.ts";

export type ErrorArgs = Record<string, string | number>;
type Wording = string | ((args: ErrorArgs) => string);

export type ErrorCode =
  | "internal"
  | "updater.busy"
  | "updater.targetChanged"
  | "platform.unsupported"
  | "credential.open"
  | "credential.read"
  | "credential.save"
  | "credential.delete"
  | "credential.staleApp"
  | "file.read"
  | "file.write"
  | "file.create"
  | "file.backup"
  | "updateBackup.failed"
  | "updateBackup.badSnapshot"
  | "updateBackup.corrupt"
  | "updateBackup.notFound"
  | "file.undo"
  | "http.client"
  | "net.proxy"
  | "net.unreachable"
  | "net.unreadable"
  | "net.status"
  | "net.said"
  | "net.tooLarge"
  | "download.unreachable"
  | "download.timeout"
  | "download.checksum"
  | "download.failed"
  | "inflink.releaseUnreachable"
  | "inflink.releaseTimeout"
  | "inflink.noBetterNcm"
  | "inflink.write"
  | "bark.server"
  | "recording.busy"
  | "recording.idle"
  | "recording.failed"
  | "bark.scheme"
  | "bark.key"
  | "bark.noKey"
  | "bark.unreachable"
  | "bark.unknownKey"
  | "bark.status"
  | "ccConnect.token"
  | "ccConnect.noTokenCheck"
  | "ccConnect.telegramToken"
  | "ccConnect.telegramBusy"
  | "ccConnect.discordToken"
  | "ccConnect.discordId"
  | "ccConnect.projectName"
  | "ccConnect.projectTaken"
  | "ccConnect.workDir"
  | "ccConnect.workDirCreate"
  | "ccConnect.platform"
  | "ccConnect.allowFrom"
  | "ccConnect.feishuRunning"
  | "ccConnect.feishuUnfinished"
  | "ccConnect.tag"
  | "ccConnect.asset"
  | "ccConnect.checksumMissing"
  | "ccConnect.checksum"
  | "ccConnect.arch"
  | "ccConnect.zip"
  | "ccConnect.zipEmpty"
  | "ccConnect.zipLarge"
  | "ccConnect.unpack"
  | "ccConnect.notAt"
  | "ccConnect.notFound"
  | "ccConnect.notFoundRun"
  | "ccConnect.notDownloaded"
  | "ccConnect.notReady"
  | "ccConnect.chat"
  | "ccConnect.emptyPush"
  | "ccConnect.run"
  | "ccConnect.agent"
  | "ccConnect.host"
  | "ccConnect.remoteNotFound"
  | "ccConnect.remoteFailed"
  | "ccConnect.remoteSystem"
  | "ccConnect.remoteInstall"
  | "ccConnect.remoteFeishu"
  | "ccConnect.remoteChanged"
  | "ccConnect.remoteWrite"
  | "ccConnect.remoteNoConfig"
  | "ccConnect.remoteStopped"
  | "ccConnect.stdin"
  | "ccConnect.timeout"
  | "ccConnect.failed"
  | "ccConnect.exited"
  | "ccConnect.lost"
  | "clipboard.read"
  | "clipboard.open"
  | "clipboard.notLink"
  | "clipboard.noLinks"
  | "clipboard.linkMissing"
  | "shortcut.invalid"
  | "shortcut.notReady"
  | "shortcut.busy"
  | "coexist.devOnly"
  | "coexist.save"
  | "shortcut.update"
  | "shortcut.timeout"
  | "shortcut.taken"
  | "calendar.save"
  | "calendar.link"
  | "calendar.linkScheme"
  | "calendar.unreachable"
  | "calendar.login"
  | "calendar.status"
  | "calendar.read"
  | "calendar.tooLarge"
  | "calendar.address"
  | "calendar.https"
  | "calendar.notCalendar"
  | "calendar.noCalendars"
  | "home.envSet"
  | "home.notAbsolute"
  | "home.inUse"
  | "home.copy"
  | "calendar.linkExpired"
  | "calendar.notIcs"
  | "calendar.corrupt"
  | "calendar.secretMissing"
  | "calendar.tooMany"
  | "calendar.needLink"
  | "calendar.needPassword"
  | "calendar.needAccount"
  | "translation.provider"
  | "translation.noAddress"
  | "translation.url"
  | "translation.urlEmpty"
  | "translation.urlLong"
  | "translation.urlFull"
  | "translation.urlCredentials"
  | "translation.urlScheme"
  | "pluginsV3.builtinUnknown"
  | "pluginsV3.builtinEssential"
  | "pluginsV3.builtinSave"
  | "pluginsV3.builtinConfigKey"
  | "pluginsV3.builtinConfigValue"
  | "pluginsV3.builtinConfigSave"
  | "pluginsV3.invalidDismissTarget"
  | "pluginsV3.migrationSave"
  | "translation.urlQuery"
  | "translation.modelLong"
  | "translation.noModel"
  | "translation.noResult"
  | "translation.cutOff"
  | "translation.unfinished"
  | "translation.copy"
  | "translation.key"
  | "translation.empty"
  | "translation.tooLong"
  | "translation.direction"
  | "translation.noKey"
  | "translation.status"
  | "planUsage.key"
  | "editorExtension.unknown"
  | "editorExtension.noCli"
  | "editorExtension.failed"
  | "mail.address"
  | "mail.attachmentDecode"
  | "mail.attachmentDownload"
  | "mail.attachmentGone"
  | "mail.attachmentLarge"
  | "mail.attachmentParse"
  | "mail.badId"
  | "mail.badPart"
  | "mail.bodyDecode"
  | "mail.bodyFormat"
  | "mail.bodyLarge"
  | "mail.bodyLoad"
  | "mail.bodyLong"
  | "mail.bodyOver"
  | "mail.bodyParse"
  | "mail.bodyPartial"
  | "mail.build"
  | "mail.cancelled"
  | "mail.changedOpen"
  | "mail.changedRefresh"
  | "mail.codeMissing"
  | "mail.connect"
  | "mail.connectAndEnable"
  | "mail.connectThis"
  | "mail.connectUnfinished"
  | "mail.crashedRetrying"
  | "mail.crashedStopped"
  | "mail.disconnect"
  | "mail.disconnectCredential"
  | "mail.disconnectPartly"
  | "mail.headers"
  | "mail.imapRefused"
  | "mail.imapServer"
  | "mail.inbox"
  | "mail.inboxChanged"
  | "mail.inboxChangedOpen"
  | "mail.markRead"
  | "mail.markReadLater"
  | "mail.needCode"
  | "mail.needRecipient"
  | "mail.noAttachment"
  | "mail.noDownloads"
  | "mail.noSender"
  | "mail.noText"
  | "mail.off"
  | "mail.notRecent"
  | "mail.read"
  | "mail.readCode"
  | "mail.readLater"
  | "mail.recipient"
  | "mail.removed"
  | "mail.saveAttachment"
  | "mail.saveCode"
  | "mail.sendFailed"
  | "mail.sendUnfinished"
  | "mail.serviceDown"
  | "mail.smtpRefused"
  | "mail.start"
  | "mail.stopped"
  | "mail.structure"
  | "mail.subject"
  | "mail.sync"
  | "mail.tls"
  | "mail.tooMany"
  | "mail.tooManyNames"
  | "mail.tooManyRecipients"
  | "mail.unavailable"
  | "mail.update"
  | "voiceInput.noDataDir"
  | "voiceInput.deleteFailed"
  | "voiceInput.downloadBusy"
  | "voiceInput.downloadCancelled"
  | "voiceInput.downloadFailed"
  | "voiceInput.unpackFailed"
  | "voiceInput.modelBroken"
  | "voiceInput.micFailed"
  | "voiceInput.micDenied"
  | "voiceInput.noModel"
  | "file.noDownloads"
  | "clipboard.notExport"
  | "clipboard.newerExport"
  | "clipboard.importTooLarge"
  | "settingsBackup.badName"
  | "settingsBackup.badContent"
  | "settingsBackup.tooManyNames"
  | "notificationVerify.badId"
  | "notificationVerify.unisolated"
  | "notificationVerify.start"
  | "messenger.notInteractive"
  | "messenger.foreground"
  | "remoteHosts.save"
  | "remoteHosts.host"
  | "remoteHosts.tooMany"
  | "remoteHosts.address"
  | "remoteHosts.name"
  | "remoteHosts.user"
  | "remoteHosts.port"
  | "remoteHosts.tooManyCustom"
  | "remoteHosts.unknown"
  | "sshTunnel.notReady"
  | "sshTunnel.start"
  | "sshTunnel.needPort"
  | "sshTunnel.remotePort"
  | "sshTunnel.tooMany"
  | "sshTunnel.save"
  | "sshTunnel.noPortTool"
  | "sshTunnel.portCheck"
  | "soundPack.noDataDir"
  | "soundPack.format"
  | "soundPack.sizeOrEmpty"
  | "soundPack.empty"
  | "soundPack.writeSound"
  | "soundPack.save"
  | "soundPack.fromPlugin"
  | "soundPack.badId"
  | "soundPack.notFound"
  | "soundPack.delete"
  | "soundPack.pluginGone"
  | "soundPack.openFolder"
  | "soundPack.fileMissing"
  | "soundPack.readSound"
  | "soundPack.tooLarge"
  | "toast.init"
  | "toast.unavailable"
  | "toast.checkAccess"
  | "toast.read"
  | "qq.notReady"
  | "qq.unavailable"
  | "qq.requestAccessStart"
  | "qq.requestAccess"
  | "qq.accessFailed"
  | "qq.openSettings"
  | "qq.openApp"
  | "qq.notInstalled"
  | "qq.findWindow"
  | "qq.noMainWindow"
  | "qq.notRunning"
  | "qq.noTrayEntry"
  | "qq.multipleTrays"
  | "qq.trayTimeout"
  | "qq.multipleTrayIcons"
  | "qq.trayNotReady"
  | "qq.trayNoResponse"
  | "qq.restoreFailed"
  | "qq.disabledForApp"
  | "qq.disabledForUser"
  | "qq.disabledByPolicy"
  | "qq.unsupportedInstall"
  | "qq.channelNotReady"
  | "qq.repairToolMissing"
  | "qq.repairStart"
  | "qq.repairUnfinished"
  | "qq.repairFailed"
  | "qq.repairStopped"
  | "wechat.notReady"
  | "wechat.unavailable"
  | "wechat.notInstalled"
  | "wechat.verifyPath"
  | "wechat.notRunning"
  | "wechat.findWindow"
  | "wechat.noMainWindow"
  | "wechat.openProtocol"
  | "wechat.restoreFailed"
  | "wechat.openApp"
  | "wechat.exposeWaiting"
  | "wechat.exposeExternal"
  | "wechat.exposeOn"
  | "wechat.exposeNoDll"
  | "wechat.exposeOpenProcess"
  | "wechat.exposeReadDll"
  | "wechat.exposeNoSwitch"
  | "wechat.exposeStillHidden"
  | "shellAttention.alreadyRunning"
  | "shellAttention.registerEvent"
  | "shellAttention.createReceiver"
  | "shellAttention.listen"
  | "shellAttention.startThread"
  | "shellAttention.startTimeout";

export type ErrorsText = {
  withDetail: (text: string, detail: string) => string;
  codes: Record<ErrorCode, Wording>;
};

export const zhCN: ErrorsText = {
  withDetail: (text, detail) => `${text.replace(/[。.]$/, "")}：${detail}`,
  codes: {
    internal: "岛屿内部出错。",
    "updater.busy": "正在检查、下载或安装更新，请稍后再试。",
    "updater.targetChanged": "可用的更新版本已变化，请确认新版本后再安装。",
    "platform.unsupported": "这个平台暂不支持该功能。",
    "credential.open": isMacOS ? "无法访问钥匙串。" : "无法访问 Windows 凭据管理器。",
    "credential.read": isMacOS ? "无法从钥匙串读取。" : "无法从 Windows 凭据管理器读取。",
    "credential.save": isMacOS ? "无法保存到钥匙串。" : "无法保存到 Windows 凭据管理器。",
    "credential.delete": isMacOS ? "无法从钥匙串删除。" : "无法从 Windows 凭据管理器删除。",
    "credential.staleApp": "浮屿已经更新，请退出后重新打开。",
    "file.read": ({ path }) => `读不了 ${path}。`,
    "file.write": ({ path }) => `无法写入 ${path}。`,
    "file.create": ({ path }) => `无法创建 ${path}。`,
    "file.backup": ({ path }) => `无法备份 ${path}。`,
    "updateBackup.failed": "安装前没能备份数据，这次没有安装。",
    "updateBackup.badSnapshot": "页面交来的设置数据不完整，没能备份，这次没有安装。",
    "updateBackup.corrupt": ({ path }) => `这份备份已损坏（${path} 对不上），不能恢复。`,
    "updateBackup.notFound": "这份备份已经不在了。",
    "file.undo": ({ path }) => `无法撤回 ${path}。`,
    "http.client": "无法建立网络连接。",
    "net.proxy": "代理地址无效，检查 HTTPS_PROXY 环境变量或系统代理设置。",
    "net.unreachable": ({ service }) => `连不上 ${service}。`,
    "net.unreadable": ({ service }) => `${service} 的回答读不懂。`,
    "net.status": ({ service, status }) => `${service} 返回 ${status}。`,
    "net.said": ({ service }) => `${service} 返回了错误。`,
    "net.tooLarge": ({ service }) => `${service} 的内容太大，已放弃。`,
    "download.unreachable": ({ what, tried }) => `连不上 ${what} 的下载地址（试过 ${tried}）。`,
    "download.timeout": ({ what, tried }) => `下载 ${what} 超时（试过 ${tried}）。`,
    "download.checksum": ({ what, tried }) => `下载的 ${what} 没通过校验，没有使用（试过 ${tried}）。`,
    "download.failed": ({ what, tried }) => `下载 ${what} 失败（试过 ${tried}）。`,
    "inflink.releaseUnreachable": "连不上 GitHub（api.github.com），查不到 InfLink-rs 的最新版本。",
    "inflink.releaseTimeout": "向 GitHub（api.github.com）查询 InfLink-rs 的最新版本超时。",
    "inflink.noBetterNcm": "没找到 BetterNCM。先装 BetterNCM 并打开一次网易云，再试。",
    "inflink.write": "没能把 InfLink-rs 放进 BetterNCM 的插件文件夹。",
    "bark.server": "Bark 服务器地址无效。",
    "recording.busy": "已经在录屏了。",
    "recording.idle": "现在没有在录屏。",
    "recording.failed": "录屏失败。",
    "bark.scheme": "Bark 服务器地址要以 https:// 或 http:// 开头。",
    "bark.key": "这不像 Bark 的设备 Key：在 Bark 里复制推送地址或其中那串字母数字。",
    "bark.noKey": "还没有填 Bark 设备 Key。",
    "bark.unreachable": "连不上 Bark 服务器。",
    "bark.unknownKey": "Bark 不认这个设备 Key，请重新复制。",
    "bark.status": ({ status }) => `Bark 返回 ${status}。`,
    "ccConnect.token": "机器人 token 不对。",
    "ccConnect.noTokenCheck": ({ platform }) => `${platform} 不用检查 token。`,
    "ccConnect.telegramToken": "Telegram 不认这个 token，请从 BotFather 重新复制。",
    "ccConnect.telegramBusy": "这个机器人正被别的程序（多半是 cc-connect）收消息，先停掉它再识别。",
    "ccConnect.discordToken": "Discord 不认这个 token，请在开发者门户的 Bot 页重新生成并复制。",
    "ccConnect.discordId": "Discord 没给出机器人的 id。",
    "ccConnect.projectName": "项目名只能用字母、数字、- 和 _，最多 64 个字符。",
    "ccConnect.projectTaken": ({ name }) => `cc-connect 已经有叫 ${name} 的项目了，换个名字。`,
    "ccConnect.workDir": ({ path }) => `工作文件夹不存在：${path}`,
    "ccConnect.workDirCreate": ({ path }) => `没能建出工作文件夹：${path}`,
    "ccConnect.platform": ({ platform }) => `不支持的平台：${platform}`,
    "ccConnect.allowFrom": "请填写你自己的用户 ID（多个用英文逗号隔开），不然谁找到机器人都能用这台电脑。",
    "ccConnect.feishuRunning": "飞书扫码已经在进行了。",
    "ccConnect.feishuUnfinished": "飞书扫码没有完成。",
    "ccConnect.tag": ({ tag }) => `cc-connect 的版本号不对：${tag}`,
    "ccConnect.asset": ({ tag, name }) => `cc-connect ${tag} 没有发布 ${name}。`,
    "ccConnect.checksumMissing": ({ name }) => `checksums.txt 里没有 ${name}。`,
    "ccConnect.checksum": "下载的 cc-connect 和发布的校验值对不上，已丢弃。",
    "ccConnect.arch": ({ arch }) => `cc-connect 没有 ${arch} 版的程序。`,
    "ccConnect.zip": "cc-connect 的压缩包读不了。",
    "ccConnect.zipEmpty": "cc-connect 的压缩包里没有程序。",
    "ccConnect.zipLarge": "cc-connect 的程序大得不正常，已放弃。",
    "ccConnect.unpack": "解压 cc-connect 失败。",
    "ccConnect.notAt": ({ path }) => `找不到 cc-connect 程序：${path}`,
    "ccConnect.notFound": "找不到 cc-connect 程序，请在插件里填写它的路径。",
    "ccConnect.notFoundRun": "找不到 cc-connect 程序，请先下载或填写路径。",
    "ccConnect.notDownloaded": "找不到 cc-connect 程序，请先下载。",
    "ccConnect.notReady": "cc-connect 还没准备好。",
    "ccConnect.chat": "cc-connect 项目或聊天无效。",
    "ccConnect.emptyPush": "推送内容是空的。",
    "ccConnect.run": "无法运行 cc-connect。",
    "ccConnect.agent": ({ agent }) => `不支持的 Agent：${agent}`,
    "ccConnect.host": ({ host }) => `「${host}」不是 SSH 主机名。`,
    "ccConnect.remoteNotFound": ({ host }) => `${host} 上找不到 cc-connect 程序，请在 cc-connect 插件里选这台电脑、填写它的路径。`,
    "ccConnect.remoteFailed": ({ host }) => `没能经 SSH 用上 ${host} 的 cc-connect。`,
    "ccConnect.remoteSystem": ({ system }) => `cc-connect 没有给 ${system} 的程序。`,
    "ccConnect.remoteInstall": ({ host }) => `没能在 ${host} 上装好 cc-connect。`,
    "ccConnect.remoteFeishu": "另一台电脑上的飞书机器人要扫码建。",
    "ccConnect.remoteChanged": ({ host }) => `${host} 上的 cc-connect 配置刚被改过，请再试一次。`,
    "ccConnect.remoteWrite": ({ host }) => `没能写好 ${host} 上的 cc-connect 配置，已经还原。`,
    "ccConnect.remoteNoConfig": ({ host }) => `${host} 上的 cc-connect 还没有项目。`,
    "ccConnect.remoteStopped": ({ host }) => `${host} 上的 cc-connect 刚启动就停了。`,
    "ccConnect.stdin": "无法把内容交给 cc-connect。",
    "ccConnect.timeout": "cc-connect 10 秒没有回应。",
    "ccConnect.failed": "cc-connect 出错。",
    "ccConnect.exited": "cc-connect 退出了。",
    "ccConnect.lost": "和 cc-connect 失去了联系。",
    "clipboard.read": "无法读取剪贴板。",
    "clipboard.open": "无法打开剪贴板。",
    "clipboard.notLink": "这不是网址。",
    "clipboard.noLinks": "这个文件里没有找到网址。",
    "clipboard.linkMissing": "找不到这个书签。",
    "shortcut.invalid": "快捷键无效，请使用至少一个修饰键。",
    "shortcut.notReady": "快捷键服务尚未准备好。",
    "shortcut.busy": "快捷键正在更新。",
    "coexist.devOnly": "只有开发版有这个切换。",
    "coexist.save": "没能保存这个选择。",
    "shortcut.update": "无法更新快捷键。",
    "shortcut.timeout": "快捷键更新超时。",
    "shortcut.taken": ({ shortcut }) => `快捷键 ${shortcut} 已被占用或无法注册。`,
    "calendar.save": "无法保存日历设置。",
    "calendar.link": "订阅链接无效。",
    "calendar.linkScheme": "订阅链接要以 https:// 或 webcal:// 开头。",
    "calendar.unreachable": "连不上日历。",
    "calendar.login": "日历账号或密码不对。",
    "calendar.status": ({ status }) => `日历返回 ${status}。`,
    "calendar.read": "读取日历失败。",
    "calendar.tooLarge": "日历文件太大。",
    "calendar.address": "日历地址无效。",
    "calendar.https": "日历地址要以 https:// 开头。",
    "calendar.notCalendar": "这个地址不是日历，也找不到账号下的日历。",
    "calendar.noCalendars": "找不到账号下的日历。",
    "home.envSet": ({ home }) => `家目录由环境变量 FUYU_HOME 指定（${home}），在这里改不了；要改请先去掉这个环境变量。`,
    "home.notAbsolute": "请填一个完整的文件夹路径，例如 D:\\Fuyu。",
    "home.inUse": ({ computer }) => `这个文件夹正在被电脑「${computer}」上的浮屿使用，先在那台电脑上退出浮屿。`,
    "home.copy": ({ path }) => `没能把数据复制到 ${path}。`,
    "calendar.linkExpired": "订阅链接已失效，或没有权限。",
    "calendar.notIcs": "这个链接不是日历（iCalendar）。",
    "calendar.corrupt": "日历内容损坏。",
    "calendar.secretMissing": "找不到保存的密码或订阅链接，请删掉这个日历再加一次。",
    "calendar.tooMany": ({ max }) => `最多添加 ${max} 个日历。`,
    "calendar.needLink": "请填写订阅链接。",
    "calendar.needPassword": "请填写密码。",
    "calendar.needAccount": "请填写账号。",
    "translation.provider": ({ service }) => `不支持的翻译服务：${service}`,
    "translation.noAddress": ({ service }) => `请先在翻译设置中填写${service}的地址。`,
    "translation.url": "接口地址无效。",
    "translation.urlEmpty": "请填写自定义接口地址。",
    "translation.urlLong": "接口地址过长。",
    "translation.urlFull": "接口地址无效，请填写完整的 https:// 地址。",
    "translation.urlCredentials": "接口地址中不能包含用户名或密码，密钥请填在密钥栏。",
    "translation.urlScheme": "接口地址必须使用 https（本机地址可用 http）。",
    "pluginsV3.builtinUnknown": ({ id }) => `没有叫 ${id} 的内置插件。`,
    "pluginsV3.builtinEssential": ({ id }) => `${id} 是浮屿必需的，不能关掉。`,
    "pluginsV3.builtinSave": ({ id }) => `没能保存 ${id} 的开关。`,
    "pluginsV3.builtinConfigKey": ({ id, key }) => `${key} 不能用作 ${id} 的设置名。`,
    "pluginsV3.builtinConfigValue": ({ id, key }) => `${id} 的设置 ${key} 只能是开关、数字或文字。`,
    "pluginsV3.builtinConfigSave": ({ id }) => `没能保存 ${id} 的设置。`,
    "pluginsV3.invalidDismissTarget": "未知的插件迁移提示目标。",
    "pluginsV3.migrationSave": "没能保存旧版插件迁移状态。",
    "translation.urlQuery": "接口地址不能带查询参数。",
    "translation.modelLong": "模型名称过长。",
    "translation.noModel": ({ service }) => `请先在翻译设置中填写${service}的模型名称。`,
    "translation.noResult": ({ service }) => `${service} 未返回译文。`,
    "translation.cutOff": ({ service }) => `${service} 未完成翻译，请重试或缩短文本。`,
    "translation.unfinished": ({ service }) => `${service} 未完成翻译。`,
    "translation.copy": "无法复制译文。",
    "translation.key": "请输入有效的 API 密钥。",
    "translation.empty": "请输入要翻译的内容。",
    "translation.tooLong": ({ max }) => `单次最多翻译 ${max} 个字符。`,
    "translation.direction": "不支持的翻译方向。",
    "translation.noKey": ({ service }) => `请先配置${service}的 API 密钥。`,
    "translation.status": ({ service, status }) => `${service} 返回 HTTP ${status}，请检查密钥、模型名称或额度。`,
    "planUsage.key": "API Key 格式不对。",
    "editorExtension.unknown": "不支持这个编辑器。",
    "editorExtension.noCli": ({ editor }) => `找不到 ${editor} 的命令行，打开 ${editor} 后再试一次。`,
    "editorExtension.failed": "扩展没有装上。",
    "mail.address": "请输入有效的邮箱地址。",
    "mail.attachmentDecode": "无法解码附件，请在网页中下载。",
    "mail.attachmentDownload": "无法下载附件，请检查网络并重试。",
    "mail.attachmentGone": "附件已移除，请刷新收件箱。",
    "mail.attachmentLarge": ({ mb }) => `附件超过 ${mb} MB，请在网页中下载。`,
    "mail.attachmentParse": "无法解析附件，请在网页中下载。",
    "mail.badId": "邮件标识无效，请刷新收件箱。",
    "mail.badPart": "附件标识无效，请重新打开邮件。",
    "mail.bodyDecode": "无法解码邮件正文，请在网页中查看。",
    "mail.bodyFormat": "邮件正文格式不匹配，请在网页中查看。",
    "mail.bodyLarge": "邮件正文过大，请在网页中查看。",
    "mail.bodyLoad": "无法加载邮件正文，请检查网络并重试。",
    "mail.bodyLong": "正文太长，请在网页中发送。",
    "mail.bodyOver": "邮件正文超过 512 KB，请在网页中查看。",
    "mail.bodyParse": "无法解析邮件正文，请在网页中查看。",
    "mail.bodyPartial": "邮件正文未完整加载，请重试。",
    "mail.build": "无法生成邮件。",
    "mail.cancelled": "邮箱连接已取消。",
    "mail.changedOpen": "邮箱连接已改变，请重新打开邮件。",
    "mail.changedRefresh": "邮箱连接已改变，请刷新收件箱。",
    "mail.codeMissing": "未找到保存的邮箱授权码，请重新连接。",
    "mail.connect": "请先连接邮箱。",
    "mail.connectAndEnable": "请先连接并开启邮箱接收。",
    "mail.connectThis": "请先连接这个邮箱。",
    "mail.connectUnfinished": "邮箱连接任务未完成。",
    "mail.crashedRetrying": "邮箱后台连接意外中断，正在重新连接。",
    "mail.crashedStopped": "邮箱后台连接多次意外中断，已停止重试。请在设置里重新授权或暂停后再接收，也可以重启岛屿。",
    "mail.disconnect": "无法断开邮箱。",
    "mail.disconnectCredential": "删除邮箱凭据失败，请重试断开。",
    "mail.disconnectPartly": "已停止接收，但删除 Windows 邮箱凭据失败，请重试断开。",
    "mail.headers": "无法读取邮件头。",
    "mail.imapRefused": "邮箱拒绝了连接，请确认已开启 IMAP，并重新输入邮箱授权码。",
    "mail.imapServer": "IMAP 服务器地址无效：填写域名，需要时加端口，例如 imap.example.com 或 imap.example.com:9993。",
    "mail.inbox": "无法打开收件箱，请稍后重试。",
    "mail.inboxChanged": "收件箱已更新，请刷新列表后重试。",
    "mail.inboxChangedOpen": "收件箱已更新，请刷新列表后重新打开邮件。",
    "mail.markRead": "无法把邮件标为已读。",
    "mail.markReadLater": "无法把邮件标为已读，请稍后重试。",
    "mail.needCode": "请输入邮箱设置中生成的授权码。",
    "mail.needRecipient": "请填写收件人。",
    "mail.noAttachment": "找不到这个附件，请重新打开邮件。",
    "mail.noDownloads": "找不到下载文件夹。",
    "mail.noSender": "找不到这封邮件的发件人。",
    "mail.noText": "这封邮件没有可读取的文字正文，请在网页中查看。",
    "mail.off": "邮箱已关闭：在插件页打开「消息」，再在它的设置里打开邮箱。",
    "mail.notRecent": "邮件已不在最近列表中，请刷新收件箱。",
    "mail.read": "无法读取邮件。",
    "mail.readCode": "无法读取 Windows 邮箱凭据，请重新连接。",
    "mail.readLater": "无法读取邮件，请稍后重试。",
    "mail.recipient": ({ address }) => `收件人地址无效：${address}`,
    "mail.removed": "邮件已移除，请刷新收件箱。",
    "mail.saveAttachment": "无法保存附件。",
    "mail.saveCode": "无法保存到 Windows 凭据管理器，请重试连接。",
    "mail.sendFailed": "发送失败，请检查网络后重试。",
    "mail.sendUnfinished": "发送任务未完成。",
    "mail.serviceDown": "邮箱服务不可用。",
    "mail.smtpRefused": "发件服务器拒绝了登录或邮件，请确认已开启 SMTP 服务、授权码正确，以及收件人地址。",
    "mail.start": "无法启动邮箱服务。",
    "mail.stopped": "邮箱后台连接已停止，请在设置里重新授权，或暂停后再接收。",
    "mail.structure": "无法读取邮件结构，请稍后重试。",
    "mail.subject": "主题太长或包含换行。",
    "mail.sync": "无法同步邮箱，请检查网络或稍后重试。",
    "mail.tls": "无法建立加密连接。",
    "mail.tooMany": ({ max }) => `最多同时连接 ${max} 个邮箱，请先断开一个。`,
    "mail.tooManyNames": "下载文件夹里同名文件太多，请清理后重试。",
    "mail.tooManyRecipients": ({ max }) => `一封邮件最多 ${max} 个收件人。`,
    "mail.unavailable": "邮件已移除或暂不可用，请刷新收件箱。",
    "mail.update": "无法更新邮箱连接。",
    "voiceInput.noDataDir": "找不到岛屿的数据文件夹。",
    "voiceInput.deleteFailed": "删不掉语音模型。",
    "voiceInput.downloadBusy": "语音模型正在下载。",
    "voiceInput.downloadCancelled": "已取消下载。",
    "voiceInput.downloadFailed": "语音模型下载失败，GitHub 和国内镜像都没连上；检查网络后再试。",
    "voiceInput.unpackFailed": "语音模型解压失败；删掉后重新下载。",
    "voiceInput.modelBroken": "语音模型加载失败；删掉后重新下载。",
    "voiceInput.micFailed": "用不了麦克风；检查有没有接麦克风，以及系统隐私设置里是否允许浮屿使用麦克风。",
    "voiceInput.micDenied": "浮屿没有麦克风权限；在系统设置 → 隐私与安全性 → 麦克风里打开。",
    "voiceInput.noModel": "先在设置 → 语音输入里下载语音模型。",
    "file.noDownloads": "找不到下载文件夹。",
    "clipboard.notExport": "这不是岛屿导出的剪贴板文件。",
    "clipboard.newerExport": "这不是岛屿导出的剪贴板文件，或者来自更新的版本。",
    "clipboard.importTooLarge": "剪贴板文件太大。",
    "settingsBackup.badName": "备份文件名无效。",
    "settingsBackup.badContent": "这不是有效的设置或主题备份。",
    "settingsBackup.tooManyNames": ({ name, dir }) => `${dir} 里叫 ${name} 的文件太多，请清理后重试。`,
    "notificationVerify.badId": "通知验收必须提供独立的 32 位十六进制运行标识。",
    "notificationVerify.unisolated": "通知验收未隔离应用数据目录。",
    "notificationVerify.start": "无法启动通知验收记录。",
    "messenger.notInteractive": ({ name }) => `${name}尚未恢复可交互的主窗口，请从系统托盘打开。`,
    "messenger.foreground": ({ name }) => `已找到${name}窗口，但未能切换到前台，请点击任务栏或托盘中的${name}。`,
    "remoteHosts.save": "没能保存远程电脑设置。",
    "remoteHosts.host": ({ host }) => `「${host}」不是 SSH 主机名。`,
    "remoteHosts.tooMany": ({ max }) => `最多选择 ${max} 台电脑。`,
    "remoteHosts.address": ({ host }) => `「${host}」不是有效的主机名或地址。`,
    "remoteHosts.name": ({ name }) => `「${name}」不能用作显示名：只能用字母、数字、. _ - 或 @。`,
    "remoteHosts.user": ({ user }) => `「${user}」不是有效的用户名。`,
    "remoteHosts.port": "端口要是 1–65535。",
    "remoteHosts.tooManyCustom": ({ max }) => `最多添加 ${max} 台电脑。`,
    "remoteHosts.unknown": ({ host }) => `找不到 SSH 电脑「${host}」。`,
    "sshTunnel.notReady": "SSH 代理隧道尚未准备好。",
    "sshTunnel.start": ({ host }) => `无法启动到 ${host} 的隧道。`,
    "sshTunnel.needPort": ({ host }) => `先填 ${host} 上的服务器端口。`,
    "sshTunnel.remotePort": ({ min }) => `服务器上的端口要是 ${min}–65535。`,
    "sshTunnel.tooMany": ({ max }) => `最多设置 ${max} 台主机。`,
    "sshTunnel.save": "没能保存 SSH 隧道设置。",
    "sshTunnel.noPortTool": "服务器上既没有 ss 也没有 netstat。",
    "sshTunnel.portCheck": "检查服务器端口失败。",
    "soundPack.noDataDir": "找不到应用数据目录。",
    "soundPack.format": ({ name }) => `不支持的音效格式：${name}`,
    "soundPack.sizeOrEmpty": ({ name }) => `音效文件太大或是空的：${name}（最大 4 MB）`,
    "soundPack.empty": "这个文件夹里没有能用的音效。",
    "soundPack.writeSound": ({ name }) => `无法写入音效 ${name}。`,
    "soundPack.save": "无法保存音效包。",
    "soundPack.fromPlugin": "这个音效包来自插件，请在插件页关闭或卸载它。",
    "soundPack.badId": "音效包 id 无效。",
    "soundPack.notFound": "找不到这个音效包。",
    "soundPack.delete": "无法删除音效包。",
    "soundPack.pluginGone": "找不到这个音效包，插件可能已关闭或卸载。",
    "soundPack.openFolder": "无法打开文件夹。",
    "soundPack.fileMissing": "音效包里没有这个文件。",
    "soundPack.readSound": ({ name }) => `无法读取音效 ${name}。`,
    "soundPack.tooLarge": ({ name }) => `音效文件太大：${name}（最大 4 MB）`,
    "toast.init": "无法初始化 Windows 通知。",
    "toast.unavailable": "Windows 通知监听不可用。",
    "toast.checkAccess": "无法检查通知权限。",
    "toast.read": "无法读取 Windows 通知。",
    "qq.notReady": "QQ 通知服务尚未就绪。",
    "qq.unavailable": "QQ 通知状态不可用。",
    "qq.requestAccessStart": "无法发起通知授权。",
    "qq.requestAccess": "无法请求 Windows 通知权限。",
    "qq.accessFailed": "Windows 通知授权失败。",
    "qq.openSettings": isMacOS ? "无法打开系统辅助功能设置。" : "无法打开 Windows 通知设置。",
    "qq.openApp": "无法打开 QQ。",
    "qq.notInstalled": "未找到 QQ 安装路径。请先打开 QQ，再试一次。",
    "qq.findWindow": "无法查找已运行的 QQ 窗口。",
    "qq.noMainWindow": "QQ 已在运行，但未找到可用的主窗口，请从系统托盘打开 QQ。",
    "qq.notRunning": "未找到正在运行的 QQ 窗口，请先打开并登录桌面版 QQ。",
    "qq.noTrayEntry": "未找到 QQ 的托盘唤回入口，请双击系统托盘中的 QQ 图标。",
    "qq.multipleTrays": "QQ 有多个托盘入口，无法确认主入口，请从系统托盘打开 QQ。",
    "qq.trayTimeout": "查询 QQ 托盘图标超时，请从系统托盘打开 QQ。",
    "qq.multipleTrayIcons": "QQ 有多个托盘图标，无法确认主入口，请双击系统托盘中的 QQ 图标。",
    "qq.trayNotReady": "QQ 托盘图标尚未就绪，请从系统托盘打开 QQ。",
    "qq.trayNoResponse": "QQ 没有响应托盘唤回请求，请从系统托盘打开。",
    "qq.restoreFailed": "QQ 未能恢复可交互的主窗口，请双击系统托盘中的 QQ 图标。",
    "qq.disabledForApp": "QQ 的 Windows 通知已关闭，请在系统通知设置中开启。",
    "qq.disabledForUser": "Windows 系统通知已关闭，请在系统通知设置中开启。",
    "qq.disabledByPolicy": "管理员策略禁止了 Windows 通知，请联系管理员。",
    "qq.unsupportedInstall": "QQ 当前安装方式不支持系统通知，请检查或更新 QQ。",
    "qq.channelNotReady": "QQ 通知通道尚未就绪，请确认已安装 QQ；可关闭后重新开启接收以重试。",
    "qq.repairToolMissing": "无法定位 Windows 通知修复工具。",
    "qq.repairStart": "无法启动 QQ 通知自动修复。",
    "qq.repairUnfinished": "QQ 通知自动修复未完成，请确认 QQ 安装正常；可关闭后重新开启接收以重试。",
    "qq.repairFailed": "QQ 通知自动修复失败。",
    "qq.repairStopped": "QQ 通知自动修复已停止或超时，可关闭后重新开启接收以重试。",
    "wechat.notReady": "微信提醒服务尚未就绪。",
    "wechat.unavailable": "微信提醒状态不可用。",
    "wechat.notInstalled": "未找到微信安装路径。打开微信后会自动连接。",
    "wechat.verifyPath": "无法确认微信安装路径。",
    "wechat.notRunning": "未找到正在运行的微信窗口，请先打开并登录桌面版微信。",
    "wechat.findWindow": "无法查找已运行的微信窗口。",
    "wechat.noMainWindow": "微信已在运行，但未定位到主窗口，请先从系统托盘打开并登录微信。",
    "wechat.openProtocol": "无法通过微信注册入口唤回客户端，请从系统托盘打开微信。",
    "wechat.restoreFailed": "微信未能恢复原来的主窗口，请双击系统托盘中的微信图标。",
    "wechat.openApp": "无法打开微信。",
    "wechat.exposeWaiting": "没找到微信主窗口，微信启动后会自动公开。",
    "wechat.exposeExternal": "微信界面已被别的程序（例如读屏软件）公开。",
    "wechat.exposeOn": "已公开微信界面。微信关在托盘里时读不到会话列表，最小化可以。",
    "wechat.exposeNoDll": "没能公开微信界面：微信进程里没有 Weixin.dll（不是 4.x 版？）",
    "wechat.exposeOpenProcess": "没能公开微信界面：打不开微信进程（微信以管理员身份运行时，岛也要以管理员身份运行）",
    "wechat.exposeReadDll": "没能公开微信界面：读不到 Weixin.dll。",
    "wechat.exposeNoSwitch": "没能公开微信界面：这个版本的微信里没找到辅助功能开关",
    "wechat.exposeStillHidden": "没能公开微信界面：改了开关，微信的界面仍然没有公开",
    "shellAttention.alreadyRunning": "任务栏提醒监听器已在此线程运行。",
    "shellAttention.registerEvent": "无法注册任务栏提醒事件。",
    "shellAttention.createReceiver": "无法创建任务栏提醒接收器。",
    "shellAttention.listen": "无法监听任务栏提醒。",
    "shellAttention.startThread": "无法启动任务栏提醒监听线程。",
    "shellAttention.startTimeout": "任务栏提醒监听线程启动超时。",
  },
};

export const en: ErrorsText = {
  withDetail: (text, detail) => `${text.replace(/\.$/, "")}: ${detail}`,
  codes: {
    internal: "Something went wrong inside the island.",
    "updater.busy": "An update is being checked, downloaded or installed; try again in a moment.",
    "updater.targetChanged": "The available update changed; look at the new version before installing.",
    "platform.unsupported": "Not available on this platform yet.",
    "credential.open": isMacOS ? "Could not open the keychain." : "Could not open Windows Credential Manager.",
    "credential.read": isMacOS ? "Could not read from the keychain." : "Could not read from Windows Credential Manager.",
    "credential.save": isMacOS ? "Could not save to the keychain." : "Could not save to Windows Credential Manager.",
    "credential.delete": isMacOS ? "Could not delete from the keychain." : "Could not delete from Windows Credential Manager.",
    "credential.staleApp": "Fuyu has been updated; quit it and open it again.",
    "file.read": ({ path }) => `Could not read ${path}.`,
    "file.write": ({ path }) => `Could not write ${path}.`,
    "file.create": ({ path }) => `Could not create ${path}.`,
    "file.backup": ({ path }) => `Could not back up ${path}.`,
    "updateBackup.failed": "Could not back up your data before installing, so the update was not installed.",
    "updateBackup.badSnapshot": "The settings from the page were incomplete, so nothing was backed up and the update was not installed.",
    "updateBackup.corrupt": ({ path }) => `This backup is damaged (${path} doesn't match) and can't be restored.`,
    "updateBackup.notFound": "This backup no longer exists.",
    "file.undo": ({ path }) => `Could not undo ${path}.`,
    "http.client": "Could not set up the connection.",
    "net.proxy": "The proxy address is not valid. Check the HTTPS_PROXY variable or the system proxy setting.",
    "net.unreachable": ({ service }) => `Could not reach ${service}.`,
    "net.unreadable": ({ service }) => `Could not read ${service}'s answer.`,
    "net.status": ({ service, status }) => `${service} answered ${status}.`,
    "net.said": ({ service }) => `${service} answered with an error.`,
    "net.tooLarge": ({ service }) => `${service} sent more than expected; gave up.`,
    "download.unreachable": ({ what, tried }) => `Could not reach any download source for ${what} (tried ${tried}).`,
    "download.timeout": ({ what, tried }) => `Downloading ${what} timed out (tried ${tried}).`,
    "download.checksum": ({ what, tried }) => `The downloaded ${what} failed verification and was not used (tried ${tried}).`,
    "download.failed": ({ what, tried }) => `Downloading ${what} failed (tried ${tried}).`,
    "inflink.releaseUnreachable": "Could not reach GitHub (api.github.com) to look up the latest InfLink-rs.",
    "inflink.releaseTimeout": "Looking up the latest InfLink-rs on GitHub (api.github.com) timed out.",
    "inflink.noBetterNcm": "BetterNCM was not found. Install it, open NetEase Cloud Music once, then try again.",
    "inflink.write": "Could not put InfLink-rs into BetterNCM's plugins folder.",
    "bark.server": "The Bark server address is not valid.",
    "recording.busy": "A recording is already running.",
    "recording.idle": "Nothing is being recorded.",
    "recording.failed": "The recording failed.",
    "bark.scheme": "The Bark server address must start with https:// or http://.",
    "bark.key": "That does not look like a Bark device key: copy the push URL in Bark, or the letters and digits in it.",
    "bark.noKey": "No Bark device key yet.",
    "bark.unreachable": "Could not reach the Bark server.",
    "bark.unknownKey": "Bark does not know this device key; copy it again.",
    "bark.status": ({ status }) => `Bark answered ${status}.`,
    "ccConnect.token": "That bot token does not look right.",
    "ccConnect.noTokenCheck": ({ platform }) => `${platform} has no token to check.`,
    "ccConnect.telegramToken": "Telegram does not know this token; copy it again from BotFather.",
    "ccConnect.telegramBusy": "Another program (most likely cc-connect) is receiving this bot's messages; stop it, then look again.",
    "ccConnect.discordToken": "Discord does not know this token; reset and copy it on the Bot page of the Developer Portal.",
    "ccConnect.discordId": "Discord did not give the bot's id.",
    "ccConnect.projectName": "A project name takes letters, digits, - and _, up to 64 characters.",
    "ccConnect.projectTaken": ({ name }) => `cc-connect already has a project called ${name}; pick another name.`,
    "ccConnect.workDir": ({ path }) => `The work folder does not exist: ${path}`,
    "ccConnect.workDirCreate": ({ path }) => `The work folder could not be made: ${path}`,
    "ccConnect.platform": ({ platform }) => `Unsupported platform: ${platform}`,
    "ccConnect.allowFrom": "Fill in your own user ID (several separated by commas), or anyone who finds the bot can use this computer.",
    "ccConnect.feishuRunning": "A Feishu QR setup is already running.",
    "ccConnect.feishuUnfinished": "The Feishu QR setup did not finish.",
    "ccConnect.tag": ({ tag }) => `cc-connect's version tag is not valid: ${tag}`,
    "ccConnect.asset": ({ tag, name }) => `cc-connect ${tag} has no ${name}.`,
    "ccConnect.checksumMissing": ({ name }) => `checksums.txt does not list ${name}.`,
    "ccConnect.checksum": "The downloaded cc-connect does not match the release's checksum; it was thrown away.",
    "ccConnect.arch": ({ arch }) => `cc-connect has no build for ${arch}.`,
    "ccConnect.zip": "Could not read the cc-connect package.",
    "ccConnect.zipEmpty": "The cc-connect package has no program in it.",
    "ccConnect.zipLarge": "The cc-connect program is unusually large; gave up.",
    "ccConnect.unpack": "Could not unpack cc-connect.",
    "ccConnect.notAt": ({ path }) => `cc-connect is not at ${path}`,
    "ccConnect.notFound": "cc-connect was not found; fill in its path in the plugin's settings.",
    "ccConnect.notFoundRun": "cc-connect was not found; download it or fill in its path first.",
    "ccConnect.notDownloaded": "cc-connect was not found; download it first.",
    "ccConnect.notReady": "cc-connect is not ready yet.",
    "ccConnect.chat": "The cc-connect project or chat is not valid.",
    "ccConnect.emptyPush": "The push has no text.",
    "ccConnect.run": "Could not run cc-connect.",
    "ccConnect.agent": ({ agent }) => `Unsupported agent: ${agent}`,
    "ccConnect.host": ({ host }) => `"${host}" is not an SSH host name.`,
    "ccConnect.remoteNotFound": ({ host }) => `cc-connect was not found on ${host}; pick that computer on the cc-connect plugin page and fill in its path.`,
    "ccConnect.remoteFailed": ({ host }) => `cc-connect on ${host} could not be used over SSH.`,
    "ccConnect.remoteSystem": ({ system }) => `cc-connect has no build for ${system}.`,
    "ccConnect.remoteInstall": ({ host }) => `cc-connect could not be installed on ${host}.`,
    "ccConnect.remoteFeishu": "A Feishu bot on another computer is set up by scanning its code.",
    "ccConnect.remoteChanged": ({ host }) => `cc-connect's settings on ${host} changed meanwhile; try again.`,
    "ccConnect.remoteWrite": ({ host }) => `cc-connect's settings on ${host} could not be written; they were put back.`,
    "ccConnect.remoteNoConfig": ({ host }) => `cc-connect on ${host} has no projects yet.`,
    "ccConnect.remoteStopped": ({ host }) => `cc-connect on ${host} stopped right after starting.`,
    "ccConnect.stdin": "Could not hand the text to cc-connect.",
    "ccConnect.timeout": "cc-connect did not answer within 10 seconds.",
    "ccConnect.failed": "cc-connect failed.",
    "ccConnect.exited": "cc-connect stopped.",
    "ccConnect.lost": "Lost track of cc-connect.",
    "clipboard.read": "Could not read the clipboard.",
    "clipboard.open": "Could not open the clipboard.",
    "clipboard.notLink": "This is not a web address.",
    "clipboard.noLinks": "No web addresses were found in this file.",
    "clipboard.linkMissing": "This bookmark was not found.",
    "shortcut.invalid": "That shortcut is not valid; use at least one modifier key.",
    "shortcut.notReady": "The shortcut service is not ready yet.",
    "shortcut.busy": "The shortcut is being changed already.",
    "coexist.devOnly": "Only a development build has this switch.",
    "coexist.save": "Could not save the choice.",
    "shortcut.update": "Could not change the shortcut.",
    "shortcut.timeout": "Changing the shortcut took too long.",
    "shortcut.taken": ({ shortcut }) => `The shortcut ${shortcut} is taken or cannot be registered.`,
    "calendar.save": "Could not save the calendar settings.",
    "calendar.link": "The subscription link is not valid.",
    "calendar.linkScheme": "The subscription link must start with https:// or webcal://.",
    "calendar.unreachable": "Could not reach the calendar.",
    "calendar.login": "The calendar account or password is wrong.",
    "calendar.status": ({ status }) => `The calendar answered ${status}.`,
    "calendar.read": "Could not read the calendar.",
    "calendar.tooLarge": "The calendar is too large.",
    "calendar.address": "The calendar address is not valid.",
    "calendar.https": "The calendar address must start with https://.",
    "calendar.notCalendar": "This address is not a calendar, and no calendars were found for the account.",
    "calendar.noCalendars": "No calendars were found for the account.",
    "home.envSet": ({ home }) => `The home folder is set by the FUYU_HOME environment variable (${home}) and cannot be changed here; remove the variable first.`,
    "home.notAbsolute": "Enter a full folder path, such as D:\\Fuyu.",
    "home.inUse": ({ computer }) => `Fuyu on "${computer}" is using this folder. Quit Fuyu there first.`,
    "home.copy": ({ path }) => `Could not copy the data to ${path}.`,
    "calendar.linkExpired": "The subscription link has expired, or does not allow access.",
    "calendar.notIcs": "This link is not a calendar (iCalendar).",
    "calendar.corrupt": "The calendar is damaged.",
    "calendar.secretMissing": "The saved password or link is missing; remove this calendar and add it again.",
    "calendar.tooMany": ({ max }) => `At most ${max} calendars.`,
    "calendar.needLink": "Fill in the subscription link.",
    "calendar.needPassword": "Fill in the password.",
    "calendar.needAccount": "Fill in the account.",
    "translation.provider": ({ service }) => `Unsupported translation service: ${service}`,
    "translation.noAddress": ({ service }) => `Fill in the address of ${service} in the translation settings first.`,
    "translation.url": "The service address is not valid.",
    "translation.urlEmpty": "Fill in the custom service address.",
    "translation.urlLong": "The service address is too long.",
    "translation.urlFull": "The service address is not valid; fill in the whole https:// address.",
    "translation.urlCredentials": "The service address cannot hold a user name or password; put the key in the key field.",
    "translation.urlScheme": "The service address must use https (http only for this computer).",
    "pluginsV3.builtinUnknown": ({ id }) => `There is no built-in plugin ${id}.`,
    "pluginsV3.builtinEssential": ({ id }) => `${id} is essential to Fuyu and cannot be switched off.`,
    "pluginsV3.builtinSave": ({ id }) => `Could not save the switch for ${id}.`,
    "pluginsV3.builtinConfigKey": ({ id, key }) => `${key} cannot be a setting of ${id}.`,
    "pluginsV3.builtinConfigValue": ({ id, key }) => `The setting ${key} of ${id} must be on or off, a number or text.`,
    "pluginsV3.builtinConfigSave": ({ id }) => `Could not save the settings of ${id}.`,
    "pluginsV3.invalidDismissTarget": "Unknown plugin migration notice target.",
    "pluginsV3.migrationSave": "Could not save the legacy plugin migration state.",
    "translation.urlQuery": "The service address cannot have query parameters.",
    "translation.modelLong": "The model name is too long.",
    "translation.noModel": ({ service }) => `Fill in the model name for ${service} in the translation settings first.`,
    "translation.noResult": ({ service }) => `${service} returned no translation.`,
    "translation.cutOff": ({ service }) => `${service} did not finish the translation; try again or shorten the text.`,
    "translation.unfinished": ({ service }) => `${service} did not finish the translation.`,
    "translation.copy": "Could not copy the translation.",
    "translation.key": "Enter a valid API key.",
    "translation.empty": "Enter the text to translate.",
    "translation.tooLong": ({ max }) => `At most ${max} characters at a time.`,
    "translation.direction": "Unsupported translation direction.",
    "translation.noKey": ({ service }) => `Set up the API key for ${service} first.`,
    "translation.status": ({ service, status }) => `${service} answered HTTP ${status}; check the key, the model name or the quota.`,
    "planUsage.key": "That does not look like an API key.",
    "editorExtension.unknown": "That editor is not supported.",
    "editorExtension.noCli": ({ editor }) => `Could not find ${editor}'s command line. Open ${editor} and try again.`,
    "editorExtension.failed": "Could not install the extension.",
    "mail.address": "Enter a valid email address.",
    "mail.attachmentDecode": "Could not decode the attachment; download it in the web mail.",
    "mail.attachmentDownload": "Could not download the attachment; check the network and try again.",
    "mail.attachmentGone": "The attachment was removed; refresh the inbox.",
    "mail.attachmentLarge": ({ mb }) => `The attachment is over ${mb} MB; download it in the web mail.`,
    "mail.attachmentParse": "Could not read the attachment; download it in the web mail.",
    "mail.badId": "The mail id is not valid; refresh the inbox.",
    "mail.badPart": "The attachment id is not valid; open the mail again.",
    "mail.bodyDecode": "Could not decode the mail body; open it in the web mail.",
    "mail.bodyFormat": "The mail body is not in the expected format; open it in the web mail.",
    "mail.bodyLarge": "The mail body is too large; open it in the web mail.",
    "mail.bodyLoad": "Could not load the mail body; check the network and try again.",
    "mail.bodyLong": "The text is too long; send it in the web mail.",
    "mail.bodyOver": "The mail body is over 512 KB; open it in the web mail.",
    "mail.bodyParse": "Could not read the mail body; open it in the web mail.",
    "mail.bodyPartial": "The mail body did not load completely; try again.",
    "mail.build": "Could not put the mail together.",
    "mail.cancelled": "The mail connection was cancelled.",
    "mail.changedOpen": "The mail connection changed; open the mail again.",
    "mail.changedRefresh": "The mail connection changed; refresh the inbox.",
    "mail.codeMissing": "The saved authorization code was not found; connect again.",
    "mail.connect": "Connect a mailbox first.",
    "mail.connectAndEnable": "Connect the mailbox and turn receiving on first.",
    "mail.connectThis": "Connect this mailbox first.",
    "mail.connectUnfinished": "Connecting did not finish.",
    "mail.crashedRetrying": "The mail connection broke off; connecting again.",
    "mail.crashedStopped": "The mail connection broke off several times and stopped retrying. Authorize again in Settings, pause and resume receiving, or restart the island.",
    "mail.disconnect": "Could not disconnect the mailbox.",
    "mail.disconnectCredential": "Deleting the saved code failed; disconnect again.",
    "mail.disconnectPartly": "Receiving stopped, but deleting the saved code from Windows Credential Manager failed; disconnect again.",
    "mail.headers": "Could not read the mail's headers.",
    "mail.imapRefused": "The mailbox refused the connection; check that IMAP is on and enter the authorization code again.",
    "mail.imapServer": "The IMAP server address is not valid: fill in a domain, with a port if needed, such as imap.example.com or imap.example.com:9993.",
    "mail.inbox": "Could not open the inbox; try again later.",
    "mail.inboxChanged": "The inbox changed; refresh the list and try again.",
    "mail.inboxChangedOpen": "The inbox changed; refresh the list and open the mail again.",
    "mail.markRead": "Could not mark the mail as read.",
    "mail.markReadLater": "Could not mark the mail as read; try again later.",
    "mail.needCode": "Enter the authorization code made in the mailbox settings.",
    "mail.needRecipient": "Fill in a recipient.",
    "mail.noAttachment": "This attachment was not found; open the mail again.",
    "mail.noDownloads": "The Downloads folder was not found.",
    "mail.noSender": "This mail's sender was not found.",
    "mail.noText": "This mail has no text to read; open it in the web mail.",
    "mail.off": "Mail is off. Turn on Messages in Plugins, then Mail in its settings.",
    "mail.notRecent": "The mail is no longer in the recent list; refresh the inbox.",
    "mail.read": "Could not read the mail.",
    "mail.readCode": "Could not read the saved code from Windows Credential Manager; connect again.",
    "mail.readLater": "Could not read the mail; try again later.",
    "mail.recipient": ({ address }) => `Not a valid recipient address: ${address}`,
    "mail.removed": "The mail was removed; refresh the inbox.",
    "mail.saveAttachment": "Could not save the attachment.",
    "mail.saveCode": "Could not save to Windows Credential Manager; connect again.",
    "mail.sendFailed": "Sending failed; check the network and try again.",
    "mail.sendUnfinished": "Sending did not finish.",
    "mail.serviceDown": "The mail service is not available.",
    "mail.smtpRefused": "The mail server refused the sign-in or the mail; check that SMTP is on, the authorization code and the recipients.",
    "mail.start": "Could not start the mail service.",
    "mail.stopped": "The mail connection stopped; authorize again in Settings, or pause and resume receiving.",
    "mail.structure": "Could not read the mail's structure; try again later.",
    "mail.subject": "The subject is too long or has a line break.",
    "mail.sync": "Could not sync the mailbox; check the network or try again later.",
    "mail.tls": "Could not set up an encrypted connection.",
    "mail.tooMany": ({ max }) => `At most ${max} mailboxes at once; disconnect one first.`,
    "mail.tooManyNames": "Too many files with this name in Downloads; clear some and try again.",
    "mail.tooManyRecipients": ({ max }) => `At most ${max} recipients in one mail.`,
    "mail.unavailable": "The mail was removed or is not available; refresh the inbox.",
    "mail.update": "Could not update the mail connection.",
    "voiceInput.noDataDir": "Could not find the island's data folder.",
    "voiceInput.deleteFailed": "Could not delete the speech model.",
    "voiceInput.downloadBusy": "The speech model is already downloading.",
    "voiceInput.downloadCancelled": "The download was cancelled.",
    "voiceInput.downloadFailed": "Could not download the speech model from GitHub or the mirrors; check the network and try again.",
    "voiceInput.unpackFailed": "Could not unpack the speech model; delete it and download it again.",
    "voiceInput.modelBroken": "The speech model could not be loaded; delete it and download it again.",
    "voiceInput.micFailed": "Could not use the microphone; check that one is connected and that Fuyu may use it in the system privacy settings.",
    "voiceInput.micDenied": "Fuyu may not use the microphone; allow it in System Settings → Privacy & Security → Microphone.",
    "voiceInput.noModel": "Download the speech model in Settings → Voice input first.",
    "file.noDownloads": "The Downloads folder was not found.",
    "clipboard.notExport": "This is not a clipboard file exported from Fuyu.",
    "clipboard.newerExport": "This is not a clipboard file exported from Fuyu, or it comes from a newer version.",
    "clipboard.importTooLarge": "The clipboard file is too large.",
    "settingsBackup.badName": "Not a settings backup file name.",
    "settingsBackup.badContent": "Not a settings or theme backup.",
    "settingsBackup.tooManyNames": ({ name, dir }) => `Too many files named ${name} in ${dir}; clear some and try again.`,
    "notificationVerify.badId": "Notification verification requires an isolated 32-digit hex run ID.",
    "notificationVerify.unisolated": "Notification verification did not isolate the app data folder.",
    "notificationVerify.start": "Could not start recording notification verification.",
    "messenger.notInteractive": ({ name }) => `${name} has not restored an interactive main window yet; open it from the system tray.`,
    "messenger.foreground": ({ name }) => `Found the ${name} window, but could not bring it to the front; click ${name} in the taskbar or tray.`,
    "remoteHosts.save": "Could not save the remote computers.",
    "remoteHosts.host": ({ host }) => `"${host}" is not an SSH host name.`,
    "remoteHosts.tooMany": ({ max }) => `At most ${max} computers.`,
    "remoteHosts.address": ({ host }) => `"${host}" is not a host name or address.`,
    "remoteHosts.name": ({ name }) => `"${name}" cannot be a name: use letters, digits, . _ - or @.`,
    "remoteHosts.user": ({ user }) => `"${user}" is not a user name.`,
    "remoteHosts.port": "The port must be 1–65535.",
    "remoteHosts.tooManyCustom": ({ max }) => `At most ${max} added computers.`,
    "remoteHosts.unknown": ({ host }) => `Unknown SSH computer ${host}.`,
    "sshTunnel.notReady": "The SSH proxy tunnel is not set up yet.",
    "sshTunnel.start": ({ host }) => `Could not start the tunnel to ${host}.`,
    "sshTunnel.needPort": ({ host }) => `Set the port on ${host} first.`,
    "sshTunnel.remotePort": ({ min }) => `The port on the server must be ${min}–65535.`,
    "sshTunnel.tooMany": ({ max }) => `At most ${max} hosts.`,
    "sshTunnel.save": "Could not save the SSH tunnels.",
    "sshTunnel.noPortTool": "Neither ss nor netstat runs on the server.",
    "sshTunnel.portCheck": "Could not check the port on the server.",
    "soundPack.noDataDir": "Could not find the app data folder.",
    "soundPack.format": ({ name }) => `Unsupported sound format: ${name}`,
    "soundPack.sizeOrEmpty": ({ name }) => `The sound file is empty or too large: ${name} (at most 4 MB).`,
    "soundPack.empty": "There are no usable sounds in this folder.",
    "soundPack.writeSound": ({ name }) => `Could not write sound ${name}.`,
    "soundPack.save": "Could not save the sound pack.",
    "soundPack.fromPlugin": "This sound pack comes from a plugin; disable or uninstall it on the Plugins page.",
    "soundPack.badId": "The sound pack id is not valid.",
    "soundPack.notFound": "This sound pack was not found.",
    "soundPack.delete": "Could not delete the sound pack.",
    "soundPack.pluginGone": "This sound pack was not found; the plugin may be disabled or uninstalled.",
    "soundPack.openFolder": "Could not open the folder.",
    "soundPack.fileMissing": "This file is not in the sound pack.",
    "soundPack.readSound": ({ name }) => `Could not read sound ${name}.`,
    "soundPack.tooLarge": ({ name }) => `The sound file is too large: ${name} (at most 4 MB).`,
    "toast.init": "Could not initialize Windows notifications.",
    "toast.unavailable": "Windows notification listener is unavailable.",
    "toast.checkAccess": "Could not check notification permission.",
    "toast.read": "Could not read Windows notifications.",
    "qq.notReady": "The QQ notification service is not ready yet.",
    "qq.unavailable": "The QQ notification state is unavailable.",
    "qq.requestAccessStart": "Could not start the notification permission request.",
    "qq.requestAccess": "Could not request Windows notification permission.",
    "qq.accessFailed": "Windows notification authorization failed.",
    "qq.openSettings": isMacOS ? "Could not open Accessibility settings." : "Could not open Windows notification settings.",
    "qq.openApp": "Could not open QQ.",
    "qq.notInstalled": "QQ installation path was not found. Open QQ first and try again.",
    "qq.findWindow": "Could not look up running QQ windows.",
    "qq.noMainWindow": "QQ is running, but no main window was found; open QQ from the system tray.",
    "qq.notRunning": "No running QQ window was found; open and sign in to desktop QQ first.",
    "qq.noTrayEntry": "Could not find QQ's tray entry; double-click the QQ icon in the system tray.",
    "qq.multipleTrays": "QQ has multiple tray entries; open QQ from the system tray.",
    "qq.trayTimeout": "Looking up the QQ tray icon timed out; open QQ from the system tray.",
    "qq.multipleTrayIcons": "QQ has multiple tray icons; double-click the QQ icon in the system tray.",
    "qq.trayNotReady": "The QQ tray icon is not ready yet; open QQ from the system tray.",
    "qq.trayNoResponse": "QQ did not respond to the tray activation request; open it from the system tray.",
    "qq.restoreFailed": "QQ did not restore an interactive main window; double-click the QQ icon in the system tray.",
    "qq.disabledForApp": "Windows notifications for QQ are turned off; enable them in system notification settings.",
    "qq.disabledForUser": "Windows system notifications are turned off; enable them in system notification settings.",
    "qq.disabledByPolicy": "Windows notifications are disabled by administrator policy; contact your administrator.",
    "qq.unsupportedInstall": "This QQ installation does not support system notifications; check or update QQ.",
    "qq.channelNotReady": "The QQ notification channel is not ready yet; make sure QQ is installed, or turn receiving off and on again to retry.",
    "qq.repairToolMissing": "Could not locate PowerShell to repair Windows notifications.",
    "qq.repairStart": "Could not start the automatic QQ notification repair.",
    "qq.repairUnfinished": "Automatic QQ notification repair did not finish; check your QQ installation, or turn receiving off and on again to retry.",
    "qq.repairFailed": "Automatic QQ notification repair failed.",
    "qq.repairStopped": "Automatic QQ notification repair stopped or timed out; turn receiving off and on again to retry.",
    "wechat.notReady": "The WeChat reminder service is not ready yet.",
    "wechat.unavailable": "The WeChat reminder state is unavailable.",
    "wechat.notInstalled": "WeChat installation path was not found. It will connect automatically once WeChat opens.",
    "wechat.verifyPath": "Could not verify the WeChat installation path.",
    "wechat.notRunning": "No running WeChat window was found; open and sign in to desktop WeChat first.",
    "wechat.findWindow": "Could not look up running WeChat windows.",
    "wechat.noMainWindow": "WeChat is running, but no main window was found; open and sign in to WeChat from the system tray first.",
    "wechat.openProtocol": "Could not bring WeChat back via its registered protocol; open WeChat from the system tray.",
    "wechat.restoreFailed": "WeChat did not restore its main window; double-click the WeChat icon in the system tray.",
    "wechat.openApp": "Could not open WeChat.",
    "wechat.exposeWaiting": "WeChat main window not found; its UI will be exposed automatically once WeChat starts.",
    "wechat.exposeExternal": "WeChat's UI is already exposed by another program (such as a screen reader).",
    "wechat.exposeOn": "WeChat's UI is exposed. The chat list cannot be read while WeChat is closed to the tray, though minimizing works.",
    "wechat.exposeNoDll": "Could not expose WeChat's UI: Weixin.dll was not found in the WeChat process (not version 4.x?).",
    "wechat.exposeOpenProcess": "Could not expose WeChat's UI: could not open the WeChat process (if WeChat runs as administrator, run Fuyu as administrator too).",
    "wechat.exposeReadDll": "Could not expose WeChat's UI: could not read Weixin.dll.",
    "wechat.exposeNoSwitch": "Could not expose WeChat's UI: could not find the accessibility switch in this WeChat version.",
    "wechat.exposeStillHidden": "Could not expose WeChat's UI: toggled the switch, yet WeChat's UI is still not exposed.",
    "shellAttention.alreadyRunning": "The taskbar attention listener is already running on this thread.",
    "shellAttention.registerEvent": "Could not register the taskbar attention event.",
    "shellAttention.createReceiver": "Could not create the taskbar attention receiver.",
    "shellAttention.listen": "Could not listen for taskbar attention.",
    "shellAttention.startThread": "Could not start the taskbar attention listener thread.",
    "shellAttention.startTimeout": "Starting the taskbar attention listener thread timed out.",
  },
};
