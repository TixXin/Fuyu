---
name: fuyu-motion
description: ALWAYS invoke BEFORE adding or changing motion in the Fuyu UI - a CSS transition, animation or @keyframes, a duration or easing curve, a TS timer that waits for an animation to end, the island open/close presets, or prefers-reduced-motion handling - including a one-line duration or curve tweak. Do NOT write transition, animation, cubic-bezier or @keyframes without loading this skill first. Do NOT invoke for colour, layout or copy changes that touch no motion, or for promo videos (fuyu-video). 触发：加个动画、加过渡、淡入淡出、弹出来要有动画、改一下动画、动画太慢、动画太快、调时长、换曲线、缓动、回弹、Q 弹、开合动画、加 keyframes、呼吸灯、转圈、减少动画、动画发虚、文字抖。
---

# 给界面加或改动画

规矩本体在 `docs/design/motion.md`，这里只排顺序和坑，档位的值和「适用 / 不适用」去那里查，不在这里抄。

做完的标准：带文字的东西没有位移、缩放和 `transform` 过渡；曲线和时长都是 motion.md 里的档位；新 `animation` 在同一个文件里有 `@media (prefers-reduced-motion: reduce)`；改到岛外壳的，开合在 560ms 内结束。最常漏的是减少动画那段和文字跟着外壳一起动。

## 顺序

1. **先按要做的事读 motion.md 的那一节**，每节末尾的「适用 / 不适用」决定这条规矩管不管你手上的元素：
   | 要做的事 | 读 |
   |---|---|
   | 某个东西该不该动、能怎么动 | 「哪里可以动」「底线」 |
   | 挑曲线、`linear`、回弹 | 「曲线」 |
   | 挑时长、TS 里等动画结束的定时器 | 「时长」 |
   | 循环动画、减少动画 | 「底线」第 4 条、「减少动画」 |
   | 岛外壳、换边、任何同时改原生窗口大小的动画 | 「和原生窗口改尺寸的配合」 |
2. **先定能不能动，再定怎么动**。有文字的层只淡入淡出：位移会让文字在最后一帧取整到不同像素行，`transform` 过渡会让文字发虚。要做「滑入」「弹一下」的，改成外壳或无文字的装饰层动、文字淡入。
3. **曲线和时长写 token**（`var(--motion-ease)`、`var(--motion-base)` 这类，名字和用途见 motion.md「曲线」「时长」两张表），不写 `cubic-bezier(...)`、`ease` 关键字或表外的毫秒数：档位就是为收掉散落的值才定的。变量在 `src/styles/tokens.css`，TS 里读 `src/lib/theme/motionTokens.ts`，不在 TS 里另写一份。从无到有的进场（不论是面板还是一行）用进场那条曲线，常驻元素的变化用默认那条。文件里已有的旧写法不顺手改：并进档位会改观感，由专门的合并任务出对比页后统一改。
4. **新 `animation` 在同一个文件里写减少动画**：`@media (prefers-reduced-motion: reduce)` 里停掉或换成不动的样子，`tests/unit/reduced-motion.test.mjs` 会检查。`transition` 不用自己写，由 `src/styles/base.css` 统一处理，现状和目标见 motion.md「减少动画」。TS 里按减少动画分支用 `src/lib/theme/useReducedMotion.ts`。
5. **岛外壳的开合不进档位**：调预设改 `src/lib/theme/islandMotion.ts`，弹簧和 Q 弹的 `linear()` 曲线在 `src/lib/theme/motionCurves.ts`；节奏、预设和 Q 弹的合格标准见 `docs/design/island.md`「灵动岛视觉规范」里「展开、收起的节奏」「开合动画可选」「Q 弹」三条，调参可以在 `docs/investigations/island-motion-lab.html` 里先试。改完对一遍 motion.md「和原生窗口改尺寸的配合」的两个数。
6. **验证**：跑根 `AGENTS.md`「验证」表要求的；改了岛、消息、设置窗口的界面再跑 `pnpm test:regression`，动画观感本该变时先加载 `fuyu-testing` 再更新快照。要看真岛的开合，用户开着 `pnpm tauri dev` 时可以用 `pnpm lab` 让岛展开收起（`docs/features/island-lab.md`）。

## 坑

- **外壳过渡超过 560ms 会被切掉**：原生侧缩窗口前固定等 600ms（`src-tauri/src/island/geometry.rs` 的 `STAGE_SHRINK_DELAY`），收起动画没跑完窗口就变小了。拉长预设时两个数一起看。
- **回弹往外冲会被窗口边缘截掉**：窗口只比岛高一点，Q 弹的高度回弹只往回不往外，加新回弹也照此办。
- **Mac 上过渡失效**：WebKit 里一个元素的 `transition` 列表只要有一个 `@property` 注册的变量，普通属性的过渡就全不生效。同一元素要过渡几样，都改成过渡注册变量，在 Playwright 的 WebKit 里逐帧量过再交；Windows 的 WebView2 上看不出这个问题。
- **`will-change` 和 `forwards` 不常驻**：残留的合成层会让文字一直发虚，进场用 `animation-fill-mode: backwards`。
- **不加装饰性的无限循环、错开出场、按下缩放、侧边滑入**：用户定的，在常驻的小岛上显得拖沓。循环只给表示状态的东西，状态结束就停。
- **跟手的拖动不加过渡**：截图选区、拖岛这类跟着鼠标走，加了会拖后腿。
