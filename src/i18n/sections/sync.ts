import type { CategoryState, OptionalSyncGroup, SyncCategory, SyncPhase } from "../../features/sync/api";

export type SyncText = {
  status: {
    groupTitle: string;
    syncNow: string;
    syncingAction: string;
    neverSynced: string;
    lastSynced: (time: string) => string;
    skippedFiles: (count: number) => string;
    phases: Record<SyncPhase, { headline: string; hint: string }>;
  };
  confirm: {
    title: string;
    manyDeletions: (category: string, removed: number, total: number) => string;
    remoteCleared: string;
    hint: string;
    approve: string;
    stopSync: string;
  };
  backend: {
    groupTitle: string;
    methodLabel: string;
    methods: {
      folder: string;
    };
    folderTitle: string;
    folderUnset: string;
    folderPickerTitle: string;
    chooseFolder: string;
    changeFolder: string;
    revealFolder: string;
    stopSync: string;
    stopConfirm: string;
    stopCancel: string;
    footnote: string;
  };
  categories: {
    groupTitle: string;
    footnote: string;
    states: Record<CategoryState, string>;
    items: Record<SyncCategory, { title: string; description: string }>;
  };
  optional: {
    groupTitle: string;
    footnote: string;
    items: Record<OptionalSyncGroup, { title: string; description: string }>;
  };
  devices: {
    groupTitle: string;
    empty: string;
    emptyHint: string;
    thisDevice: string;
    stale: string;
    platforms: {
      windows: string;
      macos: string;
      linux: string;
    };
    meta: (platform: string, version: string, time: string) => string;
  };
  help: {
    groupTitle: string;
    footnote: string;
    items: {
      cloudDrive: { title: string; description: string };
      nutstore: { title: string; description: string };
      syncthing: { title: string; description: string };
      nas: { title: string; description: string };
    };
  };
};

