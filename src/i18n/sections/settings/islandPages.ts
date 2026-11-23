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
};
