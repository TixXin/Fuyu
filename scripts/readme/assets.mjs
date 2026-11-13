import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "..", "docs", "assets", "readme");
const address = JSON.parse(readFileSync(path.join(here, "address-outline.json"), "utf8"));

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', sans-serif";
const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Mono', Consolas, 'Liberation Mono', monospace";
const INK = "#f8f6f0";
const ISLAND = "#030303";
const RIM = "#4e5358";
const LINE = "#8b949e";
const ACCENT = "#74d6ff";
const ON_ACCENT = "#06202c";
const MINT = "#4ade9c";
const WAVE = "#9fe8c5";
const PEN = "#4795c9";

const ISLANDS = {
  "island-zh.svg": { label: "浮屿 Fuyu：屏幕顶上的一座小岛，旁边手写着官网 https://fuyu.ing", word: "浮屿 Fuyu", chip: "征集中", chipWidth: 54, call: "给浮屿画一个 Logo", callWidth: 132 },
  "island-en.svg": { label: "Fuyu, an island at the top of your screen, with the website https://fuyu.ing handwritten beside it", word: "Fuyu 浮屿", chip: "Open", chipWidth: 48, call: "Draw Fuyu a logo", callWidth: 122 },
};
const DOWNLOADS = {
  "download-windows.svg": { label: "Download for Windows (x64)", name: "Windows", nameWidth: 68, tag: "x64", tagWidth: 20 },
  "download-macos.svg": { label: "Download for macOS (Apple silicon, arm64)", name: "macOS", nameWidth: 52, tag: "arm64", tagWidth: 33 },
};

const n = (value) => Number(value.toFixed(3)).toString().replace(/^(-?)0\./, "$1.");
const px = (value) => (value === 0 ? "0" : `${n(value)}px`);

function capFill(L, H, R, E) {
  return `M${n(-L - E + 0.5)} 0v1a${n(E - 0.5)} ${n(E - 0.5)} 0 0 1 ${n(E - 0.5)} ${n(E - 0.5)}V${n(H - R)}a${R} ${R} 0 0 0 ${R} ${R}h1V0z`;
}

function capLine(L, H, R, E) {
  return `M${n(-L - E + 0.5)} .5a${E} ${E} 0 0 1 ${E} ${E}V${n(H - R)}a${n(R - 0.5)} ${n(R - 0.5)} 0 0 0 ${n(R - 0.5)} ${n(R - 0.5)}h1`;
}

function shell({ L, H, R, E }, pad) {
  const mid = 2 * (L - R);
  const cap = [`<path fill="${ISLAND}" d="${capFill(L, H, R, E)}"/>`, `<path fill="none" stroke="${RIM}" d="${capLine(L, H, R, E)}"/>`];
  return [
    `<g class="capl">`,
    ...cap.map((line) => `  ${line}`),
    `</g>`,
    `<g class="capr">`,
    `  <g transform="scale(-1 1)">`,
    ...cap.map((line) => `    ${line}`),
    `  </g>`,
    `</g>`,
    `<g class="mid">`,
    `  <rect x="${n(-mid / 2)}" width="${n(mid)}" height="${H}" fill="${ISLAND}"/>`,
    `  <rect x="${n(-mid / 2)}" y="${H - 1}" width="${n(mid)}" height="1" fill="${RIM}"/>`,
    `</g>`,
  ].join(`\n${pad}`);
}