export const zhCN: SyncText = {
  status: {
    groupTitle: "同步状态",
    syncNow: "立即同步",
    syncingAction: "正在同步…",
    neverSynced: "还没有完成过同步",
    lastSynced: (time) => `上次同步：${time}`,
    skippedFiles: (count) => `跳过了 ${count} 个暂不可读的远端文件，将在下一轮重试`,
    phases: {
      off: {
        headline: "尚未开启跨设备同步",
        hint: "选择一个同步文件夹后，待办、短语、书签和通用设置会在多台电脑之间按条自动合并。",
      },
      idle: {
        headline: "同步已就绪",
        hint: "本机改动 5 秒后自动推送，每 5 分钟及打开本页时自动拉取合并。",
      },
      syncing: {
        headline: "正在合并多端数据…",
        hint: "正在读取各设备记录并按混合逻辑时钟逐条比对。",
      },
      folderMissing: {
        headline: "同步文件夹暂时不在",
        hint: "网盘尚未挂载或共享盘已断开，本轮已安全跳过，不会误删任何数据。",
      },
      needsConfirm: {
        headline: "检测到大量删除，已暂停等待确认",
        hint: "为防止误清空网盘目录波及本机数据，合并已在写入前刹停。",
      },
      newerVersion: {
        headline: "远端包含更高版本写入的数据",
        hint: "另一台电脑上的浮屿版本更新，请先升级本机应用后再继续同步该类别。",
      },
      error: {
        headline: "上一次同步未完成",
        hint: "请检查同步文件夹读写权限或网盘客户端状态后重试。",
      },
    },
  },
  confirm: {
    title: "需要确认删除操作",
    manyDeletions: (category, removed, total) => `远端合并将从「${category}」中删除 ${removed} / ${total} 条记录。`,
    remoteCleared: "远端同步目录中的设备数据已被清空或移走。",
    hint: "如果这是你在另一台电脑上主动清理的，点「确认继续」应用删除；如果是网盘还没同步完或选错了目录，请先更换目录或等网盘就绪后再试。",
    approve: "确认继续",
    stopSync: "停止同步",
  },
  backend: {
    groupTitle: "同步方式",
    methodLabel: "同步通道",
    methods: {
      folder: "同步文件夹",
    },
    folderTitle: "同步文件夹",
    folderUnset: "未选择（首次使用请手动指定一个空目录或已有的 fuyu-sync 上级目录）",
    folderPickerTitle: "选择跨设备同步文件夹",
    chooseFolder: "选择文件夹…",
    changeFolder: "更换…",
    revealFolder: "在文件夹中显示",
    stopSync: "停止同步",
    stopConfirm: "确认停止",
    stopCancel: "取消",
    footnote: "请专门新建一个子目录用于同步，不要把浮屿的数据文件夹（~/.fuyu）直接放进网盘：每台设备只写自己的文件，首次并入前会自动在本地留一份备份。",
  },
  categories: {
    groupTitle: "同步内容",
    footnote: "所有凭据与 API 密钥、普通剪贴板历史和图片、截图文件、文件中转及窗口位置/快捷键等本机项永不离开本机。",
    states: {
      off: "已关闭",
      waiting: "等待同步",
      ok: "已同步",
      notReady: "暂未就绪",
      newerVersion: "需升级版本",
      needsConfirm: "等待确认",
      error: "出错",
    },
    items: {
      todos: {
        title: "待办、每日笔记与归档",
        description: "按条合并待办与项目标签；同一天的每日笔记若两端同时改动会保留冲突副本。",
      },
      snippets: {
        title: "常用短语",
        description: "剪贴板里的常用语与 AI 提示词模板。",
      },
      links: {
        title: "链接书签",
        description: "剪贴板收藏的常用网址与排列顺序。",
      },
      settings: {
        title: "通用与功能设置",
        description: "按白名单同步配色、行为与功能偏好；各功能总开关仅在首次并入时带入。",
      },
      presets: {
        title: "我的主题预设",
        description: "已保存的外观样式预设（自动剔除显示器与尺寸等设备字段）。",
      },
    },
  },
  optional: {
    groupTitle: "可选同步",
    footnote: "以上分组涉及本机硬件、外部服务或插件环境差异，默认关闭；开启后仅在同样开启该组的电脑之间合并。",
    items: {
      translationProvider: {
        title: "翻译服务与模型选择",
        description: "默认关闭：API 密钥各台单独保存，且本地模型地址（如 Ollama）在另一台电脑上往往不可用。",
      },
      screenshotCapture: {
        title: "PrtSc 接管与录屏参数",
        description: "默认关闭：键盘布局、麦克风与系统声音捕获能力因电脑和系统而异。",
      },
      agentSoundOutput: {
        title: "Agent 提示音量与音效包",
        description: "默认关闭：外放/耳机音量习惯不同，且自定义音效包可能未在另一台电脑安装。",
      },
      agentPushDelivery: {
        title: "手机推送开关与通道",
        description: "默认关闭：多台电脑同时开启推送会导致同一条提醒重复发到手机。",
      },
      qqMail: {
        title: "邮箱账号列表（不含密码）",
        description: "默认关闭：授权码保存在本机钥匙串中，同步过去后仍需在当地重新授权登录。",
      },
      collapsedItems: {
        title: "收起条项目与顺序",
        description: "默认关闭：收起条可能包含仅在某一台电脑安装的第三方插件或平台专属项。",
      },
      pluginPages: {
        title: "插件岛上页面顺序与隐藏",
        description: "默认关闭：各台电脑安装的插件集合不同，页面列表未必一致。",
      },
      updateChannel: {
        title: "更新通道（稳定版 / 测试版）",
        description: "默认关闭：便于在一台电脑尝鲜测试版，另一台主力机保持稳定版。",
      },
    },
  },
  devices: {
    groupTitle: "已连接的设备",
    empty: "暂无同步设备记录",
    emptyHint: "完成第一次同步后，写过该同步目录的电脑会列在这里。",
    thisDevice: "本机",
    stale: "超过 180 天未活跃",
    platforms: {
      windows: "Windows",
      macos: "macOS",
      linux: "Linux",
    },
    meta: (platform, version, time) => `${platform} · v${version} · 上次同步 ${time}`,
  },
  help: {
    groupTitle: "配置指南",
    footnote: "多台电脑之间只需指向同一个云盘同步目录或局域网共享目录即可协同工作。",
    items: {
      cloudDrive: {
        title: "OneDrive / iCloud Drive",
        description: "在网盘里新建一个文件夹（如 Sync/Fuyu），在各台电脑上都选中它即可；按需下载的占位文件会在同步时自动拉取。",
      },
      nutstore: {
        title: "坚果云同步盘",
        description: "安装坚果云客户端后将一个本地文件夹设为同步文件夹，在 Windows 与 Mac 上分别选中该文件夹。",
      },
      syncthing: {
        title: "Syncthing 局域网/跨网同步",
        description: "共享同一个文件夹给多台设备，浮屿会自动忽略 .sync-conflict 与临时文件，按条无锁合并。",
      },
      nas: {
        title: "NAS / SMB 局域网共享",
        description: "挂载群晖或飞牛等 SMB 共享目录后选中；外出未挂载共享盘时会自动跳过当轮同步，回来后继续。",
      },
    },
  },
};

