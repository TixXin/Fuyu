import "../../src/styles/tokens.css";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { I18nProvider } from "../../src/i18n";
import type { MediaState } from "../../src/features/media/api";
import { DEFAULT_MEDIA_STATE } from "../../src/features/media/mediaState";
import { MusicPlayerPanel } from "../../src/features/media/MusicPlayerPanel";
import { DEFAULT_SETTINGS } from "../../src/features/appearance/settingsDefaults";
import type { LyricsIntro } from "../../src/features/media/lyrics/lyricsSettings";
import { useIslandLyrics } from "../../src/windows/island/useIslandLyrics";
import { MediaWaveform } from "../../src/features/media/MediaWaveform";
import { coverAccentVariables, useCoverColor } from "../../src/features/media/useCoverColor";
import { contrastRatio, rgbToHex } from "../../src/features/media/coverColor";
import { runLyricsHandoffChecks } from "./lyrics-handoff-checks";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const LRC = [
  "[ar:周杰伦]",
  "[00:01.00]故事的小黄花",
  "[00:05.00]从出生那年就飘着",
  "[00:09.00]童年的荡秋千 随记忆一直晃到现在 这一句特别特别长长到一行放不下需要省略号来收尾才行",
  "[00:13.00]",
  "[00:15.00]刮风这天",
].join("\n");
const queries: Array<Record<string, unknown>> = [];
mockIPC((command, payload) => {
  if (command !== "get_lyrics") return null;
  const query = (payload as { query: Record<string, unknown> }).query;
  queries.push(query);
  if (query.title === "Yesterday") return { source: "kugou", lrc: ["[00:01.00]Oh I believe", "[00:05.00]in yesterday"].join("\n"), translation: "[00:01.00]哦 我相信" };
  if (query.title === "Believe") return { source: "kugou", lrc: "[00:01.00]<00:01.00>Oh <00:01.30>I <00:01.70>believe<00:03.00>\n[00:04.00]in yesterday" };
  return query.title === "晴天" ? { source: "lrclib", lrc: LRC } : null;
});

const fixture = document.getElementById("fixture")!;
const results = document.getElementById("results")!;
const messages: string[] = [];
const root = createRoot(fixture);
const ONLINE = { lyricsFolder: "", lyricsOnline: true, lyricsOffsetMs: 0 };
let settingsOpened = 0;
const aligned: number[] = [];

function track(title: string, positionMs: number, playing = false): MediaState {
  return {
    ...DEFAULT_MEDIA_STATE, available: true, title, artist: "周杰伦", album: "叶惠美",
    durationMs: 269_000, positionMs, updatedAt: Date.now(), playbackStatus: playing ? "playing" : "paused",
  };
}