function defs(width) {
  return `<defs>
    <linearGradient id="edge" x2="${width}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${LINE}" stop-opacity="0"/>
      <stop offset=".14" stop-color="${LINE}" stop-opacity=".55"/>
      <stop offset=".86" stop-color="${LINE}" stop-opacity=".55"/>
      <stop offset="1" stop-color="${LINE}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity=".34"/>
      <stop offset=".55" stop-color="${ACCENT}" stop-opacity=".1"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

function note(rightEdge) {
  const start = Number((rightEdge - address.width).toFixed(1));
  const written = 1.4;
  return `<mask id="pen" maskUnits="userSpaceOnUse" x="-10" y="-40" width="${Math.round(address.width + 20)}" height="60">
    <path class="ink" pathLength="1" d="M-6 -9H${Math.round(address.width + 6)}"/>
  </mask>
  <g class="note" transform="translate(${start} 84) rotate(-4)">
    <path fill="${PEN}" mask="url(#pen)" d="${address.path}"/>
    <g class="arrow">
      <path pathLength="1" style="animation-duration:.16s;animation-delay:${n(written + 0.05)}s" d="M-6 -7C-13 -7 -18 -12 -17 -20"/>
      <path pathLength="1" style="animation-duration:.1s;animation-delay:${n(written + 0.22)}s" d="M-17 -20l-3.4 4.4M-17 -20l4.6 2.6"/>
    </g>
  </g>`;
}

function island({ label, word, chip, chipWidth, call, callWidth }) {
  const width = 540;
  const height = 100;
  const H = 52;
  const R = 20;
  const E = 10;
  const W1 = 220;
  const L = W1 / 2;
  const mid = W1 - 2 * R;
  const dotX = -L + 24;
  const waveX = L - 24;
  const gap = { dot: 14, chip: 10, arrow: 16 };
  const content = 9 + gap.dot + chipWidth + gap.chip + callWidth + gap.arrow + 13;
  const W2 = Math.ceil((content + 44) / 2) * 2;
  const open = (W2 - W1) / 2;
  const over = open + 4;
  const under = -3;
  const scale = (offset) => n(1 + (2 * offset) / mid);
  const chipX = -W2 / 2 + 22 + 9 + gap.dot;
  const callX = chipX + chipWidth + gap.chip;
  const move = (name, value) => `@keyframes ${name} {
      0%, 30% { transform: ${value(0)}; animation-timing-function: cubic-bezier(.3, .7, .3, 1); }
      33.6% { transform: ${value(over)}; animation-timing-function: ease-in-out; }
      35.4%, 80% { transform: ${value(open)}; animation-timing-function: cubic-bezier(.3, .7, .3, 1); }
      83.6% { transform: ${value(under)}; animation-timing-function: ease-in-out; }
      85.4%, 100% { transform: ${value(0)}; }
    }`;
  const bars = [0, 1, 2, 3, 4].map((i) => `<g transform="translate(${n(waveX + (i - 2) * 6)} 26)"><rect class="bar b${i}" x="-1.5" y="-9" width="3" height="18" rx="1.5" fill="${WAVE}"/></g>`).join("\n        ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  ${defs(width)}
  <style>
    text { font-family: ${FONT}; }
    .capl { animation: capl 12s infinite; }
    .capr { animation: capr 12s infinite; }
    .mid { animation: mid 12s infinite; }
    .idle { animation: idle 12s infinite; }
    .call { animation: call 12s infinite; opacity: 0; }
    .glow { animation: glow 12s infinite; opacity: .55; }
    .halo { animation: halo 2.4s ease-in-out infinite; }
    .bar { animation: wave 1.2s ease-in-out infinite; }
    .b0 { animation-duration: 1.1s; animation-delay: -.2s; }
    .b1 { animation-duration: .9s; animation-delay: -.5s; }
    .b2 { animation-duration: 1.3s; animation-delay: -.1s; }
    .b3 { animation-duration: 1s; animation-delay: -.7s; }
    .b4 { animation-duration: 1.2s; animation-delay: -.4s; }
    ${move("capl", (offset) => `translateX(${px(-offset)})`)}
    ${move("capr", (offset) => `translateX(${px(offset)})`)}
    ${move("mid", (offset) => `scaleX(${scale(offset)})`)}
    @keyframes idle {
      0%, 29.4% { opacity: 1; }
      31.4%, 82.9% { opacity: 0; }
      85.4%, 100% { opacity: 1; }
    }
    @keyframes call {
      0%, 32.9% { opacity: 0; }
      35.9%, 78.4% { opacity: 1; }
      80.4%, 100% { opacity: 0; }
    }
    @keyframes glow {
      0%, 30% { opacity: .55; }
      35.4%, 80% { opacity: 1; }
      85.4%, 100% { opacity: .55; }
    }
    @keyframes halo {
      0%, 100% { opacity: .1; }
      50% { opacity: .32; }
    }
    @keyframes wave {
      0%, 100% { transform: scaleY(.3); }
      50% { transform: scaleY(1); }
    }
    .ink, .arrow path { fill: none; stroke-dasharray: 1; animation: write linear backwards; }
    .ink { stroke: #fff; stroke-width: 46; animation-duration: .9s; animation-delay: .5s; }
    .arrow path { stroke: ${PEN}; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    @keyframes write {
      0% { stroke-dashoffset: 1; stroke-opacity: 0; }
      1% { stroke-dashoffset: 1; stroke-opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .capl, .capr, .mid, .idle, .call, .glow, .halo, .bar, .ink, .arrow path { animation: none; }
    }
  </style>
  <rect width="${width}" height="1" fill="url(#edge)"/>
  <ellipse class="glow" cx="${width / 2}" cy="${H - 8}" rx="184" ry="42" fill="url(#glow)"/>
  <g transform="translate(${width / 2} 0)">
    ${shell({ L, H, R, E }, "    ")}
    <g class="capl">
      <circle class="halo" cx="${dotX}" cy="26" r="9" fill="${MINT}"/>
      <circle cx="${dotX}" cy="26" r="4.5" fill="${MINT}"/>
    </g>
    <text class="idle" y="31.6" text-anchor="middle" font-size="16" font-weight="600" letter-spacing=".4" fill="${INK}">${word}</text>
    <g class="capr">
      <g class="idle">
        ${bars}
      </g>
      <path class="call" d="M${n(waveX - 7)} 26h14m-5-5 5 5-5 5" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g class="call">
      <rect x="${n(chipX)}" y="15" width="${chipWidth}" height="22" rx="11" fill="${ACCENT}" fill-opacity=".16"/>
      <text x="${n(chipX + chipWidth / 2)}" y="30.2" text-anchor="middle" font-size="12" font-weight="600" fill="${ACCENT}">${chip}</text>
      <text x="${n(callX)}" y="31.4" font-size="15" font-weight="600" fill="${INK}" textLength="${callWidth}" lengthAdjust="spacing">${call}</text>
    </g>
  </g>
  ${note(width - 14)}
</svg>
`;
}

