// The page side of the todo ring. acquireFocusdApi() is the page's only link
// to the island: messages go to this plugin's process (main.ps1), and
// getState / setState keep the last counts while the island runs, so the ring
// shows them at once when the page opens again.
const focusd = acquireFocusdApi();
const text = focusd.locale === "zh-CN"
  ? {
      label: "今天的待办", total: (n) => `/ ${n} 已完成`, left: (n) => `还剩 ${n} 个`, more: (n) => `还有 ${n} 个`,
      done: "完成", allDone: "今天的都做完了", empty: "今天还没有待办", refresh: "刷新",
    }
  : {
      label: "Today's todos", total: (n) => `/ ${n} done`, left: (n) => `${n} left`, more: (n) => `${n} more`,
      done: "Done", allDone: "All done for today", empty: "No todos today", refresh: "Refresh",
    };
const byId = (id) => document.getElementById(id);
const root = byId("ring");
const value = document.querySelector(".ring__value");
const refresh = byId("refresh");

byId("label").textContent = text.label;
refresh.title = text.refresh;
refresh.setAttribute("aria-label", text.refresh);
refresh.addEventListener("click", () => focusd.postMessage({ type: "refresh" }));

// `next`: the titles of the first few todos still to do (absent in counts saved by 1.0).
function show({ done, total, next = [] }) {
  const share = total === 0 ? 0 : Math.round((done / total) * 100);
  const left = total - done;
  root.classList.toggle("ring--done", total > 0 && left === 0);
  root.classList.toggle("ring--none", share === 0);
  root.classList.toggle("ring--empty", total === 0);
  value.style.strokeDasharray = `${share} 100`;
  byId("percent").textContent = total === 0 ? "–" : `${share}%`;
  byId("left").textContent = total === 0 ? "" : left === 0 ? text.done : text.left(left);
  byId("done").textContent = total === 0 ? "" : String(done);
  byId("total").textContent = total === 0 ? "" : text.total(total);
  byId("next").replaceChildren(...next.map((title) => {
    const item = document.createElement("li");
    item.append(Object.assign(document.createElement("span"), { textContent: title, title }));
    return item;
  }));
  byId("note").textContent = total === 0 ? text.empty : left === 0 ? text.allDone : left > next.length ? text.more(left - next.length) : "";
}

const saved = focusd.getState();
if (saved) show(saved);

focusd.onMessage((message) => {
  if (message && message.type === "counts") {
    show(message);
    focusd.setState({ done: message.done, total: message.total, next: message.next });
  }
});

focusd.postMessage({ type: "ready" });
