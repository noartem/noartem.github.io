// Fetches data from GitHub API and regenerates:
//   1. bucket.yml         — bucket app list with versions (site data)
//   2. assets/profile.jpg — latest GitHub profile avatar
//   3. profile README.md  — Portfolio + Bucket tables in ~/Projects/noartem
//
// Usage: node scripts/fetch-data.cjs
// Env:   GITHUB_TOKEN (optional, raises rate limits)
//        PROFILE_REPO (default: ../noartem relative to this repo)

const fs = require("node:fs");
const path = require("node:path");

const OWNER = "noartem";
const BUCKET_REPO = "bucket";
const PROFILE_REPO = process.env.PROFILE_REPO || path.resolve(__dirname, "..", "..", "noartem");
const SITE_ROOT = path.resolve(__dirname, "..");

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "noartem-site-sync",
};
if (process.env.GITHUB_TOKEN) GH_HEADERS.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function ghApi(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, { headers: GH_HEADERS });
  if (!res.ok) throw new Error(`GitHub API ${pathname}: ${res.status}`);
  return res.json();
}

async function fetchBucketApps() {
  const entries = await ghApi(`/repos/${OWNER}/${BUCKET_REPO}/contents/bucket`);
  const manifests = entries.filter((e) => e.name.endsWith(".json"));
  const apps = [];
  for (const entry of manifests) {
    const res = await fetch(entry.url, { headers: { ...GH_HEADERS, Accept: "application/vnd.github.raw" } });
    if (!res.ok) throw new Error(`Fetch manifest ${entry.name}: ${res.status}`);
    const m = JSON.parse(await res.text());
    const repoFull =
      (m.homepage || "").startsWith("https://github.com/")
        ? m.homepage.replace("https://github.com/", "").replace(/\/$/, "")
        : (m.checkver && typeof m.checkver === "object" && (m.checkver.github || "").startsWith("https://github.com/")
            ? m.checkver.github.replace("https://github.com/", "").replace(/\/$/, "")
            : null);
    apps.push({
      name: entry.name.replace(/\.json$/, ""),
      version: String(m.version),
      url: m.homepage,
      description: m.description || "",
      license: m.license || "",
      repo: repoFull,
    });
  }
  apps.sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}

// GitHub serves the current avatar at avatar_url; strip query params and request a fresh copy.
async function fetchProfileAvatar() {
  const user = await ghApi(`/users/${OWNER}`);
  const avatarUrl = `${user.avatar_url.split("?")[0]}?s=800`;
  const res = await fetch(avatarUrl, { headers: { "User-Agent": "noartem-site-sync" } });
  if (!res.ok) throw new Error(`Avatar fetch: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(SITE_ROOT, "assets", "profile.jpg");
  const prev = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
  if (prev && prev.equals(buf)) {
    console.log("assets/profile.jpg: unchanged");
    return false;
  }
  fs.writeFileSync(dest, buf);
  console.log(`assets/profile.jpg: updated (${buf.length} bytes, avatar_url=${user.avatar_url})`);
  return true;
}

function yamlString(s) {
  return /^[\w .,@/()[\]'-]+$/.test(s) && !/[:#]/.test(s.trim().slice(0, 2)) ? s : JSON.stringify(s);
}

function renderBucketYml(apps) {
  const lines = [
    "bucket:",
    "  install: |-",
    "    scoop bucket add noartem https://github.com/noartem/bucket",
    "    scoop install noartem/<name>",
    "  apps:",
  ];
  for (const a of apps) {
    lines.push(`    - name: ${a.name}`);
    lines.push(`      version: "${a.version}"`);
    lines.push(`      url: ${a.url}`);
    lines.push(`      description: ${yamlString(a.description)}`);
    lines.push(`      license: ${a.license || "Unknown"}`);
    if (a.repo) lines.push(`      repo: ${a.repo}`);
  }
  return lines.join("\n") + "\n";
}

function renderProfileReadme(projects, apps) {
  const projectRows = projects.map(
    (p) => `| ${p.stack.join(", ")} | [${p.name}](${p.url}) | ${(p.description || "").replace(/\n+/g, " ")} |`
  );
  const bucketRows = apps.map((a) => {
    const name = `[${a.name}](${a.url})`;
    const repo = a.repo ? `[${a.repo}](https://github.com/${a.repo})` : "—";
    return `| ${name} | ${a.version} | ${a.license} | ${repo} |`;
  });

  return `## Hi there 👋

- Software engineer interested in web
- :construction_worker: JavaScript, TypeScript, Vue, React, Golang, PHP, C++, Rust
- :mailbox_with_mail: <artem@noartem.ru>

## Portfolio

<!-- portfolio:start -->
| Stack | Name | Description |
|-------|------|-------------|
${projectRows.join("\n")}
<!-- portfolio:end -->

## Bucket

Scoop bucket with Windows apps I package and maintain: [noartem/bucket](https://github.com/noartem/bucket).

\`\`\`pwsh
scoop bucket add noartem https://github.com/noartem/bucket
scoop install noartem/twentymate
\`\`\`

<!-- bucket:start -->
| App | Version | License | Repository |
|-----|---------|---------|------------|
${bucketRows.join("\n")}
<!-- bucket:end -->
`;
}

function renderSiteBucketRows(apps) {
  return apps
    .map((a) => {
      const repo = a.repo ? ` · <a href="https://github.com/${a.repo}">repo</a>` : "";
      return `              <tr>
                <td><a href="${a.url}">${a.name}</a></td>
                <td><code>${a.version}</code></td>
                <td>${a.license || ""}</td>
                <td>${a.description}${repo}</td>
              </tr>`;
    })
    .join("\n");
}

async function main() {
  const [bucketApps, avatarChanged] = await Promise.all([fetchBucketApps(), fetchProfileAvatar()]);

  // 1. bucket.yml
  fs.writeFileSync(path.join(SITE_ROOT, "bucket.yml"), renderBucketYml(bucketApps));
  console.log(`bucket.yml: ${bucketApps.length} apps`);

  // 2. profile README
  const readmePath = path.join(PROFILE_REPO, "README.md");
  const indexYml = require("js-yaml").load(fs.readFileSync(path.join(SITE_ROOT, "index.yml"), "utf8"));
  if (fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, renderProfileReadme(indexYml.projects, bucketApps));
    console.log("profile README.md: updated");
  } else {
    console.warn(`profile repo not found at ${PROFILE_REPO}, skipping README`);
  }

  // 3. site bucket table rows for index.njk include
  fs.writeFileSync(path.join(SITE_ROOT, "_includes", "bucket-rows.njk"), renderSiteBucketRows(bucketApps) + "\n");
  console.log("_includes/bucket-rows.njk: updated");

  if (avatarChanged) console.log("avatar changed — site redeploy needed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
