export type SettingsMusicBarText = {
  title: string;
  wave: string;
  waveHint: string;
  taskbar: {
    title: string;
    show: string;
    showHint: string;
    content: string;
    contentOptions: { both: string; lyrics: string; song: string };
    idle: string;
    idleOptions: { hide: string; icon: string };
  };
};

export const zhCN: SettingsMusicBarText = {
  title: "岛屿",
  wave: "在收起的岛上显示音乐波形",
  waveHint: "收起的岛右侧跳动的竖条，点它打开音乐页。和 外观 → 收起条 里「音乐」的显示开关是同一个，位置也在那里调。",
  taskbar: {
    title: "任务栏",
    show: "在任务栏显示歌词",
    showHint: "在 Windows 11 任务栏的空白处放一条歌词：封面、当前一句歌词和播放按钮，点它打开岛的音乐页。岛也吸附在任务栏时，歌词条排在岛的左边。",
    content: "显示内容",
    contentOptions: { both: "歌词和歌名", lyrics: "只显示歌词", song: "只显示歌名" },
    idle: "不在播放时",
    idleOptions: { hide: "隐藏", icon: "只显示图标" },
  },
};

export const en: SettingsMusicBarText = {
  title: "Island",
  wave: "Show the music wave on the collapsed island",
  waveHint: "The moving bars on the collapsed island, which open the music page. The same switch as Music under Appearance → Collapsed bar, where it can also be moved.",
  taskbar: {
    title: "Taskbar",
    show: "Show lyrics on the taskbar",
    showHint: "Puts a lyrics strip in the free space of the Windows 11 taskbar: the cover, the current line and playback buttons. Click it to open the island's music page. When the island is docked to the taskbar too, the strip sits to its left.",
    content: "Show",
    contentOptions: { both: "Lyrics and song", lyrics: "Lyrics only", song: "Song only" },
    idle: "When nothing plays",
    idleOptions: { hide: "Hide", icon: "Icon only" },
  },
};
