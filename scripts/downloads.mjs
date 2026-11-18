const REPO = "TixXin/fuyu";
const API = `https://api.github.com/repos/${REPO}/releases`;
const headers = {
  "User-Agent": "fuyu-downloads-script",
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function fetchAllReleases() {
  const releases = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API}?per_page=100&page=${page}`, { headers });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`GitHub API ${res.status}: ${msg}`);
    }
    const data = await res.json();
    if (data.length === 0) break;
    releases.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return releases;
}

function bar(count, max, width = 20) {
  const filled = max === 0 ? 0 : Math.round((count / max) * width);
  return "█".repeat(filled).padEnd(width, "░");
}

function fmt(n) {
  return n.toLocaleString("zh-CN");
}

const releases = await fetchAllReleases();

const rows = releases.map((r) => {
  const total = r.assets.reduce((s, a) => s + a.download_count, 0);
  return { tag: r.tag_name, total, assets: r.assets };
});

const grand = rows.reduce((s, r) => s + r.total, 0);
const maxCount = Math.max(...rows.map((r) => r.total), 1);

const tagW = Math.max(...rows.map((r) => r.tag.length), 7);

console.log();
console.log(`  ${"版本".padEnd(tagW)}  ${"".padEnd(20)}  下载量`);
console.log(`  ${"─".repeat(tagW + 2 + 20 + 2 + 8)}`);

for (const row of rows) {
  console.log(
    `  ${row.tag.padEnd(tagW)}  ${bar(row.total, maxCount)}  ${fmt(row.total).padStart(8)}`
  );
  for (const asset of row.assets) {
    if (asset.download_count === 0) continue;
    const name =
      asset.name.length > 44 ? asset.name.slice(0, 41) + "…" : asset.name;
    console.log(
      `    ${"".padEnd(tagW - 2)}↳ ${name.padEnd(44)}  ${fmt(asset.download_count).padStart(8)}`
    );
  }
}

console.log(`  ${"─".repeat(tagW + 2 + 20 + 2 + 8)}`);
console.log(`  ${"总计".padEnd(tagW + 22)}${fmt(grand).padStart(8)}`);
console.log();
