export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript, template, head").forEach((node) => node.remove());
  return block(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}

const BLOCKS = new Set(["P", "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "ASIDE", "FIGURE", "FORM"]);

function block(node: Node): string {
  return [...node.childNodes].map(convert).join("");
}

function inline(node: Node): string {
  return block(node).replace(/\s*\n\s*/g, " ");
}

function convert(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/[ \t\r\n]+/g, " ");
  if (!(node instanceof Element)) return "";
  const tag = node.tagName;
  if (/^H[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${inline(node).trim()}\n\n`;
  if (BLOCKS.has(tag)) return `\n\n${block(node).trim()}\n\n`;
  switch (tag) {
    case "BR":
      return "  \n";
    case "HR":
      return "\n\n---\n\n";
    case "STRONG":
    case "B":
      return wrap(inline(node), "**");
    case "EM":
    case "I":
      return wrap(inline(node), "*");
    case "DEL":
    case "S":
      return wrap(inline(node), "~~");
    case "CODE":
      return node.closest("pre") ? node.textContent ?? "" : `\`${node.textContent ?? ""}\``;
    case "PRE": {
      const language = /language-(\w+)/.exec(node.querySelector("code")?.className ?? "")?.[1] ?? "";
      return `\n\n\`\`\`${language}\n${(node.textContent ?? "").replace(/\n$/, "")}\n\`\`\`\n\n`;
    }
    case "A": {
      const href = node.getAttribute("href") ?? "";
      const text = inline(node).trim();
      return href && !href.startsWith("javascript:") ? `[${text || href}](${href})` : text;
    }
    case "IMG": {
      const src = node.getAttribute("src") ?? "";
      return src.startsWith("data:") || !src ? "" : `![${node.getAttribute("alt") ?? ""}](${src})`;
    }
    case "BLOCKQUOTE":
      return `\n\n${block(node).trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
    case "UL":
    case "OL":
      return `\n\n${list(node, tag === "OL")}\n\n`;
    case "TABLE":
      return `\n\n${table(node)}\n\n`;
    default:
      return block(node);
  }
}

function wrap(text: string, mark: string) {
  const trimmed = text.trim();
  return trimmed ? `${mark}${trimmed}${mark}` : text;
}

function list(node: Element, ordered: boolean, depth = 0): string {
  const items = [...node.children].filter((child) => child.tagName === "LI");
  return items.map((item, index) => {
    const nested = [...item.children].filter((child) => child.tagName === "UL" || child.tagName === "OL");
    nested.forEach((child) => child.remove());
    const head = `${"  ".repeat(depth)}${ordered ? `${index + 1}.` : "-"} ${block(item).trim().replace(/\n+/g, " ")}`;
    return [head, ...nested.map((child) => list(child, child.tagName === "OL", depth + 1))].join("\n");
  }).join("\n");
}

function table(node: Element): string {
  const rows = [...node.querySelectorAll("tr")].map((row) => [...row.children].map((cell) => inline(cell).trim().replace(/\|/g, "\\|")));
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, index) => cells[index] ?? "").join(" | ")} |`;
  return [line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
}
