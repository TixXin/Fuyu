const vscode = require("vscode");
const { parseQuery, pickTerminal } = require("./match.js");

async function showSessionTerminal(uri) {
  if (uri.path !== "/focus") {
    return;
  }
  const query = parseQuery(uri.query);
  const terminals = vscode.window.terminals;
  const processIds = await Promise.all(
    terminals.map((terminal) => Promise.resolve(terminal.processId).catch(() => undefined)),
  );
  const index = pickTerminal(
    terminals.map((terminal, i) => ({ processId: processIds[i], name: terminal.name })),
    query,
  );
  if (index >= 0) {
    terminals[index].show(false);
  }
}

function activate(context) {
  context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: showSessionTerminal }));
}

function deactivate() {}

module.exports = { activate, deactivate };
