export type VoiceInputText = {
  listening: string;
  transcribing: string;
  nothingHeard: string;
  editLabel: string;
  stop: string;
  cancel: string;
  saveTodo: string;
  saveNote: string;
  copy: string;
  close: string;
  savedTodo: string;
  savedNote: string;
  todosOff: string;
  copied: string;
  openSettings: string;
  openPrivacy: string;
  settings: {
    title: string;
    shortcut: string;
    shortcutHint: string;
    shortcutOff: string;
    setShortcut: string;
    turnOffShortcut: string;
    shortcutProblem: Record<"invalid" | "taken", string>;
    shortcutInvalidMac: string;
    modelTitle: string;
    modelName: string;
    modelMissing: (size: string) => string;
    unsupported: string;
    modelReady: (size: string) => string;
    download: string;
    downloading: (percent: number, source: string) => string;
    unpacking: string;
    cancelDownload: string;
    deleteModel: string;
    privacy: string;
    languages: string;
  };
};

export const zhCN: VoiceInputText = {
  listening: "正在听",
  transcribing: "正在识别…",
  nothingHeard: "没听清，再说一次试试",
  editLabel: "识别结果，可以修改",
  stop: "结束并识别",
  cancel: "取消",
  saveTodo: "存为待办",
  saveNote: "追加到今天的笔记",
  copy: "复制",
  close: "关闭",
  savedTodo: "已存为待办",
  savedNote: "已追加到今天的笔记",
  todosOff: "待办已关闭",
  copied: "已复制",
  openSettings: "打开设置",
  openPrivacy: "打开隐私设置",
  settings: {
    title: "语音输入",
    shortcut: "开始 / 结束录音",
    shortcutHint: "按一下开始录音，再按一下结束并识别；岛上也有结束按钮。每次最长 2 分钟。",
    shortcutOff: "未设置",
    setShortcut: "设置快捷键",
    turnOffShortcut: "关闭快捷键",
    shortcutProblem: { invalid: "这个快捷键用不了，换一个带修饰键的组合。", taken: "这个快捷键被别的程序占用了，换一个。" },
    shortcutInvalidMac: "这个快捷键在 Mac 上用不了，换一个带 Control、Option 或 Command 的组合。",
    modelTitle: "语音模型",
    modelName: "SenseVoice-Small 模型和识别组件",
    modelMissing: (size) => `还没下载，用之前要在这里下载约 ${size}`,
    unsupported: "这个系统上用不了语音输入。",
    modelReady: (size) => `已下载，占用 ${size}`,
    download: "下载",
    downloading: (percent, source) => `正在下载 ${percent}%（${source}）`,
    unpacking: "正在解压…",
    cancelDownload: "取消下载",
    deleteModel: "删除模型",
    privacy: "语音只在这台电脑上识别：录音只留在内存里，识别完就丢掉，不会上传。唯一要联网的是你在这里点「下载」的时候：下载模型和识别组件 sherpa-onnx（GitHub，连不上时换国内镜像 ghfast.top、gh-proxy.com），下载后会校验文件。",
    languages: "能听懂普通话、粤语、英语、日语和韩语，自动判断语言。",
  },
};

export const en: VoiceInputText = {
  listening: "Listening",
  transcribing: "Transcribing…",
  nothingHeard: "Didn't catch that; try again",
  editLabel: "Recognized text, editable",
  stop: "Stop and transcribe",
  cancel: "Cancel",
  saveTodo: "Save as a todo",
  saveNote: "Add to today's note",
  copy: "Copy",
  close: "Close",
  savedTodo: "Saved as a todo",
  savedNote: "Added to today's note",
  todosOff: "Todos are turned off",
  copied: "Copied",
  openSettings: "Open Settings",
  openPrivacy: "Open privacy settings",
  settings: {
    title: "Voice input",
    shortcut: "Start / stop recording",
    shortcutHint: "Press once to start, again to stop and transcribe; the island has a stop button too. Up to 2 minutes each time.",
    shortcutOff: "Not set",
    setShortcut: "Set shortcut",
    turnOffShortcut: "Turn off the shortcut",
    shortcutProblem: { invalid: "This shortcut cannot be used; pick one with a modifier key.", taken: "Another app is using this shortcut; pick another." },
    shortcutInvalidMac: "This shortcut cannot be used on a Mac; pick one with Control, Option or Command.",
    modelTitle: "Speech model",
    modelName: "SenseVoice-Small model and recognizer",
    modelMissing: (size) => `Not downloaded; download about ${size} here before using it`,
    unsupported: "Voice input is not available on this system.",
    modelReady: (size) => `Downloaded, ${size} on disk`,
    download: "Download",
    downloading: (percent, source) => `Downloading ${percent}% (${source})`,
    unpacking: "Unpacking…",
    cancelDownload: "Cancel download",
    deleteModel: "Delete model",
    privacy: "Speech is recognized on this computer only: the audio stays in memory, is dropped after recognition and is never uploaded. The only time it goes online is when you press Download here, to fetch the model and the sherpa-onnx recognizer (from GitHub, or the ghfast.top and gh-proxy.com mirrors when GitHub is unreachable), and the files are verified.",
    languages: "Understands Mandarin, Cantonese, English, Japanese and Korean, and picks the language by itself.",
  },
};
