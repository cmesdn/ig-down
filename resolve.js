/**
 * resolve.js — Instagram resolver, cookie pool, edge cache, signed links
 */

import { getConfig, getCookies, saveCookies, pickOrder, logEvent, notify } from "./store.js";

export const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const APP_UA =
  "Instagram 309.1.0.41.113 Android (30/11; 420dpi; 1080x2340; Xiaomi; M2101K6G; sweet; qcom; en_US; 541635890)";
const APP_ID = "936619743392459";
const DOC_ID = "10015901848480474";
const LINK_TTL = 7200;
const PROBE = "https://www.instagram.com/reel/C5Qf0xAr9Jx/"; // public reel used for health checks

/* ========================= public API ========================= */

export function shortcode(input) {
  const s = (input || "").trim();
  const m = s.match(/instagram\.com\/(?:[\w.\-]+\/)?(?:reels?|reel|p|tv|share\/(?:reel|p))\/([A-Za-z0-9_\-]{5,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_\-]{8,16}$/.test(s)) return s;
  return null;
}

/**
 * Resolve a shortcode to media + metadata.
 * Order: edge cache -> cookie pool x methods -> cache store.
 */
export async function resolveMedia(code, env, ctx, opts = {}) {
  const cfg = await getConfig(env);
  const salt = cfg.settings.cacheSalt || 0;
  const cacheKey = new Request("https://cache.igto/v3/" + salt + "/" + code);
  const cache = caches.default;

  if (!opts.noCache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const data = await hit.json();
      data.cached = true;
      return data;
    }
  }

  const t0 = Date.now();
  const cookies = await getCookies(env);
  const order = pickOrder(cookies);
  const attempts = [];
  let result = null;
  let usedCookie = null;

  // anonymous first only when there are no cookies at all
  const candidates = order.length ? order : [{ id: "anon", value: "" }];

  outer: for (const ck of candidates) {
    for (const fn of METHODS) {
      try {
        const r = await fn(code, ck.value);
        if (r && r.items.length) {
          result = r;
          usedCookie = ck;
          attempts.push({ cookie: ck.id, method: fn.name, ok: true });
          break outer;
        }
        attempts.push({ cookie: ck.id, method: fn.name, ok: false, error: "empty" });
      } catch (e) {
        const msg = (e && e.message) || String(e);
        attempts.push({ cookie: ck.id, method: fn.name, ok: false, error: msg });
        // auth failure -> this cookie is suspect, stop trying it and move to the next one
        if (/401|403|login wall|checkpoint|challenge/i.test(msg) && fn === METHODS[0]) break;
      }
    }
  }

  const ms = Date.now() - t0;

  if (ctx) {
    ctx.waitUntil(markCookies(env, cookies, usedCookie, candidates, !!result));
    ctx.waitUntil(
      logEvent(env, {
        kind: "resolve",
        ok: !!result,
        method: result ? result.via : "",
        ms,
        country: opts.country || "",
        err: result ? "" : (attempts.length ? attempts[attempts.length - 1].error : "no attempt"),
      })
    );
  }

  if (!result) {
    const blocked = attempts.filter((a) => /401|403|login wall/i.test(a.error || "")).length;
    const err = new Error(
      blocked >= 2
        ? "Instagram is blocking this server right now. The session cookies need refreshing."
        : "Could not find this post. It may be private, deleted, or the link is wrong."
    );
    err.attempts = attempts;
    err.blocked = blocked >= 2;
    throw err;
  }

  const payload = await decorate(result, code, env);
  payload.ms = ms;

  if (ctx) {
    const ttl = Math.max(60, Math.min(cfg.settings.cacheTtl || 3600, 21600));
    const res = new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=" + ttl },
    });
    ctx.waitUntil(cache.put(cacheKey, res));
  }
  return payload;
}

/** turn raw media into signed, client-ready JSON */
async function decorate(media, code, env) {
  const items = [];
  for (let i = 0; i < media.items.length; i++) {
    const it = media.items[i];
    const ext = it.type === "image" ? ".jpg" : ".mp4";
    const name = "igtodownload-" + code + (media.items.length > 1 ? "-" + (i + 1) : "") + ext;
    items.push({
      type: it.type,
      width: it.width || null,
      height: it.height || null,
      quality: it.width ? it.width + "×" + it.height : "Original",
      duration: it.duration || null,
      thumb: it.thumb ? await signed("/img", it.thumb, "thumb.jpg", env) : null,
      url: await signed("/dl", it.url, name, env),
    });
  }
  return {
    ok: true,
    shortcode: code,
    via: media.via,
    username: media.username || null,
    fullName: media.fullName || null,
    avatar: media.avatar ? await signed("/img", media.avatar, "a.jpg", env) : null,
    caption: media.caption || null,
    likes: media.likes ?? null,
    comments: media.comments ?? null,
    views: media.views ?? null,
    takenAt: media.takenAt || null,
    items,
  };
}

