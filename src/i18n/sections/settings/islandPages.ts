type PageIconPickerText = {
  sourcesLabel: string;
  sources: { icon: string; emoji: string; text: string; image: string };
  inUse: string;
  stage: { label: string; peeking: string; actual: string; emojiNote: string; onDark: string; onLight: string; isDefault: (name: string) => string };
  search: {
    label: string;
    placeholder: (count: number) => string;
    loading: string;
    failed: string;
    results: (count: number) => string;
    empty: (query: string) => string;
    useEmoji: string;
    useText: string;
    useImage: string;
  };
  sections: { recent: string; recommended: string; all: (count: number) => string; more: string };
  emoji: {
    label: string;
    hint: string;
    keys: { mac: string; windows: string };
    notEmoji: string;
    onlyFirst: (emoji: string) => string;
    mono: string;
    groups: { common: string; animals: string; nature: string; food: string; objects: string; symbols: string };
  };
  text: { label: string; hint: string; width: (px: number) => string; tooWide: (px: number) => string; weight: string; regular: string; bold: string; suggestions: string };
  image: {
    drop: string;
    formats: string;
    where: string;
    copySvg: string;
    dropHere: string;
    badType: string;
    tooBig: string;
    unreadable: string;
    remote: string;
    full: (max: number) => string;
    saveFailed: string;
    auto: { svg: string; alpha: string; photo: string };
    display: string;
    mono: string;
    color: string;
    shape: string;
    shapes: { none: string; circle: string; round: string };
    zoom: string;
    dragTip: string;
    use: (page: string) => string;
    cancel: string;
    library: string;
    libraryHint: string;
    remove: string;
    removed: string;
    removedUsed: (pages: readonly string[]) => string;
    undo: string;
    mine: string;
  };
};

export type SettingsIslandPagesText = {
  title: string;
  hint: string;
  plugin: string;
  off: string;
  hidden: string;
  showPage: (name: string) => string;
  reset: string;
  loading: string;
  hidePage: (name: string) => string;
  moveHint: string;
  modes: { bar: string; expanded: string };
  preview: { builtin: string; off: string; empty: string; pageOf: (page: number, pages: number) => string; actions: string };
  panels: {
    tag: string;
    title: string;
    hint: string;
    inPanel: string;
    available: string;
    none: string;
    allAdded: string;
    add: (name: string) => string;
    removeWidget: (name: string) => string;
    moveWidget: (name: string) => string;
    unavailable: string;
    sizeTitle: string;
    sizeHint: string;
    sizeCard: (size: string, cols: number, rows: number) => string;
    oneSize: string;
  };
  icons: {
    title: (name: string) => string;
    hint: string;
    fuyuHint: string;
    useDefault: string;
    text: string;
    jellyfish: string;
    names: Record<string, string>;
    picker: PageIconPickerText;
  };
  page: {
    agents: string;
    todo: string;
    music: string;
    calendar: string;
    clipboard: string;
    shelf: string;
    screenshots: string;
    timer: string;
    qq: string;
    translation: string;
  };
  sideDocks: {
    title: string;
    hint: string;
    openAria: string;
    pinAria: string;
    closeAria: string;
    openSettingsAria: string;
    emptyHint: string;
    autoSplit: string;
    allToTop: string;
    reset: string;
    zones: {
      left: string;
      top: string;
      right: string;
      hidden: string;
      enabled: string;
      disabled: string;
      dropHint: string;
      hiddenHint: string;
      centerTitle: string;
      centerHint: string;
    };
    monitor: {
      title: string;
      hint: string;
      single: string;
      dual: string;
      secondary: string;
      seamBlocked: string;
      primaryHint: string;
      compact: string;
      standard: string;
      wide: string;
      previewOpen: string;
      previewClose: string;
      readout: (edge: string, percent: number, width: number, height: number) => string;
    };
    mode: {
      title: string;
      hint: string;
      threeAuto: string;
      threeAutoDesc: string;
      threeHover: string;
      threeHoverDesc: string;
      twoDirect: string;
      twoDirectDesc: string;
      recommended: string;
    };
    nav: {
      title: string;
      full: string;
      fullDesc: string;
      minimal: string;
      minimalDesc: string;
      icons: string;
      iconsDesc: string;
    };
    radius: {
      title: string;
      summary: (outer: number, inner: number, handle: number) => string;
      sharp: string;
      balanced: string;
      soft: string;
      custom: string;
    };
    appearance: {
      title: string;
      hint: string;
      follow: string;
      custom: string;
      followSummary: (tone: string, material: string, opacity: number) => string;
      glassOpacity: string;
    };
    fine: {
      title: string;
      summary: (trigger: string, handleW: number, handleH: number, density: string) => string;
      trigger: string;
      hover: string;
      click: string;
      hoverDelay: string;
      leaveDelay: string;
      drawerWidth: string;
      drawerHeight: string;
      gap: string;
      handleWidth: string;
      handleHeight: string;
      handleOpacity: string;
      handleDot: string;
      theme: string;
      material: string;
      follow: string;
      dark: string;
      light: string;
      glass: string;
      solid: string;
      surfaceOpacity: string;
      density: string;
      cozy: string;
      compact: string;
      stripStyle: string;
      stripLabel: string;
      stripIcon: string;
      dragDropShelf: string;
      hideInFullscreen: string;
    };
  };
};

