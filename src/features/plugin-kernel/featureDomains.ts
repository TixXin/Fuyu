export interface BuiltinRoot {
  id: string;
  root: string;
}

export interface IpcDomains {
  commands: ReadonlyMap<string, string>;
  events: ReadonlyMap<string, string>;
}

const COMMAND = /\binvoke\s*(?:<[^()]*?>)?\(\s*["'`]([^"'`$]+)["'`]/g;
const LISTEN = /\b(?:listen|once)\s*(?:<[^()]*?>)?\(\s*(?:["'`]([^"'`$]+)["'`]|([A-Za-z_$][\w$]*))/g;
const CONSTANT = /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]|" ]+)?=\s*["'`]([^"'`$]+)["'`]/g;

function exclusive(table: ReadonlyMap<string, ReadonlySet<string>>): Map<string, string> {
  const result = new Map<string, string>();
  for (const [name, set] of table) {
    const [only] = set;
    if (set.size === 1 && !only.startsWith("outside:")) result.set(name, only);
  }
  return result;
}

function rootOf(path: string): string | null {
  const match = /(?:^|\/)features\/([^/]+)\//.exec(path.replace(/\\/g, "/"));
  return match ? match[1] : null;
}

export function ipcDomains(sources: Readonly<Record<string, string>>, builtins: readonly BuiltinRoot[]): IpcDomains {
  const constants = new Map<string, string>();
  for (const text of Object.values(sources)) {
    for (const [, name, value] of text.matchAll(CONSTANT)) constants.set(name, value);
  }
  const owners = { commands: new Map<string, Set<string>>(), events: new Map<string, Set<string>>() };
  const note = (table: Map<string, Set<string>>, name: string | undefined, owner: string) => {
    if (!name) return;
    const set = table.get(name) ?? new Set<string>();
    set.add(owner);
    table.set(name, set);
  };
  for (const [path, text] of Object.entries(sources)) {
    const owner = ownerOf(path, builtins);
    for (const [, command] of text.matchAll(COMMAND)) note(owners.commands, command, owner);
    for (const [, literal, identifier] of text.matchAll(LISTEN)) note(owners.events, literal ?? constants.get(identifier), owner);
  }
  return { commands: exclusive(owners.commands), events: exclusive(owners.events) };
}

const CLASS = /\.(-?[A-Za-z_][\w-]*)/g;

function ownerOf(path: string, builtins: readonly BuiltinRoot[]): string {
  const root = rootOf(path);
  return builtins.find((plugin) => plugin.root === root)?.id ?? `outside:${root ?? path}`;
}

export function classDomains(sources: Readonly<Record<string, string>>, builtins: readonly BuiltinRoot[]): ReadonlyMap<string, string> {
  const owners = new Map<string, Set<string>>();
  for (const [path, text] of Object.entries(sources)) {
    const owner = ownerOf(path, builtins);
    const plain = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\([^)]*\)/g, "");
    for (const [, name] of plain.matchAll(CLASS)) {
      const set = owners.get(name) ?? new Set<string>();
      set.add(owner);
      owners.set(name, set);
    }
  }
  return exclusive(owners);
}

export function namesOf(domains: IpcDomains, id: string): { commands: string[]; events: string[] } {
  const pick = (table: ReadonlyMap<string, string>) => [...table].filter(([, owner]) => owner === id).map(([name]) => name).sort();
  return { commands: pick(domains.commands), events: pick(domains.events) };
}
