import assert from "node:assert/strict";
import test from "node:test";
import { MAX_COMPILE_ERROR_CHARS, compileErrorSummary } from "../../src/lib/devCompileError.ts";

test("an esbuild error becomes the file with its line and column, and the message without the path or the header", () => {
  const file = "/Users/someone/projects/Fuyu/src/i18n/sections/settings/collapsedItems.ts";
  const summary = compileErrorSummary({
    message: `Transform failed with 1 error:\n${file}:59:333: ERROR: Expected "}" but found "…"`,
    id: file,
    loc: { file, line: 59, column: 333 },
  });
  assert.deepEqual(summary, { where: "collapsedItems.ts:59:333", message: 'Expected "}" but found "…"' });
});

test("a Babel error keeps its own sentence and takes the file from the module id", () => {
  const file = "/Users/someone/projects/Fuyu/src/features/agent-status/approvals/AgentApprovalCard.tsx";
  const summary = compileErrorSummary({
    message: `${file}: Identifier 'preview' has already been declared. (22:2)\n\n  20 |     sessions,\n  21 |     options,`,
    id: file,
    loc: { line: 22, column: 2 },
  });
  assert.deepEqual(summary, { where: "AgentApprovalCard.tsx:22:2", message: "Identifier 'preview' has already been declared. (22:2)" });
});

test("Windows paths and CRLF are read the same way", () => {
  const file = "C:\\Users\\someone\\Fuyu\\src\\main.tsx";
  const summary = compileErrorSummary({ message: `Transform failed with 2 errors:\r\n${file}:7:1: ERROR: Unexpected "}"\r\n${file}:9:1: ERROR: Unexpected "}"` });
  assert.deepEqual(summary, { where: "main.tsx", message: 'Unexpected "}"' });
});

test("a module id with a query still names the file, and a missing column is left out", () => {
  const summary = compileErrorSummary({ message: "Unterminated string", id: "/repo/src/styles/base.css?direct", loc: { line: 4 } });
  assert.deepEqual(summary, { where: "base.css:4", message: "Unterminated string" });
});

test("an error without a file, a message or anything at all still gives something to show", () => {
  assert.deepEqual(compileErrorSummary({ message: "Failed to resolve import" }), { where: "", message: "Failed to resolve import" });
  assert.deepEqual(compileErrorSummary({}), { where: "", message: "The code does not compile" });
  assert.deepEqual(compileErrorSummary(null), { where: "", message: "The code does not compile" });
  assert.deepEqual(compileErrorSummary({ message: 42, id: 7, loc: { line: "x" } }), { where: "", message: "The code does not compile" });
});

test("a very long message is cut", () => {
  const summary = compileErrorSummary({ message: "x".repeat(900) });
  assert.equal(summary.message, `${"x".repeat(MAX_COMPILE_ERROR_CHARS)}…`);
});
