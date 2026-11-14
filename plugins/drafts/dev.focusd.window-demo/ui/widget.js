const fuyu = acquireFuyuApi();
const chinese = fuyu.locale === "zh-CN";
const time = document.getElementById("time");
const note = document.getElementById("note");
const empty = chinese ? "按 Ctrl+Alt+N 写一条便签" : "Press Ctrl+Alt+N to write a note";

function tick() {
  time.textContent = new Date().toLocaleTimeString(chinese ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit" });
}

document.getElementById("card").addEventListener("mousedown", (event) => {
  if (event.button === 0) fuyu.startDrag();
});
fuyu.onMessage((message) => {
  if (message?.type === "note") note.textContent = message.text || empty;
});
note.textContent = empty;
tick();
setInterval(tick, 10000);
fuyu.postMessage({ type: "ready" });
