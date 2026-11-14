const fuyu = acquireFuyuApi();
const chinese = fuyu.locale === "zh-CN";
const text = document.getElementById("text");
document.getElementById("label").textContent = chinese ? "便签" : "Note";
document.getElementById("save").textContent = chinese ? "保存" : "Save";
text.placeholder = chinese ? "写点什么，Ctrl+Enter 保存，Esc 收起" : "Write something; Ctrl+Enter saves, Esc hides";

function save() {
  fuyu.postMessage({ type: "note", text: text.value });
  text.value = "";
}

document.getElementById("form").addEventListener("submit", (event) => {
  event.preventDefault();
  save();
});
text.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.ctrlKey) save();
});
fuyu.onMessage((message) => {
  if (message?.type === "clear") {
    text.value = "";
    text.focus();
  }
});
text.focus();