/* ===================== cookie health bookkeeping ===================== */

async function markCookies(env, all, used, tried, success) {
  let changed = false;
  const byId = new Map(all.map((c) => [c.id, c]));

  if (success && used && byId.has(used.id)) {
    const c = byId.get(used.id);
    c.fails = 0;
    c.uses = (c.uses || 0) + 1;
    c.lastOk = Date.now();
    if (c.status !== "ok") { c.status = "ok"; }
    changed = true;
    // every cookie tried before the winner failed
    for (const t of tried) {
      if (t.id === used.id) break;
      const f = byId.get(t.id);
      if (f) { f.fails = (f.fails || 0) + 1; changed = true; }
    }
  } else if (!success) {
    for (const t of tried) {
      const f = byId.get(t.id);
      if (f) { f.fails = (f.fails || 0) + 1; changed = true; }
    }
  }

  if (!changed) return;
  let died = [];
  for (const c of all) {
    if (c.fails >= 3 && c.status !== "dead") { c.status = "dead"; died.push(c.label || c.id); }
    else if (c.fails > 0 && c.fails < 3 && c.status === "ok") c.status = "warn";
  }
  await saveCookies(env, all);

  if (died.length) await notify(env, "⚠️ IGtoDownload: cookie dead — " + died.join(", "));
  if (all.length && all.every((c) => c.status === "dead")) {
    await notify(env, "🚨 IGtoDownload: ALL cookies are dead. Downloads are failing. Add a fresh sessionid in /admin.");
  }
}

/** cron: test every cookie against a known public reel */
export async function healthCheck(env) {
  const list = await getCookies(env);
  if (!list.length) return { checked: 0 };
  const code = shortcode(PROBE);
  let revived = 0;
  for (const c of list) {
    try {
      const r = await viaMobileApi(code, c.value);
      if (r && r.items.length) {
        if (c.status === "dead") revived++;
        c.status = "ok";
        c.fails = 0;
        c.lastOk = Date.now();
      }
    } catch (e) {
      c.fails = (c.fails || 0) + 1;
      c.lastError = ((e && e.message) || "").slice(0, 80);
      if (c.fails >= 3) c.status = "dead";
      else if (c.status === "ok") c.status = "warn";
    }
  }
  await saveCookies(env, list);
  const live = list.filter((c) => c.status !== "dead").length;
  if (!live) await notify(env, "🚨 IGtoDownload: health check found 0 working cookies.");
  return { checked: list.length, live, revived };
}

/** admin: test one cookie value directly */
export async function testCookie(value) {
  const code = shortcode(PROBE);
  const t0 = Date.now();
  try {
    const r = await viaMobileApi(code, value);
    return { ok: !!(r && r.items.length), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: (e && e.message) || String(e) };
  }
}

/** admin diagnostics: run every method with every cookie */
export async function diagnose(code, env) {
  const cookies = await getCookies(env);
  const pool = cookies.length ? cookies : [{ id: "anon", label: "no cookie", value: "" }];
  const rows = [];
  for (const c of pool) {
    for (const fn of METHODS) {
      const t0 = Date.now();
      try {
        const r = await fn(code, c.value);
        rows.push({ cookie: c.label || c.id, method: fn.name, ok: !!(r && r.items.length), items: r ? r.items.length : 0, ms: Date.now() - t0 });
      } catch (e) {
        rows.push({ cookie: c.label || c.id, method: fn.name, ok: false, error: (e && e.message) || String(e), ms: Date.now() - t0 });
      }
    }
  }
  return rows;
}

/* ========================= methods ========================= */

