export type Atom = "f" | "m" | "h" | "w" | "ob" | "lb" | "os" | "ls" | "s" | "d";
export type Gender = "male" | "female";

export const ATOMS: Atom[] = ["f", "m", "h", "w", "ob", "lb", "os", "ls", "s", "d"];
export const MAX_CHAIN = 6;

const MALE = new Set<Atom>(["f", "h", "ob", "lb", "s"]);
const SIBLINGS = new Set<Atom>(["ob", "lb", "os", "ls"]);

export function genderOf(atom: Atom): Gender {
  return MALE.has(atom) ? "male" : "female";
}

export function holderGender(chain: Atom[], self: Gender): Gender {
  return chain.length === 0 ? self : genderOf(chain[chain.length - 1]);
}

export function canAppend(chain: Atom[], atom: Atom, self: Gender): boolean {
  if (chain.length >= MAX_CHAIN) return false;
  const holder = holderGender(chain, self);
  if (atom === "h" && holder === "male") return false;
  if (atom === "w" && holder === "female") return false;
  return true;
}

type Rule = (holder: Gender) => Atom[][];

const olderYounger = (male: boolean, holder: Gender, holderCounts: Gender): Atom[][] => {
  const options: Atom[][] = male ? [["ob"], ["lb"]] : [["os"], ["ls"]];
  return holder === holderCounts ? [...options, []] : options;
};

function pairRule(x: Atom, y: Atom): Rule | null {
  if (SIBLINGS.has(x) && (y === "f" || y === "m")) return () => [[y]];
  if ((x === "s" || x === "d") && y === "f") return (p) => (p === "male" ? [[]] : [["h"]]);
  if ((x === "s" || x === "d") && y === "m") return (p) => (p === "female" ? [[]] : [["w"]]);
  if (x === "f" && y === "w") return () => [["m"]];
  if (x === "m" && y === "h") return () => [["f"]];
  if ((x === "h" && y === "w") || (x === "w" && y === "h")) return () => [[]];
  if ((x === "f" || x === "m") && y === "s") return (p) => olderYounger(true, p, "male");
  if ((x === "f" || x === "m") && y === "d") return (p) => olderYounger(false, p, "female");
  if ((x === "s" || x === "d") && SIBLINGS.has(y)) return () => [[genderOf(y) === "male" ? "s" : "d"]];
  if ((x === "h" || x === "w") && (y === "s" || y === "d")) return () => [[y]];
  if (SIBLINGS.has(x) && SIBLINGS.has(y)) {
    const xOlder = x === "ob" || x === "os";
    const yOlder = y === "ob" || y === "os";
    const male = genderOf(y) === "male";
    if (xOlder === yOlder) return () => [[male ? (yOlder ? "ob" : "lb") : yOlder ? "os" : "ls"]];
    return (p) => olderYounger(male, p, male ? "male" : "female");
  }
  return null;
}

function reduceOnce(chain: Atom[], self: Gender): Atom[][] | null {
  for (let i = 0; i + 1 < chain.length; i += 1) {
    const rule = pairRule(chain[i], chain[i + 1]);
    if (!rule) continue;
    const holder = holderGender(chain.slice(0, i), self);
    return rule(holder).map((middle) => [...chain.slice(0, i), ...middle, ...chain.slice(i + 2)]);
  }
  return null;
}

export function normalize(chain: Atom[], self: Gender): Atom[][] {
  const done = new Map<string, Atom[]>();
  let pending: Atom[][] = [chain];
  for (let guard = 0; pending.length > 0 && guard < 64; guard += 1) {
    const next: Atom[][] = [];
    for (const item of pending) {
      const reduced = reduceOnce(item, self);
      if (reduced) next.push(...reduced);
      else done.set(item.join("-"), item);
    }
    pending = next;
  }
  return [...done.values()];
}

function inverse(atom: Atom, holder: Gender): Atom {
  const male = holder === "male";
  switch (atom) {
    case "f":
    case "m":
      return male ? "s" : "d";
    case "s":
    case "d":
      return male ? "f" : "m";
    case "h":
      return "w";
    case "w":
      return "h";
    case "ob":
    case "os":
      return male ? "lb" : "ls";
    default:
      return male ? "ob" : "os";
  }
}

export function reverseChain(chain: Atom[], self: Gender): { chain: Atom[]; self: Gender } {
  const out: Atom[] = [];
  for (let i = chain.length - 1; i >= 0; i -= 1) out.push(inverse(chain[i], holderGender(chain.slice(0, i), self)));
  return { chain: out, self: holderGender(chain, self) };
}

export interface KinshipAnswer {
  keys: string[];
  titles: string[];
}

export function solve(chain: Atom[], self: Gender, lookup: (key: string, self: Gender) => string | null, describe: (chain: Atom[]) => string): KinshipAnswer {
  const forms = normalize(chain, self);
  const keys = forms.map((form) => form.join("-"));
  const titles: string[] = [];
  for (const form of forms) {
    const title = lookup(form.join("-"), self) ?? describe(form);
    for (const part of title.split(" / ")) if (!titles.includes(part)) titles.push(part);
  }
  return { keys, titles };
}
