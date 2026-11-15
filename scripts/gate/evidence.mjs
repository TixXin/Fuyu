import { basename, resolve } from "node:path";
import { locate, operands, shellCommands } from "./shell.mjs";

const READERS = new Set(["cat", "head", "tail", "sed", "less", "more", "bat", "nl", "awk", "get-content", "gc", "type"]);
const SHELL_TOOLS = ["Bash", "PowerShell"];
const RECORD = /"type":\s?"(assistant|attachment)"/;
const sameFile = process.platform === "win32" ? (a, b) => a.toLowerCase() === b.toLowerCase() : (a, b) => a === b;

export function skillLoaded(text, skill) {
  return [`"skill":"${skill}"`, `"skill": "${skill}"`, `<command-name>/${skill}</command-name>`].some((mark) => text.includes(mark));
}

export function readTargets(command, { base, powershell = false, home } = {}) {
  const found = [];
  for (const entry of shellCommands(command, { powershell })) {
    const name = (entry.words[0] ?? "").replaceAll("\\", "/").split("/").pop().toLowerCase();
    if (!READERS.has(name)) continue;
    if (name === "sed" && entry.words.some((word) => /^-[a-zA-Z]*i/.test(word) || word.startsWith("--in-place"))) continue;
    for (const word of operands(entry)) found.push(locate(base, entry, word, home));
  }
  return found;
}

function entries(text, needles) {
  const found = [];
  for (const line of text.split("\n")) {
    if (!needles.every((needle) => line.includes(needle))) continue;
    if (!RECORD.test(line)) continue;
    try {
      found.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return found;
}

function toolCalls(entry) {
  const content = entry.type === "assistant" ? entry.message?.content : null;
  return Array.isArray(content) ? content.filter((block) => block?.type === "tool_use") : [];
}

export function hasRead(text, file, { root, home } = {}) {
  const wanted = resolve(root, file);
  const matches = (path, base) => typeof path === "string" && sameFile(resolve(base, path), wanted);
  for (const entry of entries(text, [basename(file)])) {
    const base = typeof entry.cwd === "string" ? entry.cwd : root;
    if (entry.type === "attachment" && entry.attachment?.type === "instructions") {
      if ((entry.attachment.files ?? []).some((loaded) => matches(loaded?.path, base))) return true;
    }
    for (const call of toolCalls(entry)) {
      if (call.name === "Read" && matches(call.input?.file_path, base)) return true;
      if (SHELL_TOOLS.includes(call.name)) {
        const targets = readTargets(call.input?.command, { base, powershell: call.name === "PowerShell", home });
        if (targets.some((target) => sameFile(target, wanted))) return true;
      }
    }
  }
  return false;
}

export function earlierCalls(text, tool, fields = {}, exceptId = null) {
  let count = 0;
  for (const entry of entries(text, [tool])) {
    for (const call of toolCalls(entry)) {
      if (call.name !== tool || call.id === exceptId) continue;
      if (Object.entries(fields).every(([key, value]) => call.input?.[key] === value)) count += 1;
    }
  }
  return count;
}