export const en: SyncText = {
  status: {
    groupTitle: "Sync status",
    syncNow: "Sync now",
    syncingAction: "Syncing…",
    neverSynced: "Never synced yet",
    lastSynced: (time) => `Last synced: ${time}`,
    skippedFiles: (count) => `Skipped ${count} unreadable remote file(s); will retry next round`,
    phases: {
      off: {
        headline: "Cross-device sync is off",
        hint: "Choose a sync folder to merge todos, snippets, bookmarks and general settings item-by-item across your computers.",
      },
      idle: {
        headline: "Sync is ready",
        hint: "Local edits push after 5 seconds; remote updates pull every 5 minutes and when you open this page.",
      },
      syncing: {
        headline: "Merging across devices…",
        hint: "Reading device records and merging item-by-item with hybrid logical clocks.",
      },
      folderMissing: {
        headline: "Sync folder is temporarily unavailable",
        hint: "The cloud drive or network share isn't mounted right now. This round was skipped safely without deleting anything.",
      },
      needsConfirm: {
        headline: "Paused to confirm a large deletion",
        hint: "Sync stopped before writing to protect your local items from an accidental wipe.",
      },
      newerVersion: {
        headline: "Remote data uses a newer format",
        hint: "Another computer is running a newer version of Fuyu. Update Fuyu on this computer to resume syncing that category.",
      },
      error: {
        headline: "Last sync didn't finish",
        hint: "Check folder permissions or your sync client and try again.",
      },
    },
  },
  confirm: {
    title: "Confirm deletions",
    manyDeletions: (category, removed, total) => `Merging remote changes will remove ${removed} of ${total} items in ${category}.`,
    remoteCleared: "Device records in the remote sync folder were cleared or moved.",
    hint: "If you intentionally cleared those items on another computer, click Confirm & continue. If a cloud drive is still syncing or you picked the wrong folder, switch folders or wait first.",
    approve: "Confirm & continue",
    stopSync: "Stop sync",
  },
  backend: {
    groupTitle: "Sync method",
    methodLabel: "Transport",
    methods: {
      folder: "Sync folder",
    },
    folderTitle: "Sync folder",
    folderUnset: "Not selected (pick an empty folder or an existing parent folder containing fuyu-sync)",
    folderPickerTitle: "Choose sync folder",
    chooseFolder: "Choose folder…",
    changeFolder: "Change…",
    revealFolder: "Show in folder",
    stopSync: "Stop sync",
    stopConfirm: "Confirm stop",
    stopCancel: "Cancel",
    footnote: "Use a dedicated subfolder for sync rather than placing Fuyu's data folder (~/.fuyu) inside a cloud drive. Each device writes only its own files, and a local backup is created automatically before the first merge.",
  },
  categories: {
    groupTitle: "What to sync",
    footnote: "Credentials, API keys, regular clipboard history and images, screenshots, the file shelf, and machine-specific layout or shortcuts never leave this computer.",
    states: {
      off: "Off",
      waiting: "Waiting",
      ok: "Synced",
      notReady: "Not ready",
      newerVersion: "Update needed",
      needsConfirm: "Needs confirm",
      error: "Error",
    },
    items: {
      todos: {
        title: "Todos, daily notes and archive",
        description: "Merges todos and project tags item-by-item; keeps a conflict copy if both computers edit the same day's note.",
      },
      snippets: {
        title: "Snippets",
        description: "Saved clipboard phrases and AI prompt templates.",
      },
      links: {
        title: "Link bookmarks",
        description: "Saved websites in the clipboard window and their order.",
      },
      settings: {
        title: "General and feature settings",
        description: "Syncs allowlisted theme, behavior and feature preferences; feature master switches copy only on first merge.",
      },
      presets: {
        title: "Saved themes",
        description: "Style presets with monitor and size fields stripped per machine.",
      },
    },
  },
  optional: {
    groupTitle: "Optional sync",
    footnote: "These groups depend on local hardware, credentials or installed plugins, so they stay off by default and sync only between computers where you turn them on.",
    items: {
      translationProvider: {
        title: "Translation service and models",
        description: "Off by default: API keys stay local, and custom endpoints like local Ollama rarely work on another machine.",
      },
      screenshotCapture: {
        title: "PrtSc capture and recording options",
        description: "Off by default: keyboard keys, microphones and system audio capture differ across machines and OSes.",
      },
      agentSoundOutput: {
        title: "Agent sound volume and sound pack",
        description: "Off by default: speaker levels vary by machine, and custom sound packs may not be installed elsewhere.",
      },
      agentPushDelivery: {
        title: "Mobile push switch and channel",
        description: "Off by default: turning push on across multiple computers can send duplicate alerts.",
      },
      qqMail: {
        title: "Mail accounts (without passwords)",
        description: "Off by default: app passwords stay in each computer's keychain, so accounts still need sign-in there.",
      },
      collapsedItems: {
        title: "Collapsed bar items and order",
        description: "Off by default: the bar can include plugins or items only available on one computer.",
      },
      pluginPages: {
        title: "Plugin island page order and visibility",
        description: "Off by default: different computers may have different plugins installed.",
      },
      updateChannel: {
        title: "Update channel (Stable / Beta)",
        description: "Off by default: lets you test Beta builds on one computer while keeping another on Stable.",
      },
    },
  },
  devices: {
    groupTitle: "Synced devices",
    empty: "No synced devices yet",
    emptyHint: "Computers that sync with this folder appear here after the first round.",
    thisDevice: "This computer",
    stale: "Inactive 180+ days",
    platforms: {
      windows: "Windows",
      macos: "macOS",
      linux: "Linux",
    },
    meta: (platform, version, time) => `${platform} · v${version} · Last synced ${time}`,
  },
  help: {
    groupTitle: "Setup guides",
    footnote: "Point Fuyu on each computer at the same cloud-synced or network-shared folder.",
    items: {
      cloudDrive: {
        title: "OneDrive / iCloud Drive",
        description: "Create a dedicated folder (such as Sync/Fuyu) inside your cloud drive and select it on each computer.",
      },
      nutstore: {
        title: "Nutstore sync folder",
        description: "Sync a local folder with the Nutstore desktop client and select that folder on Windows and Mac.",
      },
      syncthing: {
        title: "Syncthing",
        description: "Share one folder across devices; Fuyu ignores .sync-conflict and temporary files automatically.",
      },
      nas: {
        title: "NAS / SMB share",
        description: "Select a mounted SMB folder; rounds skip safely while unmounted away from home and resume when reconnected.",
      },
    },
  },
};