async function render(mediaState: MediaState, lyricsSettings: typeof ONLINE | undefined = ONLINE) {
  await act(async () => {
    root.render(
      <StrictMode><I18nProvider>
        <MusicPlayerPanel mediaState={mediaState} isTrackChanging={false} commandError={null} onOpenSettings={() => { settingsOpened += 1; }}
          onPlayPause={() => {}} onNext={() => {}} onPrevious={() => {}} lyricsSettings={lyricsSettings} onAlignLyrics={(ms) => aligned.push(ms)} />
      </I18nProvider></StrictMode>,
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

function IslandLine({ mediaState, intro }: { mediaState: MediaState; intro: LyricsIntro }) {
  const settings = { ...DEFAULT_SETTINGS, musicEnabled: true, lyricsOnIsland: true, lyricsOnline: true, lyricsIntro: intro };
  const { lyricLine } = useIslandLyrics(settings, mediaState, { page: "music", barShown: true });
  return <span className="island-line" data-index={lyricLine?.index ?? ""} data-lyrics={lyricLine ? "on" : ""}>{lyricLine?.text ?? "待办"}</span>;
}

async function renderIsland(mediaState: MediaState, intro: LyricsIntro) {
  await act(async () => {
    root.render(<StrictMode><I18nProvider><IslandLine mediaState={mediaState} intro={intro} /></I18nProvider></StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

function paintedCover(fills: Array<[string, number]>) {
  const canvas = document.createElement("canvas");
  canvas.width = 60;
  canvas.height = 60;
  const context = canvas.getContext("2d")!;
  let y = 0;
  for (const [fill, rows] of fills) {
    context.fillStyle = fill;
    context.fillRect(0, y, 60, rows);
    y += rows;
  }
  return canvas.toDataURL("image/png");
}

const COVERS = { dark: paintedCover([["#142850", 34], ["#050505", 20], ["#ffffff", 6]]), light: paintedCover([["#f6e7a0", 40], ["#ffffff", 20]]) };

function CoverStage({ name, withPanel }: { name: keyof typeof COVERS; withPanel?: MediaState }) {
  const color = useCoverColor(COVERS[name], true);
  return (
    <main className="stage cover-color" data-cover={name} data-color={color ?? ""} style={coverAccentVariables(color, "#000000", null)}>
      {withPanel ? <MusicPlayerPanel mediaState={withPanel} isTrackChanging={false} commandError={null} onOpenSettings={() => {}} onPlayPause={() => {}} onNext={() => {}} onPrevious={() => {}} />
        : <MediaWaveform playing={false} audioPeak={0} />}
      <span className="cover-probe" style={{ color: "var(--cover-accent)" }}>{name === "dark" ? "深色封面" : "浅色封面"}</span>
    </main>
  );
}

async function renderCovers(withPanel?: MediaState) {
  await act(async () => {
    root.render(<StrictMode><I18nProvider><CoverStage name="dark" withPanel={withPanel} /><CoverStage name="light" /></I18nProvider></StrictMode>);
  });
  for (let tries = 0; tries < 50 && [...document.querySelectorAll<HTMLElement>("[data-cover]")].some((stage) => !stage.dataset.color); tries += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  }
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1_100)); });
}

const cssHex = (value: string) => rgbToHex(value.match(/[\d.]+/g)!.slice(0, 3).map(Number) as [number, number, number]);

function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}

const view = () => document.querySelector<HTMLElement>(".lyrics-view");
const lines = () => [...document.querySelectorAll<HTMLElement>(".lyrics-view__line")].map((line) => line.textContent);

try {
  await render(track("晴天", 6000));
  const wave = () => document.querySelector<HTMLElement>(".media-waveform")!;
  const progress = () => document.querySelector<HTMLElement>(".music-progress");
  check(view() && !wave() && progress() && view()!.getBoundingClientRect().bottom <= progress()!.getBoundingClientRect().top
    && progress()!.textContent === "0:064:29", "找到歌词时歌词在上、进度条在下（播放器报告了进度），不再显示波形");
  check(lines().join("|") === "故事的小黄花|从出生那年就飘着|童年的荡秋千 随记忆一直晃到现在 这一句特别特别长长到一行放不下需要省略号来收尾才行", "当前句在中间，上一句和下一句在两边");
  const query = queries[queries.length - 1];
  check(query.title === "晴天" && query.artist === "周杰伦" && query.album === "叶惠美" && query.durationMs === 269_000 && query.online === true, "按歌名、歌手、专辑和时长查找");
  const current = document.querySelector<HTMLElement>(".lyrics-view__line--current")!;
  check(getComputedStyle(current).fontSize === "15px" && getComputedStyle(document.querySelector(".lyrics-view__line--side")!).fontSize === "12px", "当前句更大更亮");

  await render(track("晴天", 10_000));
  const long = document.querySelector<HTMLElement>(".lyrics-view__line--current")!;
  const longBox = long.getBoundingClientRect();
  check(longBox.height > 25 && longBox.height < 42 && long.scrollHeight <= long.clientHeight + 1 && fixture.scrollWidth <= fixture.clientWidth,
    "长句换成两行完整显示，不再省略，也不撑宽面板");
  const controls = document.querySelector<HTMLElement>(".music-player__controls")!.getBoundingClientRect();
  check(controls.bottom <= document.querySelector(".music-player")!.getBoundingClientRect().bottom && progress()!.getBoundingClientRect().bottom <= controls.top,
    "长句换行后进度条和播放按钮仍完整放在面板里");

  await render(track("晴天", 13_500));
  check(lines()[1] === "♪", "间奏的空行显示音符");
  await render(track("晴天", 500));
  check(lines().join("|") === "|♪|故事的小黄花", "前奏时中间显示音符，第一句在下面等着");
  await render(track("晴天", 500), { ...ONLINE, lyricsIntro: "song" } as typeof ONLINE);
  check(lines().join("|") === "|晴天 - 周杰伦|故事的小黄花", "前奏选「歌名」时音乐页中间显示歌名，第一句在下面等着");

  const islandLine = () => document.querySelector<HTMLElement>(".island-line")!;
  await renderIsland(track("晴天", 300, true), "todo");
  check(islandLine().textContent === "待办", "前奏默认（待办）时收起的岛照常显示待办");
  await renderIsland(track("晴天", 300, true), "song");
  check(islandLine().textContent === "晴天 - 周杰伦", "前奏选「歌名」时收起的岛显示歌名 - 歌手");
  await renderIsland(track("晴天", 300, true), "note");
  check(islandLine().textContent === "♪" && islandLine().dataset.index === "-3", "前奏选「音符」时收起的岛显示音符");
  await renderIsland(track("晴天", 600, true), "note");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 650)); });
  check(islandLine().textContent === "故事的小黄花" && islandLine().dataset.index === "0", "到第一句时收起的岛切到歌词（换了 key，走淡入动画）");
  await renderIsland(track("晴天", 300), "song");
  check(islandLine().textContent === "待办", "暂停时前奏不显示歌名");
  await renderIsland(track("晴天", 13_500, true), "note");
  check(islandLine().textContent === "♪", "间奏的空白行按「前奏时显示」显示音符，不退回 Agent 标题");
  await renderIsland(track("晴天", 13_500, true), "todo");
  check(islandLine().textContent === "待办" && islandLine().dataset.lyrics === "on", "间奏选「待办」时显示待办，但仍算在放歌词，Agent 只插话不占住");
  await renderIsland({ ...track("晴天", 28_500, true), positionEstimate: "timed" }, "song");
  check(islandLine().textContent === "晴天 - 周杰伦", "最后一句过后按「前奏时显示」显示歌名");

  await render(track("晴天", 6000), { ...ONLINE, lyricsOffsetMs: 2000 });
  check(lines()[1] === "故事的小黄花", "推后 2 秒时仍显示上一句");
  await render(track("晴天", 4500, true));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
  check(lines()[1] === "从出生那年就飘着", "播放时在两次读取之间按时间往下走");

  const before = queries.length;
  await render(track("七里香", 6000));
  check(!view() && Math.abs(wave().getBoundingClientRect().height - 64) < 1 && wave().closest(".music-player__stage") && queries.length === before + 1, "找不到歌词时歌词的位置显示波形");
  const page = document.querySelector<HTMLElement>(".music-player")!;
  check(getComputedStyle(page).backgroundImage === "none" && getComputedStyle(page).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(page).boxShadow === "none",
    "音乐页直接放在岛上，没有自己的卡片底色和阴影（C17）");
  const hint = () => document.querySelector<HTMLButtonElement>(".music-player__lyrics-hint");
  const panel = document.querySelector(".music-player")!.getBoundingClientRect();
  check(hint()?.textContent === "没找到歌词 · 试试酷狗和网易云" && hint()!.getBoundingClientRect().left >= panel.left && hint()!.getBoundingClientRect().right <= panel.right,
    "中文歌只查了 LRCLIB 没找到时，右上角提示可以开启酷狗和网易云");
  settingsOpened = 0;
  await act(async () => hint()!.click());
  check(settingsOpened === 1, "点提示打开音乐设置");
  await render(track("稻香", 6000), { lyricsFolder: "", lyricsOnline: false, lyricsOffsetMs: 0 });
  check(!view() && queries.length === before + 1, "没设歌词文件夹也没开在线查找时不去查");
  check(!hint(), "没开在线查找时不提示");
  await render(track("七里香", 6000), { ...ONLINE, lyricsChinese: true } as typeof ONLINE);
  check(!view() && !hint(), "已经开着酷狗和网易云还找不到时不提示");

  localStorage.removeItem("fuyu-lyrics-offsets");
  await render(track("Yesterday", 2000), { ...ONLINE, lyricsChinese: true } as typeof ONLINE);
  const yesterday = queries[queries.length - 1];
  check(yesterday.chinese === true && yesterday.trackId === null, "打开中文来源时一起查酷狗和网易云");
  check(lines().join("|") === "|Oh I believe|哦 我相信" && document.querySelector(".lyrics-view__line--translation"), "有翻译时，当前句下面显示翻译");
  const offsetButtons = [...document.querySelectorAll<HTMLButtonElement>(".lyrics-offset button")];
  check(offsetButtons.length === 3 && offsetButtons[1].textContent === "0s" && offsetButtons[1].disabled, "音乐页右上角有这首歌的提前、推后按钮");
  await act(async () => offsetButtons[2].click());
  await act(async () => offsetButtons[2].click());
  await act(async () => offsetButtons[2].click());
  check(offsetButtons[1].textContent === "+1.5s" && lines()[1] === "♪", "推后 1.5 秒后，2 秒时还没到第一句");
  check(JSON.parse(localStorage.getItem("fuyu-lyrics-offsets") ?? "{}")[Object.keys(JSON.parse(localStorage.getItem("fuyu-lyrics-offsets") ?? "{}"))[0]] === 1500, "这首歌的调整按歌存下来");
  await act(async () => offsetButtons[1].click());
  check(offsetButtons[1].textContent === "0s" && lines()[1] === "Oh I believe", "点中间的数字恢复为 0");
  localStorage.removeItem("fuyu-lyrics-offsets");

  await render(track("Believe", 1500));
  const words = () => [...document.querySelectorAll<HTMLElement>(".karaoke__word")];
  const fillX = (word: HTMLElement) => getComputedStyle(word).backgroundPosition.split(" ")[0];
  check(words().map((word) => word.textContent).join("|") === "Oh |I |believe" && lines()[1] === "Oh I believe" && lines()[2] === "in yesterday",
    "逐字时间的歌词按字分开，整句文字不变");
  check(parseFloat(fillX(words()[0])) === 0 && fillX(words()[2]) === "100%" && fillX(words()[1]) !== fillX(words()[0]) && fillX(words()[1]) !== "100%",
    "唱过的字亮、正在唱的字亮到一半、没唱的字暗");
  check(words().every((word) => getComputedStyle(word).animationPlayState === "paused"), "暂停时逐字填充也停住");
  await render(track("Believe", 1500, true));
  check(words().every((word) => getComputedStyle(word).animationPlayState === "running"), "播放时逐字填充往前走");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
  check(fillX(words()[2]) !== "100%", "到点后下一个字开始变亮");
  await render(track("Believe", 4500));
  check(words().length === 0 && lines()[1] === "in yesterday", "没有逐字时间的句子照常整句显示");

  const untimed = (estimate: "timed" | "unsure", sourceApp: string): MediaState => ({ ...track("晴天", 6000), durationMs: 0, positionEstimate: estimate, sourceApp });
  await render(untimed("unsure", "cloudmusic.exe"));
  const estimate = () => document.querySelector<HTMLElement>(".music-player__estimate");
  const picks = () => [...document.querySelectorAll<HTMLButtonElement>(".lyrics-view__pick")];
  check(!progress() && estimate()?.textContent?.startsWith("岛屿没看到这首歌开头") && estimate()!.querySelector(".music-player__estimate-link")?.textContent === "装 InfLink-rs 精确同步",
    "估算进度且可能没对齐时提示点一句对齐；网易云还提示装 InfLink-rs");
  check(picks().length === 3 && picks()[0].getAttribute("aria-label") === "从这一句对齐歌词：故事的小黄花", "估算进度时三行歌词都能点");
  aligned.length = 0;
  await act(async () => picks()[0].click());
  check(aligned.length === 1 && aligned[0] === 1000, "点上一句，按这一句的开始时间对齐");
  await render(untimed("timed", "Spotify.exe"));
  check(estimate()?.textContent?.startsWith("播放器不报告进度") && !estimate()!.querySelector(".music-player__estimate-link"), "不是网易云时不提 InfLink-rs");
  await render(track("晴天", 6000));
  check(picks().length === 0 && !estimate(), "播放器报告进度时歌词不能点，也没有估算提示");

  await renderCovers(track("七里香", 6000));
  const stage = (name: string) => document.querySelector<HTMLElement>(`[data-cover="${name}"]`)!;
  const probe = (name: string) => cssHex(getComputedStyle(stage(name).querySelector(".cover-probe")!).color);
  check(stage("dark").dataset.color && stage("light").dataset.color && stage("dark").dataset.color !== stage("light").dataset.color, "跟随封面颜色：深色、浅色封面各取出一个主色");
  const darkHue = stage("dark").dataset.color!;
  check(parseInt(darkHue.slice(5, 7), 16) > parseInt(darkHue.slice(1, 3), 16), "深色封面取到的是蓝色，不是黑白");
  check(contrastRatio(probe("dark"), "#000000") >= 3 && contrastRatio(probe("light"), "#000000") >= 3, "取出的颜色在深色岛上对比度 ≥ 3:1");
  check(getComputedStyle(stage("dark").querySelector(".music-player")!, "::before").content !== "none", "音乐页有封面颜色的光晕");
  check(getComputedStyle(stage("dark")).transitionProperty.includes("--cover-accent-dark"), "换歌时颜色渐变");
  stage("dark").classList.add("island-light");
  stage("light").classList.add("island-light");
  check(contrastRatio(probe("dark"), "#f2f2f5") >= 3 && contrastRatio(probe("light"), "#f2f2f5") >= 3, "切到浅色岛时换成浅色岛的那一份，对比度 ≥ 3:1");
  stage("dark").classList.remove("island-light");
  stage("light").classList.remove("island-light");
  await renderCovers();
  check(cssHex(getComputedStyle(stage("light").querySelector(".media-waveform")!).color) === probe("light"), "波形用封面颜色");

  await runLyricsHandoffChecks(root, track("Believe", 1000, true), check);

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  results.dataset.result = "failed";
}