async function viaMobileApi(code, cookie) {
  const id = mediaId(code);
  if (!id) throw new Error("bad shortcode");
  const r = await fetch("https://i.instagram.com/api/v1/media/" + id + "/info/", { headers: appHeaders(cookie) });
  const txt = await r.text();
  if (isHtml(txt)) throw new Error("login wall (html " + r.status + ")");
  if (r.status === 401 || r.status === 403) throw new Error("http " + r.status);
  if (!r.ok) throw new Error("http " + r.status);

  const j = JSON.parse(txt);
  const first = j.items && j.items[0];
  if (!first) throw new Error("no items");

  const items = [];
  const push = (n) => {
    if (n.video_versions && n.video_versions.length) {
      const best = n.video_versions.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      items.push({ type: "video", url: best.url, width: best.width, height: best.height, duration: n.video_duration, thumb: get(n, ["image_versions2", "candidates", 0, "url"]) });
    } else {
      const c = get(n, ["image_versions2", "candidates"]);
      if (c && c.length) {
        const best = c.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
        items.push({ type: "image", url: best.url, width: best.width, height: best.height, thumb: best.url });
      }
    }
  };
  if (first.carousel_media && first.carousel_media.length) first.carousel_media.forEach(push);
  else push(first);

  return {
    via: "mobile-api",
    items,
    username: get(first, ["user", "username"]),
    fullName: get(first, ["user", "full_name"]),
    avatar: get(first, ["user", "profile_pic_url"]),
    caption: get(first, ["caption", "text"]),
    likes: first.like_count,
    comments: first.comment_count,
    views: first.play_count || first.view_count || null,
    takenAt: first.taken_at ? first.taken_at * 1000 : null,
  };
}

async function viaGraphQL(code, cookie) {
  const body = new URLSearchParams({ doc_id: DOC_ID, variables: JSON.stringify({ shortcode: code }) });
  const r = await fetch("https://www.instagram.com/api/graphql", {
    method: "POST",
    headers: webHeaders(cookie, { "content-type": "application/x-www-form-urlencoded" }),
    body,
  });
  const txt = await r.text();
  if (isHtml(txt)) throw new Error("login wall (html " + r.status + ")");
  const j = JSON.parse(txt);
  const m = j && j.data && j.data.xdt_shortcode_media;
  if (!m) throw new Error("no media node");

  const items = [];
  const push = (n) => {
    if (n.is_video && n.video_url)
      items.push({ type: "video", url: n.video_url, width: get(n, ["dimensions", "width"]), height: get(n, ["dimensions", "height"]), thumb: n.display_url });
    else if (n.display_url)
      items.push({ type: "image", url: n.display_url, width: get(n, ["dimensions", "width"]), height: get(n, ["dimensions", "height"]), thumb: n.display_url });
  };
  const kids = get(m, ["edge_sidecar_to_children", "edges"]);
  if (kids && kids.length) kids.forEach((e) => push(e.node));
  else push(m);

  return {
    via: "graphql",
    items,
    username: get(m, ["owner", "username"]),
    fullName: get(m, ["owner", "full_name"]),
    avatar: get(m, ["owner", "profile_pic_url"]),
    caption: get(m, ["edge_media_to_caption", "edges", 0, "node", "text"]),
    likes: get(m, ["edge_media_preview_like", "count"]),
    comments: get(m, ["edge_media_to_comment", "count"]),
    views: m.video_view_count || null,
    takenAt: m.taken_at_timestamp ? m.taken_at_timestamp * 1000 : null,
  };
}

