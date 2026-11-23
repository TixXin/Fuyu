export type EmojiGroup = "common" | "animals" | "nature" | "food" | "objects" | "symbols";

const list = (value: string) => value.split(" ");

export const EMOJI_CHOICES: readonly (readonly [EmojiGroup, readonly string[]])[] = [
  ["common", list("⭐ ❤️ ✨ 🔥 ⚡ 🌙 ☀️ 🌈 🍀 🎵 🎧 📚 💼 ⏰ ✅ 📌 💡 🚀 🎮 🏠 🔔 💬 🤖 🌍")],
  ["animals", list("🐱 🐶 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐸 🐧 🐦 🐙 🪼 🐳 🐬 🐠 🦋 🐝 🐞 🦄 🐢")],
  ["nature", list("🌸 🌷 🌻 🌵 🌲 🍁 🍄 🌊 ❄️ ☁️ 🌧️ ⛰️ 🌕 🪐")],
  ["food", list("☕ 🍵 🧋 🍺 🍷 🍰 🍩 🍪 🍕 🍔 🍜 🍣 🍓 🍑 🍋 🥑")],
  ["objects", list("💻 📱 ⌨️ 🖥️ 📷 🎨 ✏️ 📝 📁 🗂️ 🧰 🔑 🎁 🏆 💎 🪄 🧩 🎲")],
  ["symbols", list("♥️ ☘️ ♻️ ✔️ ❌ ⭕ ❗ ❓ 💯 🆗 🔴 🟢 🔵 🟣")],
];