function tuck() {
  const width = 480;
  const height = 64;
  const H = 40;
  const R = 16;
  const E = 8;
  const L = 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Back to top">
  ${defs(width)}
  <style>
    .pill { animation: tuck 9s infinite; }
    .glow { animation: fade 9s infinite; opacity: .7; }
    .arrow { animation: nudge 1.8s ease-in-out infinite; }
    @keyframes tuck {
      0%, 52% { transform: translateY(0); animation-timing-function: cubic-bezier(.5, 0, .7, .4); }
      60%, 84% { transform: translateY(-${H - 5}px); animation-timing-function: cubic-bezier(.3, .7, .3, 1); }
      91% { transform: translateY(2px); animation-timing-function: ease-in-out; }
      94%, 100% { transform: translateY(0); }
    }
    @keyframes fade {
      0%, 52% { opacity: .7; }
      60%, 84% { opacity: .15; }
      94%, 100% { opacity: .7; }
    }
    @keyframes nudge {
      0%, 100% { transform: translateY(1.5px); }
      50% { transform: translateY(-1.5px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pill, .glow, .arrow { animation: none; }
    }
  </style>
  <rect width="${width}" height="1" fill="url(#edge)"/>
  <ellipse class="glow" cx="${width / 2}" cy="${H - 8}" rx="130" ry="40" fill="url(#glow)"/>
  <g transform="translate(${width / 2} 0)">
    <g class="pill">
      <rect x="${-L}" y="-8" width="${2 * L}" height="9" fill="${ISLAND}"/>
      ${shell({ L, H, R, E }, "      ")}
      <path class="arrow" d="M0 27V13m-6 6 6-6 6 6" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>
`;
}

function download({ label, name, nameWidth, tag, tagWidth }) {
  const width = 180;
  const chip = tagWidth + 16;
  const chipX = width - 14 - chip;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="44" viewBox="0 0 ${width} 44" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="fill" x2="0" y2="1">
      <stop offset="0" stop-color="#8fdfff"/>
      <stop offset="1" stop-color="#66cbf7"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="44" rx="22" fill="url(#fill)"/>
  <rect x=".5" y=".5" width="${width - 1}" height="43" rx="21.5" fill="none" stroke="${ON_ACCENT}" stroke-opacity=".14"/>
  <g transform="translate(20 13) scale(.75)" fill="none" stroke="${ON_ACCENT}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <path d="m7 10 5 5 5-5"/>
    <path d="M12 15V3"/>
  </g>
  <text x="47" y="27.4" font-family="${FONT}" font-size="15.5" font-weight="700" fill="${ON_ACCENT}" textLength="${nameWidth}" lengthAdjust="spacing">${name}</text>
  <rect x="${chipX}" y="12" width="${chip}" height="20" rx="6" fill="${ON_ACCENT}" fill-opacity=".13"/>
  <text x="${n(chipX + chip / 2)}" y="26" text-anchor="middle" font-family="${MONO}" font-size="11" font-weight="600" fill="${ON_ACCENT}" textLength="${tagWidth}" lengthAdjust="spacing">${tag}</text>
</svg>
`;
}

export function readmeAssets() {
  return {
    ...Object.fromEntries(Object.entries(ISLANDS).map(([file, options]) => [file, island(options)])),
    "island-tuck.svg": tuck(),
    ...Object.fromEntries(Object.entries(DOWNLOADS).map(([file, options]) => [file, download(options)])),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [file, svg] of Object.entries(readmeAssets())) {
    writeFileSync(path.join(outDir, file), svg);
    console.log(`[readme] ${file}`);
  }
}