async function viaEmbed(code, cookie) {
  const r = await fetch("https://www.instagram.com/p/" + code + "/embed/captioned/", { headers: webHeaders(cookie) });
  const html = await r.text();
  const vid = unesc(html.match(/"video_url"\s*:\s*"([^"]+)"/));
  if (!vid) throw new Error("video_url not found");
  return {
    via: "embed",
    items: [{ type: "video", url: vid, thumb: unesc(html.match(/"display_url"\s*:\s*"([^"]+)"/)) }],
    username: unesc(html.match(/"username"\s*:\s*"([^"]+)"/)),
  };
}

async function viaOgTag(code, cookie) {
  const r = await fetch("https://www.instagram.com/reel/" + code + "/", { headers: webHeaders(cookie) });
  const html = await r.text();
  const vid = (html.match(/property=["']og:video["']\s+content=["']([^"']+)["']/) || html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/) || [])[1];
  if (!vid) throw new Error("og:video not found");
  const thumb = (html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/) || [])[1];
  return { via: "og", items: [{ type: "video", url: deHtml(vid), thumb: thumb && deHtml(thumb) }] };
}

const METHODS = [viaMobileApi, viaGraphQL, viaEmbed, viaOgTag];

/* ========================= proxies ========================= */

export async function handleDownload(request, url, env) {
  const v = await verifyLink(url, env);
  if (v.error) return new Response(v.error, { status: v.status });

  const range = request.headers.get("range");
  const upstream = await fetch(v.target, {
    headers: Object.assign({ "user-agent": WEB_UA, referer: "https://www.instagram.com/" }, range ? { range } : {}),
  });
  if (!upstream.ok && upstream.status !== 206) return new Response("upstream " + upstream.status, { status: 502 });

  const name = (url.searchParams.get("n") || "video.mp4").replace(/[^\w.\-]/g, "");
  const h = new Headers();
  h.set("content-type", name.endsWith(".jpg") ? "image/jpeg" : "video/mp4");
  h.set("content-disposition", 'attachment; filename="' + name + '"');
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "private, no-store");
  for (const k of ["content-length", "content-range"]) {
    const val = upstream.headers.get(k);
    if (val) h.set(k, val);
  }
  return new Response(upstream.body, { status: upstream.status, headers: h });
}

export async function handleImage(url, env) {
  const v = await verifyLink(url, env);
  if (v.error) return new Response(v.error, { status: v.status });
  const upstream = await fetch(v.target, { headers: { "user-agent": WEB_UA, referer: "https://www.instagram.com/" } });
  if (!upstream.ok) return new Response("upstream " + upstream.status, { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=3600",
    },
  });
}

async function verifyLink(url, env) {
  const t = url.searchParams.get("t");
  const s = url.searchParams.get("s");
  if (!t || !s) return { error: "missing token", status: 400 };
  if (!(await verifySig(t, s, env))) return { error: "bad signature", status: 403 };
  let p;
  try { p = JSON.parse(utf8(unb64(t))); } catch { return { error: "bad token", status: 400 }; }
  if (p.e < Math.floor(Date.now() / 1000)) return { error: "This link expired. Please paste the link again.", status: 410 };
  return { target: p.u };
}

/* ========================= signing ========================= */

async function key(env) {
  const secret = (env && env.SIGN_SECRET) || "igtodownload-default-change-me";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signed(path, target, name, env) {
  const t = b64(new TextEncoder().encode(JSON.stringify({ u: target, e: Math.floor(Date.now() / 1000) + LINK_TTL })));
  const s = b64(await crypto.subtle.sign("HMAC", await key(env), new TextEncoder().encode(t)));
  return path + "?t=" + encodeURIComponent(t) + "&s=" + encodeURIComponent(s) + "&n=" + encodeURIComponent(name);
}
async function verifySig(t, s, env) {
  try { return await crypto.subtle.verify("HMAC", await key(env), unb64(s), new TextEncoder().encode(t)); }
  catch { return false; }
}

/* ========================= helpers ========================= */

function appHeaders(cookie) {
  const h = {
    "user-agent": APP_UA,
    "x-ig-app-id": APP_ID,
    "x-ig-capabilities": "3brTvw==",
    "x-ig-connection-type": "WIFI",
    "accept-language": "en-US",
    accept: "*/*",
  };
  if (cookie) h.cookie = cookie;
  return h;
}
function webHeaders(cookie, extra) {
  const h = {
    "user-agent": WEB_UA,
    "x-ig-app-id": APP_ID,
    "accept-language": "en-US,en;q=0.9",
    referer: "https://www.instagram.com/",
    origin: "https://www.instagram.com",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
  };
  if (cookie) h.cookie = cookie;
  return Object.assign(h, extra || {});
}
function mediaId(code) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = 0n;
  for (const ch of code.slice(0, 11)) {
    const i = A.indexOf(ch);
    if (i < 0) return null;
    id = id * 64n + BigInt(i);
  }
  return id.toString();
}
function isHtml(t) {
  const s = t.trim().slice(0, 200).toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html");
}
function unesc(m) {
  if (!m) return null;
  try { return JSON.parse('"' + m[1] + '"'); }
  catch { return m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"); }
}
function deHtml(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x2F;/g, "/").replace(/&#39;/g, "'");
}
function get(o, path) { return path.reduce((a, k) => (a == null ? a : a[k]), o); }
export function b64(buf) {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64(s) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function utf8(b) { return new TextDecoder().decode(b); }
