/**
 * resolve.js — Instagram resolver
 *
 * Reliability layers, tried in order until one works:
 *   1. every live cookie  × 4 methods
 *   2. anonymous (no cookie) × 4 methods      <- works for some public posts
 *   3. external resolver API (optional)       <- last resort, set in /admin
 *
 * Optional proxy: every outbound Instagram request can be routed through a
 * URL-template proxy, set in /admin. Leave it empty and nothing changes.
 */

import { getConfig, getCookies, saveCookies, pickOrder, logEvent, notify, rememberGoodCode, probeCode } from "./store.js";

export const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const APP_UA =
  "Instagram 309.1.0.41.113 Android (30/11; 420dpi; 1080x2340; Xiaomi; M2101K6G; sweet; qcom; en_US; 541635890)";
const APP_ID = "936619743392459";
const DOC_ID = "10015901848480474";
const LINK_TTL = 7200;

/**
 * Only these count against a cookie. A 400/404/"no items" means the POST is
 * gone or private — blaming the cookie for that is what used to kill the pool.
 */
function isAuthError(msg) {
  return /\b(401|403|429)\b|login wall|checkpoint|challenge|not authorized|please wait/i.test(String(msg || ""));
}

/* ========================= public API ========================= */

export function shortcode(input) {
  const s = (input || "").trim();
  const m = s.match(/instagram\.com\/(?:[\w.\-]+\/)?(?:reels?|reel|p|tv|share\/(?:reel|p))\/([A-Za-z0-9_\-]{5,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_\-]{8,16}$/.test(s)) return s;
  return null;
}

export async function resolveMedia(code, env, ctx, opts = {}) {
  const cfg = await getConfig(env);
  const net = netFrom(cfg);
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
  const errKind = new Map(); // cookie id -> "auth" | "other"
  let result = null, usedCookie = null;

  // layer 1 + 2: every live cookie, then anonymous
  const candidates = order.concat([{ id: "__anon", label: "anonymous", value: "" }]);

  outer: for (const ck of candidates) {
    for (const fn of METHODS) {
      try {
        const r = await fn(code, ck.value, net);
        if (r && r.items.length) {
          result = r;
          usedCookie = ck;
          attempts.push({ cookie: ck.id, method: fn.name, ok: true });
          break outer;
        }
        attempts.push({ cookie: ck.id, method: fn.name, ok: false, error: "empty" });
        if (!errKind.has(ck.id)) errKind.set(ck.id, "other");
      } catch (e) {
        const msg = (e && e.message) || String(e);
        attempts.push({ cookie: ck.id, method: fn.name, ok: false, error: msg });
        if (isAuthError(msg)) {
          errKind.set(ck.id, "auth");
          if (fn === METHODS[0]) break; // this cookie is rejected, move on
        } else if (!errKind.has(ck.id)) {
          errKind.set(ck.id, "other");
        }
      }
    }
  }

  // layer 3: external resolver API
  if (!result && net.apiTemplate) {
    try {
      const r = await viaExternalApi(code, "", net);
      if (r && r.items.length) {
        result = r;
        attempts.push({ cookie: "external", method: "external-api", ok: true });
      }
    } catch (e) {
      attempts.push({ cookie: "external", method: "external-api", ok: false, error: (e && e.message) || String(e) });
    }
  }

  const ms = Date.now() - t0;

  if (ctx) {
    const byCookie = usedCookie && usedCookie.id !== "__anon" ? usedCookie : null;
    ctx.waitUntil(markCookies(env, cookies, byCookie, errKind));
    if (result) ctx.waitUntil(rememberGoodCode(env, code));
    ctx.waitUntil(
      logEvent(env, {
        kind: "resolve",
        ok: !!result,
        method: result ? result.via : "",
        ms,
        country: opts.country || "",
        err: result ? "" : attempts.length ? attempts[attempts.length - 1].error : "no attempt",
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

async function decorate(media, code, env) {
  const items = [];
  for (let i = 0; i < media.items.length; i++) {
    const it = media.items[i];
    const ext = it.type === "image" ? ".jpg" : ".mp4";
    const name = "igtodownload.com_" + code + (media.items.length > 1 ? "-" + (i + 1) : "") + ext;
    items.push({
      type: it.type,
      width: it.width || null,
      height: it.height || null,
      quality: it.width ? it.width + "×" + it.height : "Original",
      duration: it.duration || null,
      thumb: it.thumb ? await signed("/img", it.thumb, "thumb.jpg", env) : null,
      play: it.type === "video" ? await signed("/stream", it.url, "v.mp4", env) : null,
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

/* ===================== networking ===================== */

function netFrom(cfg) {
  const s = cfg.settings || {};
  let ph = {}, ah = {};
  try { if (s.proxyHeaders) ph = JSON.parse(s.proxyHeaders); } catch (_) {}
  try { if (s.apiHeaders) ah = JSON.parse(s.apiHeaders); } catch (_) {}
  return {
    proxyTemplate: (s.proxyTemplate || "").trim(),
    proxyHeaders: ph,
    apiTemplate: (s.apiTemplate || "").trim(),
    apiHeaders: ah,
  };
}

/** every Instagram call goes through here, so the proxy is a one-line switch */
async function go(url, init, net) {
  if (net && net.proxyTemplate) {
    const target = net.proxyTemplate.includes("{url}")
      ? net.proxyTemplate.replace("{url}", encodeURIComponent(url))
      : net.proxyTemplate + encodeURIComponent(url);
    const headers = Object.assign({}, init.headers || {}, net.proxyHeaders || {});
    return fetch(target, Object.assign({}, init, { headers }));
  }
  return fetch(url, init);
}

/* ========================= methods ========================= */

async function viaMobileApi(code, cookie, net) {
  const id = mediaId(code);
  if (!id) throw new Error("bad shortcode");
  const r = await go("https://i.instagram.com/api/v1/media/" + id + "/info/", { headers: appHeaders(cookie) }, net);
  const txt = await r.text();
  if (isHtml(txt)) throw new Error("login wall (html " + r.status + ")");
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
    via: "mobile-api", items,
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

async function viaGraphQL(code, cookie, net) {
  const body = new URLSearchParams({ doc_id: DOC_ID, variables: JSON.stringify({ shortcode: code }) });
  const r = await go("https://www.instagram.com/api/graphql", {
    method: "POST",
    headers: webHeaders(cookie, { "content-type": "application/x-www-form-urlencoded" }),
    body,
  }, net);
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
    via: "graphql", items,
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

async function viaEmbed(code, cookie, net) {
  const r = await go("https://www.instagram.com/p/" + code + "/embed/captioned/", { headers: webHeaders(cookie) }, net);
  const html = await r.text();
  const vid = unesc(html.match(/"video_url"\s*:\s*"([^"]+)"/));
  if (!vid) throw new Error("video_url not found");
  return {
    via: "embed",
    items: [{ type: "video", url: vid, thumb: unesc(html.match(/"display_url"\s*:\s*"([^"]+)"/)) }],
    username: unesc(html.match(/"username"\s*:\s*"([^"]+)"/)),
  };
}

async function viaOgTag(code, cookie, net) {
  const r = await go("https://www.instagram.com/reel/" + code + "/", { headers: webHeaders(cookie) }, net);
  const html = await r.text();
  const vid = (html.match(/property=["']og:video["']\s+content=["']([^"']+)["']/) || html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/) || [])[1];
  if (!vid) throw new Error("og:video not found");
  const thumb = (html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/) || [])[1];
  return { via: "og", items: [{ type: "video", url: deHtml(vid), thumb: thumb && deHtml(thumb) }] };
}

/**
 * Last resort. Set an endpoint template in /admin, e.g.
 *   https://some-api.example.com/ig?url={url}
 * Response shape does not matter: the JSON is scanned for media URLs.
 */
async function viaExternalApi(code, _cookie, net) {
  if (!net.apiTemplate) throw new Error("no external api configured");
  const postUrl = "https://www.instagram.com/reel/" + code + "/";
  const target = net.apiTemplate.includes("{url}")
    ? net.apiTemplate.replace("{url}", encodeURIComponent(postUrl))
    : net.apiTemplate.replace("{shortcode}", code);
  const r = await go(target, { headers: Object.assign({ accept: "application/json" }, net.apiHeaders) }, null);
  if (!r.ok) throw new Error("api http " + r.status);
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); } catch { throw new Error("api returned non-json"); }

  const urls = scanUrls(j);
  const vids = urls.filter((u) => /\.mp4(\?|$)/i.test(u));
  const imgs = urls.filter((u) => /\.(jpe?g|webp)(\?|$)/i.test(u));
  if (!vids.length && !imgs.length) throw new Error("api gave no media url");

  const items = vids.length
    ? [{ type: "video", url: vids[0], thumb: imgs[0] || null }]
    : [{ type: "image", url: imgs[0], thumb: imgs[0] }];
  return { via: "external-api", items };
}

function scanUrls(o, out = []) {
  if (typeof o === "string") {
    if (/^https?:\/\/[^\s"]+\.(mp4|jpe?g|webp)(\?|$)/i.test(o)) out.push(o);
  } else if (Array.isArray(o)) o.forEach((x) => scanUrls(x, out));
  else if (o && typeof o === "object") Object.values(o).forEach((x) => scanUrls(x, out));
  return out;
}

const METHODS = [viaMobileApi, viaGraphQL, viaEmbed, viaOgTag];

/* ===================== cookie health ===================== */

async function markCookies(env, all, used, errKind) {
  let changed = false;
  const byId = new Map(all.map((c) => [c.id, c]));
  const now = Date.now();

  if (used && byId.has(used.id)) {
    const c = byId.get(used.id);
    c.fails = 0; c.uses = (c.uses || 0) + 1; c.lastOk = now; c.lastError = "";
    if (c.status !== "ok") c.status = "ok";
    changed = true;
  }

  // Only auth rejections count. A private or deleted post is not the cookie's fault.
  for (const [id, kind] of errKind) {
    if (kind !== "auth") continue;
    const c = byId.get(id);
    if (!c || (used && c.id === used.id)) continue;
    c.fails = (c.fails || 0) + 1;
    // a cookie that worked in the last half hour gets the benefit of the doubt
    if (c.lastOk && now - c.lastOk < 1800_000) c.fails = Math.min(c.fails, 2);
    changed = true;
  }

  if (!changed) return;

  const died = [];
  for (const c of all) {
    if (c.fails >= 5 && c.status !== "dead") { c.status = "dead"; died.push(c.label || c.id); }
    else if (c.fails > 0 && c.fails < 5 && c.status === "ok") c.status = "warn";
  }
  await saveCookies(env, all);
  if (died.length) await notify(env, "\u26a0\ufe0f IGtoDownload: cookie dead \u2014 " + died.join(", "));
  if (all.length && all.every((c) => c.status === "dead"))
    await notify(env, "\ud83d\udea8 IGtoDownload: ALL cookies are dead. Running on fallbacks only. Add a fresh sessionid in /admin.");
}

export async function healthCheck(env) {
  const cfg = await getConfig(env);
  const net = netFrom(cfg);
  const list = await getCookies(env);
  if (!list.length) return { checked: 0, live: 0, revived: 0, note: "no cookies yet" };

  const code = await probeCode(env, cfg);
  if (!code) {
    // Nothing safe to test against — do nothing rather than guess and kill the pool.
    return {
      checked: 0,
      live: list.filter((c) => c.status !== "dead").length,
      revived: 0,
      note: "No test post known yet. Download one reel on the site, or set a test link in Settings.",
    };
  }

  let revived = 0, passed = 0, authFails = 0, otherFails = 0;
  const pending = [];

  for (const c of list) {
    try {
      const r = await viaMobileApi(code, c.value, net);
      if (r && r.items.length) {
        if (c.status === "dead") revived++;
        c.status = "ok"; c.fails = 0; c.lastOk = Date.now(); c.lastError = "";
        passed++;
      } else {
        otherFails++;
        pending.push([c, "empty response"]);
      }
    } catch (e) {
      const msg = ((e && e.message) || "").slice(0, 80);
      if (isAuthError(msg)) { authFails++; pending.push([c, msg, true]); }
      else { otherFails++; pending.push([c, msg]); }
    }
  }

  // Every cookie failing with the same non-auth error means the test post is
  // gone, not that the cookies are bad. Leave statuses untouched.
  const probeBad = passed === 0 && authFails === 0 && otherFails === list.length;
  if (probeBad) {
    try { await env.CONFIG.delete("lastgood"); } catch (_) {}
    for (const [c, msg] of pending) c.lastError = "test post unavailable (" + msg + ")";
    await saveCookies(env, list);
    return {
      checked: list.length,
      live: list.filter((c) => c.status !== "dead").length,
      revived: 0,
      note: "The test post is no longer available, so nothing was marked dead. Download any reel on the site and a new test post is picked automatically.",
    };
  }

  for (const [c, msg, isAuth] of pending) {
    c.lastError = msg;
    if (!isAuth) continue;
    c.fails = (c.fails || 0) + 1;
    if (c.fails >= 5) c.status = "dead";
    else if (c.status === "ok") c.status = "warn";
  }

  await saveCookies(env, list);
  const live = list.filter((c) => c.status !== "dead").length;
  if (!live) await notify(env, "\ud83d\udea8 IGtoDownload: health check found 0 working cookies.");
  return { checked: list.length, live, revived };
}

export async function testCookie(value, env) {
  const cfg = env ? await getConfig(env) : null;
  const net = cfg ? netFrom(cfg) : null;
  const code = env ? await probeCode(env, cfg) : null;
  if (!code)
    return { ok: null, ms: 0, error: "No test post known yet — saved without testing. Download one reel on the site first." };
  const t0 = Date.now();
  try {
    const r = await viaMobileApi(code, value, net);
    return { ok: !!(r && r.items.length), ms: Date.now() - t0 };
  } catch (e) {
    const msg = (e && e.message) || String(e);
    if (!isAuthError(msg)) return { ok: null, ms: Date.now() - t0, error: "Test post unavailable (" + msg + ") — cookie not judged." };
    return { ok: false, ms: Date.now() - t0, error: msg };
  }
}

export async function diagnose(code, env) {
  const cfg = await getConfig(env);
  const net = netFrom(cfg);
  const cookies = await getCookies(env);
  const pool = cookies.concat([{ id: "__anon", label: "anonymous", value: "" }]);
  const rows = [];
  for (const c of pool) {
    for (const fn of METHODS) {
      const t0 = Date.now();
      try {
        const r = await fn(code, c.value, net);
        rows.push({ cookie: c.label || c.id, method: fn.name, ok: !!(r && r.items.length), items: r ? r.items.length : 0, ms: Date.now() - t0 });
      } catch (e) {
        rows.push({ cookie: c.label || c.id, method: fn.name, ok: false, error: (e && e.message) || String(e), ms: Date.now() - t0 });
      }
    }
  }
  if (net.apiTemplate) {
    const t0 = Date.now();
    try {
      const r = await viaExternalApi(code, "", net);
      rows.push({ cookie: "external api", method: "external-api", ok: !!(r && r.items.length), items: r ? r.items.length : 0, ms: Date.now() - t0 });
    } catch (e) {
      rows.push({ cookie: "external api", method: "external-api", ok: false, error: (e && e.message) || String(e), ms: Date.now() - t0 });
    }
  }
  return rows;
}

/* ===================== proxies ===================== */

export async function handleDownload(request, url, env) {
  const v = await verifyLink(url, env);
  if (v.error) return new Response(v.error, { status: v.status });

  const range = request.headers.get("range");
  const upstream = await fetch(v.target, {
    headers: Object.assign({ "user-agent": WEB_UA, referer: "https://www.instagram.com/" }, range ? { range } : {}),
  });
  if (!upstream.ok && upstream.status !== 206) return new Response("upstream " + upstream.status, { status: 502 });

  let name = (url.searchParams.get("n") || "video.mp4").replace(/[^\w.\-]/g, "");
  if (!name.startsWith("igtodownload.com")) name = "igtodownload.com_" + name.replace(/^igtodownload-/, "");
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

/** same media, but inline — used by the tap-to-play preview */
export async function handleStream(request, url, env) {
  const v = await verifyLink(url, env);
  if (v.error) return new Response(v.error, { status: v.status });
  const range = request.headers.get("range");
  const upstream = await fetch(v.target, {
    headers: Object.assign({ "user-agent": WEB_UA, referer: "https://www.instagram.com/" }, range ? { range } : {}),
  });
  if (!upstream.ok && upstream.status !== 206) return new Response("upstream " + upstream.status, { status: 502 });
  const h = new Headers();
  h.set("content-type", "video/mp4");
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "private, max-age=600");
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
    headers: { "content-type": upstream.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=3600" },
  });
}

async function verifyLink(url, env) {
  const t = url.searchParams.get("t"), s = url.searchParams.get("s");
  if (!t || !s) return { error: "missing token", status: 400 };
  if (!(await verifySig(t, s, env))) return { error: "bad signature", status: 403 };
  let p;
  try { p = JSON.parse(utf8(unb64(t))); } catch { return { error: "bad token", status: 400 }; }
  if (p.e < Math.floor(Date.now() / 1000)) return { error: "This link expired. Please paste the link again.", status: 410 };
  return { target: p.u };
}

/* ===================== signing ===================== */

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

/* ===================== helpers ===================== */

function appHeaders(cookie) {
  const h = { "user-agent": APP_UA, "x-ig-app-id": APP_ID, "x-ig-capabilities": "3brTvw==", "x-ig-connection-type": "WIFI", "accept-language": "en-US", accept: "*/*" };
  if (cookie) h.cookie = cookie;
  return h;
}
function webHeaders(cookie, extra) {
  const h = {
    "user-agent": WEB_UA, "x-ig-app-id": APP_ID, "accept-language": "en-US,en;q=0.9",
    referer: "https://www.instagram.com/", origin: "https://www.instagram.com",
    "sec-fetch-site": "same-origin", "x-requested-with": "XMLHttpRequest",
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
