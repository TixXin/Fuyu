const PART = /^[a-z0-9][a-z0-9._~-]*$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const SHORTHAND = /^(?:(github|gitlab|bitbucket):)?([^/:@\s]+)\/([^/\s#]+?)(?:\.git)?(?:#.*)?$/;
const HOSTS = { github: "github.com", gitlab: "gitlab.com", bitbucket: "bitbucket.org" };

export function parsePluginName(name) {
  if (typeof name !== "string" || name.length > 214) return null;
  const match = /^@([^/]+)\/([^/]+)$/.exec(name);
  if (!match) return PART.test(name) ? { scope: null, name } : null;
  return PART.test(match[1]) && PART.test(match[2]) ? { scope: match[1], name: match[2] } : null;
}

export function parseRepository(repository) {
  const text = typeof repository === "string" ? repository : repository && typeof repository === "object" ? repository.url : null;
  if (typeof text !== "string" || text.trim() === "") return null;
  const value = text.trim();
  const short = SHORTHAND.exec(value);
  if (short && !value.includes("://")) {
    return OWNER.test(short[2]) ? { host: HOSTS[short[1] ?? "github"], owner: short[2], repo: short[3] } : null;
  }
  const scp = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(value);
  if (scp) return OWNER.test(scp[2]) ? { host: scp[1].toLowerCase(), owner: scp[2], repo: scp[3] } : null;
  let url;
  try {
    url = new URL(value.replace(/^git\+/, ""));
  } catch {
    return null;
  }
  if (!["https:", "http:", "git:", "ssh:"].includes(url.protocol)) return null;
  const [owner, repo] = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/");
  if (!owner || !repo || !OWNER.test(owner)) return null;
  return { host: url.hostname.toLowerCase(), owner, repo };
}

export function checkPluginName(name, repository, { officialScope = "fuyu", official = false } = {}) {
  const parsed = parsePluginName(name);
  if (!parsed) return { code: "name", message: `"${name}" is not a valid package name: lowercase letters, digits, "-", "." and "_", optionally scoped` };
  if (!parsed.scope) return { code: "name-unscoped", message: `"${name}" has no scope: name it @<repository owner>/${parsed.name}` };
  const scope = parsed.scope.toLowerCase();
  if (scope === officialScope.toLowerCase()) {
    return official ? null : { code: "name-reserved", message: `@${officialScope}/* is reserved for official plugins` };
  }
  const repo = parseRepository(repository);
  if (!repo) return null;
  if (repo.owner.toLowerCase() !== scope) {
    return { code: "name-owner", message: `the scope @${parsed.scope} must be the repository owner (${repo.owner})` };
  }
  return null;
}