export const zhCN: SettingsIslandPagesText = {
  title: "展开页面",
  hint: "点一下在上面的岛里看这一页。Alt+数字和切换上一页、下一页按这里的顺序。隐藏只是不在顶部出现，功能照常在后台运行，从收起条或通知仍能打开那一页。",
  plugin: "插件",
  off: "功能已关",
  hidden: "已隐藏",
  showPage: (name) => `在顶部显示：${name}`,
  reset: "恢复默认顺序",
  loading: "插件页面要等岛启动后才列出来。",
  hidePage: (name) => `从顶部隐藏：${name}`,
  moveHint: "拖动换位置，也可以选中后按住 Alt 加方向键",
  modes: { bar: "收起的岛预览", expanded: "展开的面板预览" },
  preview: {
    builtin: "内置页面，内容由功能自己决定；可以换顺序或隐藏。",
    off: "这个功能关着，岛上不会出现这一页。",
    empty: "这个面板还没有组件，在下面「可以添加」里点 ＋",
    pageOf: (page, pages) => `第 ${page} / ${pages} 页`,
    actions: "页头按钮",
  },
  panels: {
    tag: "我的",
    title: "面板里的组件",
    hint: "点 ＋ 加进来，点 × 拿掉，拖动换顺序。岛上按顺序从左上往右下自动排，最多显示 4 行，再多时在面板里滚动。",
    inPanel: "面板里",
    available: "可以添加",
    none: "还没有组件",
    allAdded: "都加进来了",
    add: (name) => `加进面板：${name}`,
    removeWidget: (name) => `从面板拿掉：${name}`,
    moveWidget: (name) => `${name}，拖动或按住 Alt 加方向键换顺序`,
    unavailable: "功能已关",
    sizeTitle: "大小",
    sizeHint: "点缩略图换大小，上面的岛跟着变。",
    sizeCard: (size, cols, rows) => `${size} · ${cols}×${rows} 格`,
    oneSize: "这个组件只有一种大小。",
  },
  icons: {
    title: (name) => `页头图标 · ${name}`,
    hint: "展开后顶部这一页用哪个图标。可以挑图标、emoji、写字或用自己的图片，选「默认」换回原来的。",
    fuyuHint: "Fuyu 页默认显示文字，也可以换成水母或其他图标。",
    useDefault: "默认",
    text: "文字 Fuyu",
    jellyfish: "水母",
    names: {
      star: "星星", heart: "爱心", sparkles: "闪光", zap: "闪电", flame: "火焰", sun: "太阳", moon: "月亮", cloud: "云",
      leaf: "叶子", cat: "猫", smile: "笑脸", rocket: "火箭", coffee: "咖啡", music: "音符", headphones: "耳机", "book-open": "书",
      briefcase: "公文包", "calendar-days": "日历", clock: "时钟", timer: "计时器", "list-todo": "清单", clipboard: "剪贴板", folder: "文件夹", camera: "相机",
      image: "图片", "gamepad-2": "手柄", house: "房子", bell: "铃铛", "message-circle": "消息", bot: "机器人", globe: "地球", "layout-grid": "格子",
    },
    picker: {
      sourcesLabel: "图标来源",
      sources: { icon: "图标", emoji: "Emoji", text: "文字", image: "图片" },
      inUse: "正在用这一种",
      stage: {
        label: "页头预览",
        peeking: "预览中 · 点一下才会换",
        actual: "实际大小；右边是深色、浅色岛上的放大图",
        emojiNote: "emoji 用的是系统字体，Windows 和 Mac 上长得不一样",
        onDark: "深色岛上",
        onLight: "浅色岛上",
        isDefault: (name) => `默认（${name}）`,
      },
      search: {
        label: "搜索图标",
        placeholder: (count) => `搜索 ${count} 个图标，中文英文都行`,
        loading: "正在载入全部图标…",
        failed: "全部图标没载入成功，先从推荐里挑，或者换一种。",
        results: (count) => `找到 ${count} 个`,
        empty: (query) => `没找到「${query}」。图标名是英文的，试试英文词，或者换一种：`,
        useEmoji: "用 emoji",
        useText: "写个字",
        useImage: "上传图片",
      },
      sections: { recent: "最近使用", recommended: "推荐", all: (count) => `全部 ${count} 个`, more: "往下滚动看更多" },
      emoji: {
        label: "输入一个 emoji",
        hint: "粘贴或输入任意一个 emoji，系统的表情面板：",
        keys: { mac: "Ctrl + ⌘ + 空格", windows: "Win + 句号" },
        notEmoji: "这不是 emoji。想用文字请去「文字」。",
        onlyFirst: (emoji) => `只用第一个：${emoji}`,
        mono: "跟随主题（单色）",
        groups: { common: "常用", animals: "动物", nature: "自然", food: "吃喝", objects: "东西", symbols: "符号" },
      },
      text: {
        label: "页头文字",
        hint: "中文最多 2 个字，英文、数字最多 3 个。打字时上面的预览跟着变。",
        width: (px) => `宽 ${px}px，刚好`,
        tooWide: (px) => `宽 ${px}px，这一页的按钮会比别的宽一点`,
        weight: "字重",
        regular: "常规",
        bold: "粗",
        suggestions: "建议",
      },
      image: {
        drop: "拖图片进来、点这里选文件，或直接粘贴",
        formats: "SVG、PNG、JPG、WebP，最大 2MB。截图和 SVG 代码也能粘贴。",
        where: "去哪找图标：",
        copySvg: "（点「Copy SVG」后回来粘贴）",
        dropHere: "松开就导入",
        badType: "这个格式用不了，换成 SVG、PNG、JPG 或 WebP。",
        tooBig: "图片超过 2MB，压小一点再试。",
        unreadable: "读不出这张图片，可能文件坏了。",
        remote: "这张网页图片读不到。先存到电脑上，再拖进来。",
        full: (max) => `最多存 ${max} 张，先在「我的图片」里删掉不用的。`,
        saveFailed: "没存下来，存储空间可能满了。",
        auto: { svg: "SVG 图标：默认跟随主题，深浅色都看得清", alpha: "透明背景：默认跟随主题，当成剪影显示", photo: "照片：默认原色、圆形裁切" },
        display: "显示",
        mono: "跟随主题（单色）",
        color: "原色",
        shape: "形状",
        shapes: { none: "原样", circle: "圆形", round: "圆角方" },
        zoom: "缩放",
        dragTip: "拖动调整位置，滚轮缩放",
        use: (page) => `用在「${page}」`,
        cancel: "取消",
        library: "我的图片",
        libraryHint: "所有页面共用",
        remove: "删除这张图片",
        removed: "已删除这张图片",
        removedUsed: (pages) => `已删除，${pages.join("、")} 换回默认图标`,
        undo: "撤销",
        mine: "我的图片",
      },
    },
  },
  page: {
    agents: "AI Agent",
    todo: "待办",
    music: "音乐",
    calendar: "日历",
    clipboard: "剪贴板",
    shelf: "文件中转",
    screenshots: "截图",
    timer: "计时器",
    qq: "消息",
    translation: "翻译",
  },
  sideDocks: {
    title: "屏幕左右侧边翼",
    hint: "把待办、剪贴板、文件中转等纵长列表拖到屏幕左侧或右侧独立展开，顶部主岛只留轻感知项。拖进未开启的一侧会自动启用它。",
    openAria: "展开侧边翼",
    pinAria: "钉住常驻",
    closeAria: "收起侧边翼",
    openSettingsAria: "配置侧边翼布局",
    emptyHint: "这一侧还没有分配页面，可在设置里拖入任意页面。",
    autoSplit: "一键清爽分流",
    allToTop: "全部回顶岛",
    reset: "恢复默认",
    zones: {
      left: "左侧翼",
      top: "顶部主岛",
      right: "右侧翼",
      hidden: "暂不显示",
      enabled: "已开启",
      disabled: "未开启",
      dropHint: "拖页面卡片到这里",
      hiddenHint: "拖到这里隐藏，功能仍在后台运行",
      centerTitle: "跨区拖拽页面卡片",
      centerHint: "支持同区拖动排序，拖入左侧翼或右侧翼时自动开启对应侧边翼",
    },
    monitor: {
      title: "位置、尺寸与多屏边缘",
      hint: "直接拖动显示器上的边缘把手调垂直位置，拖动微缩抽屉的内边和底边改宽高；双屏拼接边自动禁触。",
      single: "单屏",
      dual: "双屏拼接",
      secondary: "副屏",
      seamBlocked: "拼接边禁触",
      primaryHint: "拖把手上下移 · 拖虚框调宽高",
      compact: "紧凑",
      standard: "标准",
      wide: "宽大",
      previewOpen: "预览展开",
      previewClose: "收起预览",
      readout: (edge, percent, width, height) => `${edge} · 沿边 ${percent}% · 抽屉 ${width} × ${height}px · 仅贴物理外侧边`,
    },
    mode: {
      title: "展开形态与二层策略",
      hint: "默认触发即同步展开快捷条与二层抽屉，无需二次点击。",
      threeAuto: "三态 · 二层自动展开",
      threeAutoDesc: "触碰把手同时滑出快捷条与抽屉，一步到位",
      threeHover: "三态 · 悬停图标再开",
      threeHoverDesc: "先出窄快捷条，光标停到图标再展开抽屉",
      twoDirect: "两态 · 把手直达抽屉",
      twoDirectDesc: "无快捷条，直接贴着屏幕边展开大抽屉",
      recommended: "推荐",
    },
    nav: {
      title: "快捷条与抽屉导航风格",
      full: "完整双导航",
      fullDesc: "快捷条带短字，抽屉顶部保留完整 Tab 栏",
      minimal: "极简窄条 · 去重顶栏",
      minimalDesc: "纯图标快捷条切页，隐藏抽屉重复 Tab 栏",
      icons: "紧凑纯图标 Tab",
      iconsDesc: "抽屉顶栏折叠为纯图标，放得下更多页",
    },
    radius: {
      title: "圆角手感",
      summary: (outer, inner, handle) => `外框 ${outer}px · 内层 ${inner}px · 把手 ${handle}px`,
      sharp: "利落 8px",
      balanced: "均衡 14px",
      soft: "柔和 18px",
      custom: "自定义",
    },
    appearance: {
      title: "外观与材质",
      hint: "默认直接继承主岛的配色、材质与透明度，保持视觉统一；需要独立区分时再切换自定义。",
      follow: "跟随主岛",
      custom: "独立自定义",
      followSummary: (tone, material, opacity) => `当前已同步主岛外观：${tone} · ${material} · 不透明度 ${opacity}%（在「外观」中统一调整）`,
      glassOpacity: "玻璃背景不透明度",
    },
    fine: {
      title: "高级交互与把手参数",
      summary: (trigger, handleW, handleH, density) => `${trigger} · 把手 ${handleW}×${handleH}px · ${density}`,
      trigger: "触发方式",
      hover: "悬停展开",
      click: "仅点击把手",
      hoverDelay: "悬停延迟",
      leaveDelay: "移开收起延迟",
      drawerWidth: "抽屉宽度",
      drawerHeight: "抽屉高度",
      gap: "抽屉与条间距",
      handleWidth: "把手厚度",
      handleHeight: "把手长度",
      handleOpacity: "休眠把手可见度",
      handleDot: "把手状态微点",
      theme: "配色主题",
      material: "面板材质",
      follow: "跟随主岛",
      dark: "深色",
      light: "浅色",
      glass: "液态玻璃",
      solid: "纯色",
      surfaceOpacity: "背景不透明度",
      density: "列表密度",
      cozy: "舒适",
      compact: "紧凑",
      stripStyle: "快捷条样式",
      stripLabel: "图标+文字",
      stripIcon: "纯图标",
      dragDropShelf: "拖文件到边缘展开中转",
      hideInFullscreen: "全屏与游戏模式隐藏",
    },
  },
};

