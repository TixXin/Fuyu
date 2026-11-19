import { act } from "react";
import catalog from "../../src/features/builtins.json";

export async function checkAboutPlugins(check: (condition: unknown, message: string) => void) {
  const click = (selector: string) => act(async () => { document.querySelector<HTMLElement>(selector)?.click(); });
  const until = async (ready: () => unknown) => {
    for (let waited = 0; waited < 2000 && !ready(); waited += 50) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    return Boolean(ready());
  };
  const activeTab = () => document.querySelector(".settings-tabs__tab--active")?.getAttribute("data-tab");
  const stat = (name: string) => document.querySelector(`.about-plugins__stat[data-stat='${name}'] b`)?.textContent;
  const groups = () => [...document.querySelectorAll(".settings-group__title")].map((title) => title.textContent).join("|");

  await click(".settings-tabs__tab[data-tab='aboutPlugins']");
  check(activeTab() === "aboutPlugins" && localStorage.getItem("fuyu-about-tab") === "plugins" && document.querySelector(".about-plugins__lead") && !document.querySelector(".about-hero"),
    "The plugin system tab opens its own introduction, without the app's card, and is remembered");
  check(await until(() => stat("builtins") === String(catalog.plugins.length)), "The introduction counts the built-in features the app reports");
  check(await until(() => stat("process") === "已关闭") && stat("installed") === "—" && document.querySelector(".about-plugins__stat[data-stat='process']")?.getAttribute("data-tone") === "off",
    "With plugins turned off at launch, the process reads as off and the installed count is not guessed");
  check(groups() === "写一个插件|这对你意味着什么|信任与安全" && document.querySelectorAll(".about-plugins__point").length === 5,
    "Below the summary come writing a plugin, what it means, and trust and safety");
  check(document.querySelector(".about-plugins__point-icon--warn")?.parentElement?.textContent?.includes("不在沙箱里"), "The trust section says plainly that plugins are not sandboxed");
  check(document.querySelector(".about-plugins__command")?.textContent === "npm create fuyu-plugin@latest" && document.querySelectorAll(".about-plugins__links a[href^='https://github.com/TixXin/']").length === 3,
    "Writing a plugin by hand shows the scaffold command and links to the tutorial, the guide and the open-source base");

  const copied: string[] = [];
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied.push(value); } } });
  const prompt = () => document.querySelector(".about-plugins__prompt pre")?.textContent ?? "";
  const copyLabel = () => document.querySelector(".about-plugins__copy button")?.textContent?.trim();
  await click(".about-plugins__copy button");
  check(await until(() => copied.length === 1) && copied[0].includes("（在这里写你想要的功能）") && copied[0].includes("npm create fuyu-plugin@latest"),
    "With nothing typed, the copied prompt keeps a blank to fill in and still tells the agent how to set up the project");
  const idea = document.querySelector<HTMLTextAreaElement>(".about-plugins__idea");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    if (idea) setter?.call(idea, "  显示今天喝了几杯水  ");
    idea?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(".about-plugins__copy button");
  check(await until(() => copied.length === 2) && copied[1].includes("我想要的功能：\n显示今天喝了几杯水\n") && !copied[1].includes("在这里写") && copied[1] === prompt(),
    "The copied prompt carries what the user typed, and is the same text the page shows");
  check(await until(() => copyLabel() === "已复制") && copied[1].includes("没有沙箱") && copied[1].includes("读了什么"),
    "Copying is confirmed, and the prompt tells the agent the plugin is not sandboxed and to report what it touches");
  if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
  else Reflect.deleteProperty(navigator, "clipboard");

  await click(".about-plugins__action[data-open-page='pluginsV3']");
  check(await until(() => document.querySelector(".plugin-page")) && !document.querySelector(".about-plugins__lead"), "Manage plugins opens the plugins page");
  await click(".plugin-foot [data-action='open-about-plugins']");
  check(await until(() => activeTab() === "aboutPlugins") && document.querySelector(".about-plugins__lead"), "The plugins page links back to the introduction");
}
