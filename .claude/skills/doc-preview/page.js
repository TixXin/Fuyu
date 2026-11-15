// Runs in the generated page: renders the Markdown, builds the table of contents and the buttons.
(function () {
  const data = JSON.parse(document.getElementById("doc-data").textContent);
  const article = document.querySelector(".markdown");
  const toc = document.querySelector(".toc");

  /* global marked */
  article.innerHTML = marked.parse(data.markdown, { gfm: true, breaks: false });

  // Front matter as a small table above the document.
  if (data.meta.length) {
    const table = document.createElement("table");
    table.className = "meta";
    for (const [key, value] of data.meta) {
      const row = table.insertRow();
      row.insertCell().textContent = key;
      row.insertCell().textContent = value;
    }
    const first = article.querySelector("h1");
    first ? first.after(table) : article.prepend(table);
  }

  // Relative links and images resolve next to the document; root links from the repo root.
  const resolve = (value) => {
    if (!value || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
    const base = value.startsWith("/") && data.rootUrl ? data.rootUrl : data.baseUrl;
    try { return new URL(value.replace(/^\//, ""), base).href; } catch { return null; }
  };
  for (const img of article.querySelectorAll("img[src]")) {
    const href = resolve(img.getAttribute("src"));
    if (href) img.src = href;
  }
  for (const link of article.querySelectorAll("a[href]")) {
    const raw = link.getAttribute("href");
    const href = resolve(raw);
    if (href) link.href = href;
    if (!raw.startsWith("#")) { link.target = "_blank"; link.rel = "noopener"; }
  }

  // Headings get GitHub's ids (punctuation dropped, spaces to dashes, Chinese kept), so links
  // written for GitHub work here too; an anchor; and a place in the table of contents.
  const used = new Set();
  const slug = (text) => {
    const base = text.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M} _-]/gu, "").replace(/ /g, "-") || "section";
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const headings = [...article.querySelectorAll("h2, h3")];
  for (const heading of article.querySelectorAll("h1, h2, h3, h4")) {
    heading.id = slug(heading.textContent);
    if (heading.tagName === "H2" || heading.tagName === "H3") {
      const anchor = document.createElement("a");
      anchor.className = "anchor";
      anchor.href = `#${heading.id}`;
      anchor.textContent = "#";
      anchor.setAttribute("aria-hidden", "true");
      heading.prepend(anchor);
    }
  }
  if (headings.length < 2) document.body.classList.add("toc-hidden");
  for (const heading of headings) {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent.replace(/^#/, "");
    link.className = `toc-${heading.tagName[1]}`;
    toc.append(link);
  }
  // In-page links scroll; a plain #id would not survive file:// with the links rewritten.
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${target.id}`);
  });
  // The heading on screen is marked in the table of contents.
  const tocLinks = new Map([...toc.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of tocLinks.values()) a.classList.remove("active");
      tocLinks.get(entry.target.id)?.classList.add("active");
    }
  }, { rootMargin: "-56px 0px -70% 0px" });
  headings.forEach((heading) => observer.observe(heading));

  // Copy buttons on code blocks (not on diagrams).
  for (const pre of article.querySelectorAll("pre")) {
    if (pre.querySelector("code.language-mermaid")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "复制";
    button.addEventListener("click", () => copy(pre.querySelector("code")?.textContent ?? pre.textContent, button));
    pre.append(button);
  }

  function copy(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      const label = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => { button.textContent = label; }, 1200);
    }, () => { button.textContent = "复制失败"; });
  }

  // Mermaid only when the document has a diagram; offline, the source stays as code.
  const diagrams = [...article.querySelectorAll("code.language-mermaid")];
  if (diagrams.length) {
    const dark = () => getComputedStyle(document.documentElement).colorScheme === "dark";
    for (const code of diagrams) {
      const box = document.createElement("div");
      box.className = "mermaid";
      box.textContent = code.textContent;
      box.dataset.source = code.textContent;
      code.parentElement.replaceWith(box);
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => {
      /* global mermaid */
      mermaid.initialize({ startOnLoad: false, theme: dark() ? "dark" : "default" });
      mermaid.run({ nodes: document.querySelectorAll(".mermaid") });
    };
    document.head.append(script);
  }

  // Notes per section: each h2 gets a "批注" button; the header's "复制反馈" copies every note as
  // Markdown, ready to paste back into the chat. Notes live in the page only (lost on reload).
  const notes = new Map();
  for (const heading of article.querySelectorAll("h2")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-button";
    button.textContent = "批注";
    button.addEventListener("click", () => {
      let box = heading.nextElementSibling?.classList.contains("note") ? heading.nextElementSibling : null;
      if (!box) {
        box = document.createElement("textarea");
        box.className = "note";
        box.placeholder = `对「${heading.textContent.replace(/^#|批注$/g, "")}」的意见`;
        box.addEventListener("input", () => {
          if (box.value.trim()) notes.set(heading, box.value.trim()); else notes.delete(heading);
          button.classList.toggle("note-button--has", notes.has(heading));
          updateFeedback();
        });
        heading.after(box);
      }
      box.focus();
    });
    heading.append(button);
  }
  const feedbackButton = document.querySelector('[data-action="feedback"]');
  function updateFeedback() {
    feedbackButton.textContent = notes.size ? `复制反馈（${notes.size}）` : "复制反馈";
  }
  function feedback() {
    const sections = [...notes].map(([heading, text]) => `## ${heading.textContent.replace(/^#|批注$/g, "").trim()}\n${text}`);
    return `对《${document.title}》的反馈：\n\n${sections.join("\n\n")}\n`;
  }

  // Header buttons.
  document.querySelector(".bar").addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (action === "toc") document.body.classList.toggle("toc-hidden");
    if (action === "reload") location.reload();
    if (action === "feedback") {
      if (notes.size) copy(feedback(), feedbackButton);
      else { feedbackButton.textContent = "先在章节标题旁点「批注」"; setTimeout(updateFeedback, 1800); }
    }
    if (action === "print") print();
    if (action === "copy") copy(data.markdown, event.target);
    if (action === "theme") {
      const next = getComputedStyle(document.documentElement).colorScheme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("doc-preview-theme", next); } catch { /* file:// may block storage */ }
    }
  });

  document.querySelector(".doc__footer").textContent = `${data.source} · 生成于 ${data.generated} · 文件改了以后重新运行 preview.mjs，再刷新这一页`;
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
})();
