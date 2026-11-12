function parseQuery(query) {
  const params = new URLSearchParams(query);
  const pids = (params.get("pids") ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
  return { pids, title: params.get("title") ?? "" };
}

function bareTitle(title) {
  return title
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .replace(/…$/u, "")
    .trim()
    .toLowerCase();
}

function pickTerminal(terminals, { pids, title }) {
  const byProcess = terminals.findIndex((terminal) => pids.includes(terminal.processId));
  if (byProcess >= 0) {
    return byProcess;
  }
  const wanted = bareTitle(title);
  if ([...wanted].length < 2) {
    return -1;
  }
  const truncated = title.trimEnd().endsWith("…");
  const named = terminals
    .map((terminal, index) => ({ name: bareTitle(terminal.name ?? ""), index }))
    .filter(({ name }) => name === wanted || (truncated && name.startsWith(wanted)));
  return named.length === 1 ? named[0].index : -1;
}

module.exports = { parseQuery, bareTitle, pickTerminal };