export const en: SettingsIslandPagesText = {
  title: "Expanded pages",
  hint: "Click a page to see it on the island above. Alt+number and next / previous page follow this order. Hiding a page only takes it off the top: the feature keeps running, and the bar or a notification can still open that page.",
  plugin: "Plugin",
  off: "Feature off",
  hidden: "Hidden",
  showPage: (name) => `Show at the top: ${name}`,
  reset: "Restore default order",
  loading: "Plugin pages are listed once the island has started.",
  hidePage: (name) => `Hide from the top: ${name}`,
  moveHint: "Drag to move, or select one and press Alt with an arrow key",
  modes: { bar: "Collapsed island preview", expanded: "Expanded panel preview" },
  preview: {
    builtin: "A built-in page: the feature decides what is on it. You can move or hide it.",
    off: "This feature is off, so the page does not show on the island.",
    empty: "This panel has no widgets yet. Press + under Add below.",
    pageOf: (page, pages) => `Page ${page} of ${pages}`,
    actions: "Header buttons",
  },
  panels: {
    tag: "Mine",
    title: "Widgets in this panel",
    hint: "Press + to add, × to remove, and drag to reorder. The island lays them out in order from the top left, shows up to 4 rows and scrolls past that.",
    inPanel: "In the panel",
    available: "Add",
    none: "No widgets yet",
    allAdded: "All widgets are in",
    add: (name) => `Add to the panel: ${name}`,
    removeWidget: (name) => `Remove from the panel: ${name}`,
    moveWidget: (name) => `${name}, drag or press Alt with an arrow key to move`,
    unavailable: "Feature off",
    sizeTitle: "Size",
    sizeHint: "Pick a thumbnail to change the size; the island above follows.",
    sizeCard: (size, cols, rows) => `${size} · ${cols}×${rows}`,
    oneSize: "This widget comes in one size only.",
  },
  icons: {
    title: (name) => `Tab icon · ${name}`,
    hint: "Which icon this page uses at the top of the open island: an icon, an emoji, text or your own image. Pick Default to go back.",
    fuyuHint: "The Fuyu page shows the word Fuyu by default; it can use the jellyfish or another icon instead.",
    useDefault: "Default",
    text: "Word Fuyu",
    jellyfish: "Jellyfish",
    names: {
      star: "Star", heart: "Heart", sparkles: "Sparkles", zap: "Lightning", flame: "Flame", sun: "Sun", moon: "Moon", cloud: "Cloud",
      leaf: "Leaf", cat: "Cat", smile: "Smile", rocket: "Rocket", coffee: "Coffee", music: "Music note", headphones: "Headphones", "book-open": "Book",
      briefcase: "Briefcase", "calendar-days": "Calendar", clock: "Clock", timer: "Timer", "list-todo": "Checklist", clipboard: "Clipboard", folder: "Folder", camera: "Camera",
      image: "Picture", "gamepad-2": "Gamepad", house: "House", bell: "Bell", "message-circle": "Message", bot: "Robot", globe: "Globe", "layout-grid": "Grid",
    },
    picker: {
      sourcesLabel: "Icon source",
      sources: { icon: "Icons", emoji: "Emoji", text: "Text", image: "Image" },
      inUse: "In use now",
      stage: {
        label: "Tab preview",
        peeking: "Previewing · click to use it",
        actual: "Actual size; on the right, enlarged on a dark and a light island",
        emojiNote: "Emoji use the system font, so they look different on Windows and Mac",
        onDark: "On a dark island",
        onLight: "On a light island",
        isDefault: (name) => `Default (${name})`,
      },
      search: {
        label: "Search icons",
        placeholder: (count) => `Search ${count} icons`,
        loading: "Loading all icons…",
        failed: "Could not load all icons. Pick a suggested one, or use another kind.",
        results: (count) => `${count} found`,
        empty: (query) => `Nothing found for "${query}". Try another word, or use something else:`,
        useEmoji: "Use an emoji",
        useText: "Type text",
        useImage: "Upload an image",
      },
      sections: { recent: "Recent", recommended: "Suggested", all: (count) => `All ${count}`, more: "Scroll for more" },
      emoji: {
        label: "Type an emoji",
        hint: "Paste or type any emoji. The system emoji panel: ",
        keys: { mac: "Ctrl + ⌘ + Space", windows: "Win + period" },
        notEmoji: "That is not an emoji. Use Text for letters.",
        onlyFirst: (emoji) => `Only the first one is used: ${emoji}`,
        mono: "Follow the theme (one color)",
        groups: { common: "Common", animals: "Animals", nature: "Nature", food: "Food & drink", objects: "Objects", symbols: "Symbols" },
      },
      text: {
        label: "Tab text",
        hint: "Up to 3 letters or digits, or 2 CJK characters. The preview above follows as you type.",
        width: (px) => `${px}px wide, fits`,
        tooWide: (px) => `${px}px wide: this tab will be a little wider than the others`,
        weight: "Weight",
        regular: "Regular",
        bold: "Bold",
        suggestions: "Suggestions",
      },
      image: {
        drop: "Drop an image here, click to choose a file, or paste",
        formats: "SVG, PNG, JPG or WebP, up to 2 MB. Screenshots and SVG code can be pasted too.",
        where: "Where to find icons: ",
        copySvg: " (press Copy SVG, then paste here)",
        dropHere: "Drop to import",
        badType: "This format does not work. Use SVG, PNG, JPG or WebP.",
        tooBig: "The image is over 2 MB. Make it smaller and try again.",
        unreadable: "Could not read this image. The file may be damaged.",
        remote: "Could not read this web image. Save it to your computer first, then drop it here.",
        full: (max) => `Up to ${max} images can be kept. Delete one under My images first.`,
        saveFailed: "Could not save it. Storage may be full.",
        auto: { svg: "SVG icon: follows the theme, so it reads on dark and light", alpha: "Transparent background: follows the theme as a silhouette", photo: "Photo: original colors, cropped to a circle" },
        display: "Show as",
        mono: "Follow the theme (one color)",
        color: "Original colors",
        shape: "Shape",
        shapes: { none: "As is", circle: "Circle", round: "Rounded" },
        zoom: "Zoom",
        dragTip: "Drag to move, scroll to zoom",
        use: (page) => `Use on ${page}`,
        cancel: "Cancel",
        library: "My images",
        libraryHint: "Shared by all pages",
        remove: "Delete this image",
        removed: "Image deleted",
        removedUsed: (pages) => `Deleted. ${pages.join(", ")} went back to the default icon`,
        undo: "Undo",
        mine: "My image",
      },
    },
  },
  page: {
    agents: "AI Agent",
    todo: "Todos",
    music: "Music",
    calendar: "Calendar",
    clipboard: "Clipboard",
    shelf: "File shelf",
    screenshots: "Screenshots",
    timer: "Timer",
    qq: "Messages",
    translation: "Translate",
  },
  sideDocks: {
    title: "Screen side docks",
    hint: "Drag tall list pages such as Todos, Clipboard, and File shelf to the left or right screen edge so the top island stays clean. Dropping onto a disabled side enables it automatically.",
    openAria: "Open side dock",
    pinAria: "Pin open",
    closeAria: "Collapse side dock",
    openSettingsAria: "Configure side docks",
    emptyHint: "No pages assigned to this side yet. Drag any page here in Settings.",
    autoSplit: "Recommended split",
    allToTop: "Move all to top",
    reset: "Reset defaults",
    zones: {
      left: "Left dock",
      top: "Top island",
      right: "Right dock",
      hidden: "Hidden",
      enabled: "On",
      disabled: "Off",
      dropHint: "Drop pages here",
      hiddenHint: "Drop here to hide while keeping background features running",
      centerTitle: "Drag pages across zones",
      centerHint: "Drag inside a zone to reorder, or drop onto a side dock to enable it automatically",
    },
    monitor: {
      title: "Edge position, size, and displays",
      hint: "Drag the edge handle vertically to position it, or drag the drawer borders to resize. Shared seams between displays are never triggered.",
      single: "Single display",
      dual: "Dual displays",
      secondary: "Secondary",
      seamBlocked: "Seam blocked",
      primaryHint: "Drag handle or drawer edges",
      compact: "Compact",
      standard: "Standard",
      wide: "Wide",
      previewOpen: "Live preview",
      previewClose: "Stop preview",
      readout: (edge, percent, width, height) => `${edge} · ${percent}% along edge · ${width} × ${height}px · Outer edges only`,
    },
    mode: {
      title: "Expand style & drawer behavior",
      hint: "By default, both the quick strip and drawer open together on trigger.",
      threeAuto: "3-stage · Auto drawer",
      threeAutoDesc: "Open quick strip and drawer together in one step",
      threeHover: "3-stage · Hover icon",
      threeHoverDesc: "Open quick strip first, expand drawer on icon hover",
      twoDirect: "2-stage · Direct drawer",
      twoDirectDesc: "Skip quick strip and open the drawer directly from the edge",
      recommended: "Recommended",
    },
    nav: {
      title: "Quick strip & drawer header",
      full: "Full dual navigation",
      fullDesc: "Labeled quick strip plus full tabs in drawer header",
      minimal: "Slim strip · Minimal header",
      minimalDesc: "Icon-only strip switches pages; hide duplicate drawer tabs",
      icons: "Compact icon tabs",
      iconsDesc: "Icon-only drawer tabs to fit more pages",
    },
    radius: {
      title: "Corner radius",
      summary: (outer, inner, handle) => `Outer ${outer}px · Inner ${inner}px · Handle ${handle}px`,
      sharp: "Crisp 8px",
      balanced: "Balanced 14px",
      soft: "Soft 18px",
      custom: "Custom",
    },
    appearance: {
      title: "Appearance & material",
      hint: "Inherits the main island's colors, material, and opacity by default. Switch to Custom only if you want a separate look.",
      follow: "Follow island",
      custom: "Custom",
      followSummary: (tone, material, opacity) => `Synced with island: ${tone} · ${material} · ${opacity}% opacity (adjust under Appearance)`,
      glassOpacity: "Glass surface opacity",
    },
    fine: {
      title: "Advanced interaction & handle",
      summary: (trigger, handleW, handleH, density) => `${trigger} · Handle ${handleW}×${handleH}px · ${density}`,
      trigger: "Trigger",
      hover: "Hover",
      click: "Click only",
      hoverDelay: "Hover delay",
      leaveDelay: "Auto-collapse delay",
      drawerWidth: "Drawer width",
      drawerHeight: "Drawer height",
      gap: "Strip gap",
      handleWidth: "Handle width",
      handleHeight: "Handle height",
      handleOpacity: "Idle handle opacity",
      handleDot: "Handle status dot",
      theme: "Theme",
      material: "Material",
      follow: "Follow island",
      dark: "Dark",
      light: "Light",
      glass: "Liquid glass",
      solid: "Solid",
      surfaceOpacity: "Surface opacity",
      density: "List density",
      cozy: "Cozy",
      compact: "Compact",
      stripStyle: "Quick strip style",
      stripLabel: "Icon + label",
      stripIcon: "Icon only",
      dragDropShelf: "Open file shelf on edge drag",
      hideInFullscreen: "Hide in fullscreen / game mode",
    },
  },
};
