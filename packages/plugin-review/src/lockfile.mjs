function addEntry(packages, name, version, extra) {
  if (!name || !version) return;
  const key = `${name}@${version}`;
  const existing = packages.get(key);
  packages.set(key, { name, version, ...existing, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== false)) });
}

export function parsePackageLock(text) {
  const lock = JSON.parse(text);
  const packages = new Map();
  if (lock.packages && typeof lock.packages === "object") {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (!path || !entry || entry.link) continue;
      const name = entry.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
      addEntry(packages, name, entry.version, { integrity: entry.integrity, resolved: entry.resolved, installScript: entry.hasInstallScript === true });
    }
    return packages;
  }
  const walk = (dependencies) => {
    for (const [name, entry] of Object.entries(dependencies ?? {})) {
      addEntry(packages, name, entry.version, { integrity: entry.integrity, resolved: entry.resolved });
      walk(entry.dependencies);
    }
  };
  walk(lock.dependencies);
  return packages;
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed.slice(1, -1);
  return trimmed;
}

function splitPnpmKey(raw) {
  let key = unquote(raw).replace(/^\//, "").replace(/\(.*$/, "");
  const legacy = /^((?:@[^/]+\/)?[^/@]+)\/(\d[^/_]*)(?:_.*)?$/.exec(key);
  if (legacy) return { name: legacy[1], version: legacy[2] };
  key = key.replace(/_.*$/, "");
  const at = key.lastIndexOf("@");
  if (at <= 0) return null;
  return { name: key.slice(0, at), version: key.slice(at + 1) };
}

export function parsePnpmLock(text) {
  const packages = new Map();
  let section = null;
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      section = line.replace(/:\s*$/, "");
      current = null;
      continue;
    }
    if (section !== "packages" && section !== "snapshots") continue;
    const keyMatch = /^ {2}(\S.*?):\s*(\{.*\})?\s*$/.exec(line);
    if (keyMatch) {
      const parsed = splitPnpmKey(keyMatch[1]);
      current = parsed;
      if (parsed && section === "packages") addEntry(packages, parsed.name, parsed.version, {});
      if (parsed && section === "snapshots") addEntry(packages, parsed.name, parsed.version, {});
      continue;
    }
    if (!current || section !== "packages") continue;
    const integrity = /integrity:\s*([^,}\s]+)/.exec(line);
    const tarball = /tarball:\s*([^,}\s]+)/.exec(line);
    const install = /^\s+requiresBuild:\s*true/.test(line) || /^\s+hasInstallScript:\s*true/.test(line);
    if (integrity || tarball || install) {
      addEntry(packages, current.name, current.version, { integrity: integrity?.[1], resolved: tarball?.[1], installScript: install });
    }
  }
  return packages;
}

export function readLockfile(tree) {
  for (const [file, parse] of [["pnpm-lock.yaml", parsePnpmLock], ["package-lock.json", parsePackageLock], ["npm-shrinkwrap.json", parsePackageLock]]) {
    const entry = tree.files.get(file);
    if (!entry?.text) continue;
    try {
      return { file, packages: parse(entry.text), error: null };
    } catch (error) {
      return { file, packages: new Map(), error: error instanceof Error ? error.message : String(error) };
    }
  }
  return { file: null, packages: new Map(), error: null };
}

function byName(packages) {
  const map = new Map();
  for (const entry of packages.values()) {
    if (!map.has(entry.name)) map.set(entry.name, []);
    map.get(entry.name).push(entry);
  }
  return map;
}

export function diffLockfiles(oldPackages, newPackages) {
  const oldByName = byName(oldPackages);
  const newByName = byName(newPackages);
  const added = [];
  const removed = [];
  const changed = [];
  const tampered = [];
  const installScripts = [];
  for (const [name, entries] of newByName) {
    const before = oldByName.get(name);
    const versions = entries.map((e) => e.version).sort();
    if (!before) added.push({ name, versions });
    else {
      const previous = before.map((e) => e.version).sort();
      if (previous.join() !== versions.join()) changed.push({ name, from: previous, to: versions });
    }
    for (const entry of entries) {
      const old = oldPackages.get(`${name}@${entry.version}`);
      if (old && ((old.integrity && entry.integrity && old.integrity !== entry.integrity) || (old.resolved && entry.resolved && old.resolved !== entry.resolved))) {
        tampered.push({ name, version: entry.version, from: old.integrity ?? old.resolved, to: entry.integrity ?? entry.resolved });
      }
      if (entry.installScript && !old?.installScript) installScripts.push({ name, version: entry.version });
    }
  }
  for (const [name, entries] of oldByName) if (!newByName.has(name)) removed.push({ name, versions: entries.map((e) => e.version).sort() });
  const sort = (list) => list.sort((a, b) => a.name.localeCompare(b.name));
  return { added: sort(added), removed: sort(removed), changed: sort(changed), tampered: sort(tampered), installScripts: sort(installScripts) };
}
