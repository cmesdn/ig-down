// Sends draft posts (drafts/**/*.md) to the site as DRAFTS in Admin → Blog.
// Usage: node scripts/upload-drafts.mjs file1.md file2.md ...
// Needs env DRAFT_KEY (GitHub secret). Never publishes anything.
import { readFileSync } from "node:fs";

const files = process.argv.slice(2).filter((f) => f.endsWith(".md"));
if (!files.length) { console.log("No draft files in this push."); process.exit(0); }
if (!process.env.DRAFT_KEY) { console.error("DRAFT_KEY secret is missing in GitHub → Settings → Secrets → Actions."); process.exit(1); }

function parse(src, file) {
  const m = src.replace(/\r\n?/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(file + ": missing --- front matter ---");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const k = line.match(/^(\w+):\s*(.*)$/);
    if (k) meta[k[1]] = k[2].replace(/^["']|["']$/g, "").trim();
  }
  if (!meta.title) throw new Error(file + ": title is missing");
  return { title: meta.title, slug: meta.slug || "", desc: meta.desc || meta.description || "", kw: meta.kw || meta.keywords || "", md: m[2].trim() };
}

const posts = files.map((f) => parse(readFileSync(f, "utf8"), f));
const site = process.env.SITE || "https://igtodownload.com";
const r = await fetch(site + "/api/drafts", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer " + process.env.DRAFT_KEY },
  body: JSON.stringify({ posts }),
});
const t = await r.text();
console.log(r.status, t);
if (!r.ok) process.exit(1);
const res = JSON.parse(t).results || [];
for (const x of res) console.log(" -", x.slug, x.result);
if (res.some((x) => x.result === "invalid" || x.result === "error")) process.exit(1);
