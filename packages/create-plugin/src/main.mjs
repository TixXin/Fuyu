import { relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { nameProblem, ownerProblem, scaffold } from "./scaffold.mjs";

const HELP = `Usage: npm create fuyu-plugin@latest [folder] -- [options]

Creates a TypeScript plugin for Fuyu's plugin platform v3: a host part that uses the timer
service, an island page and a settings section, with type checking and lint rules.

Options:
  --owner <name>          your GitHub user or organization (the package is @<owner>/<name>)
  --name <name>           the plugin's name (default: my-plugin)
  --repository <repo>     default: github:<owner>/<name>
  --display-name <text>   the name people see, in English
  --display-name-zh <text>  the name people see, in Chinese (default: the English one)
  --fuyu <folder>         a checkout of TixXin/fuyu to link Fuyu's packages from
                          (until fuyu-plugin 2.0 is on npm; default: the one this runs from)
  --yes                   do not ask, use the options and defaults
  --help`;

const OPTIONS = {
  owner: { type: "string" },
  name: { type: "string" },
  repository: { type: "string" },
  "display-name": { type: "string" },
  "display-name-zh": { type: "string" },
  fuyu: { type: "string" },
  yes: { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

async function askUntil(ask, question, problemOf, fallback = "") {
  for (;;) {
    const answer = (await ask(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim() || fallback;
    const problem = problemOf(answer);
    if (!problem) return answer;
    console.log(`  ${problem}`);
  }
}

async function fillIn(input) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => rl.question(question);
  try {
    input.owner ??= await askUntil(ask, "GitHub owner (you or your organization)", ownerProblem);
    input.name ??= await askUntil(ask, "Plugin name", nameProblem, "my-plugin");
    input.displayName ??= (await ask("Name people see, in English [from the plugin name]: ")).trim();
    input.displayNameZh ??= (await ask("Name people see, in Chinese [same as English]: ")).trim();
  } finally {
    rl.close();
  }
}

export async function main(argv = process.argv.slice(2), io = { cwd: process.cwd(), interactive: process.stdin.isTTY, log: console.log }) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  if (values.help) {
    io.log(HELP);
    return 0;
  }
  const input = {
    owner: values.owner,
    name: values.name,
    repository: values.repository,
    displayName: values["display-name"],
    displayNameZh: values["display-name-zh"],
    fuyu: values.fuyu,
  };
  if (!values.yes && io.interactive) await fillIn(input);
  input.dir = resolve(io.cwd, positionals[0] ?? input.name ?? "my-plugin");
  const { options, written } = scaffold(input);
  const folder = relative(io.cwd, options.dir) || ".";
  io.log(`\nCreated ${options.packageName} in ${folder}:`);
  for (const path of written) io.log(`  ${path}`);
  io.log(`\nFuyu's packages are linked from ${options.checkout}.`);
  io.log(`\nNext:\n  cd ${folder}\n  npm install\n  npm run typecheck && npm run lint && npm run check`);
  return 0;
}
