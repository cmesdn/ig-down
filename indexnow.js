/**
 * indexnow.js — tell Bing, Yandex, Seznam and Naver about new or changed pages
 * the moment they are published, and accept weekly draft posts from the
 * GitHub Action (drafts only — never publish, edit or delete).
 */

import { listPosts, savePost, slugOf } from "./content.js";
import { notify } from "./store.js";

export const SITE = "https://igtodownload.com";

/** One random key per site, created on first use and kept in KV. */
export async function indexNowKey(env) {
  let k = await env.CONFIG.get("indexnow_key");
  if (!k) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    k = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    await env.CONFIG.put("indexnow_key", k);
  }
  return k;
}

/** Serves /<key>.txt so search engines can confirm we own the site. */
export async function serveKeyFile(path, env) {
  const m = path.match(/^\/([a-f0-9]{32})\.txt$/);
  if (!m) return null;
  const k = await env.CONFIG.get("indexnow_key");
  if (!k || k !== m[1]) return null;
  return new Response(k, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}

/** Ping IndexNow with a list of paths ("/blog/x"). Returns {ok,status}. */
export async function pingIndexNow(env, paths) {
  try {
    const key = await indexNowKey(env);
    const urlList = [...new Set(paths)].map((p) => SITE + p).slice(0, 100);
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: "igtodownload.com", key, keyLocation: SITE + "/" + key + ".txt", urlList }),
    });
    const res = { ok: r.status === 200 || r.status === 202, status: r.status, at: Date.now(), urls: urlList.length };
    await env.CONFIG.put("indexnow_last", JSON.stringify(res));
    return res;
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

/* ---------- drafts from the weekly writer ---------- */

function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function handleDrafts(request, env) {
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (request.method !== "POST") return j({ error: "POST only" }, 405);
  if (!env.DRAFT_KEY || env.DRAFT_KEY.length < 24) return j({ error: "DRAFT_KEY secret is not set on the Worker" }, 503);
  const auth = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!same(auth, env.DRAFT_KEY)) return j({ error: "unauthorized" }, 401);

  const b = await request.json().catch(() => null);
  const posts = b && Array.isArray(b.posts) ? b.posts.slice(0, 10) : [];
  if (!posts.length) return j({ error: "no posts" }, 400);

  const existing = new Set((await listPosts(env, true)).map((p) => p.slug));
  const out = [];
  for (const p of posts) {
    const slug = slugOf(p.slug || p.title);
    if (!slug || !p.title || !p.md) { out.push({ slug, result: "invalid" }); continue; }
    if (existing.has(slug)) { out.push({ slug, result: "exists" }); continue; }   // re-runs are harmless
    try {
      await savePost(env, { title: p.title, slug, desc: p.desc, kw: p.kw, md: p.md, status: "draft" }, "");
      existing.add(slug);
      out.push({ slug, result: "created" });
    } catch (e) {
      out.push({ slug, result: "error" });
    }
  }
  const made = out.filter((x) => x.result === "created");
  if (made.length) {
    await notify(env, "📝 " + made.length + " new draft post(s) are waiting in Admin → Blog:\n" + made.map((x) => "• " + x.slug).join("\n"));
    await env.CONFIG.put("draftping", JSON.stringify({ n: made.length, at: Date.now() }));
  }
  return j({ ok: true, results: out });
}
