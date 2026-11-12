export function quoteArg(arg) {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
  if (arg.includes('"')) throw new Error(`An argument with a double quote cannot go through the shell: ${arg}`);
  return `"${arg}"`;
}

export function commandLine(command, args) {
  return [command, ...args].map(quoteArg).join(" ");
}
