/**
 * ===========================================================
 *  Ig Down  —  Instagram Reels Downloader  (v2)
 *  Single-file Cloudflare Worker (UI + API + download proxy)
 * -----------------------------------------------------------
 *  v2 তে নতুন:
 *    - Method 0: Instagram mobile app API (সবচেয়ে ভালো কাজ করে)
 *    - HTML/login-wall detect করে পরিষ্কার error দেয়
 *    - video_versions থেকে সর্বোচ্চ resolution বেছে নেয়
 *    - /debug route — কোন method কী কারণে ফেল করছে দেখায়
 *
 *  Variables (Settings > Variables and Secrets):
 *    SIGN_SECRET  (Secret)  — যেকোনো ৪০+ অক্ষরের random string
 *    IG_COOKIE    (Secret)  — "sessionid=xxxx"  ← এটা ছাড়া প্রায়ই ব্লক হবে
 * ===========================================================
 */

const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const APP_UA =
  "Instagram 309.1.0.41.113 Android (30/11; 420dpi; 1080x2340; Xiaomi; M2101K6G; sweet; qcom; en_US; 541635890)";
const APP_ID = "936619743392459";
const DOC_ID = "10015901848480474";
const LINK_TTL = 3600;

/* ========================= ROUTER ========================= */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      if (url.pathname === "/api/resolve") {
        const limited = await rateLimit(request, env);
        if (limited) return limited;
        return cors(await apiResolve(url, env));
      }
      if (url.pathname === "/dl") return await proxyDownload(request, url, env);
      if (url.pathname === "/debug") return cors(await debugProbe(url, env));
      if (url.pathname === "/health")
        return cors(json({ ok: true, cookie: !!env.IG_COOKIE, secret: !!env.SIGN_SECRET }));
      return new Response(PAGE, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    } catch (e) {
      return cors(json({ ok: false, error: String((e && e.message) || e) }, 500));
    }
  },
};

/* ===================== RATE LIMITING ====================== */

async function rateLimit(request, env) {
  if (!env.RATE_LIMITER) return null;
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (success) return null;
  return cors(json({ ok: false, error: "একটু বেশি হয়ে যাচ্ছে — ১ মিনিট পর আবার চেষ্টা করুন।" }, 429));
}

/* ======================== RESOLVE ========================= */

const METHODS = [viaMobileApi, viaGraphQL, viaEmbed, viaOgTag];

async function apiResolve(url, env) {
  const input = (url.searchParams.get("url") || "").trim();
  if (!input) return json({ ok: false, error: "লিংক দিন।" }, 400);

  const code = shortcode(input);
  if (!code) return json({ ok: false, error: "এটা valid Instagram reel/post লিংক না।" }, 400);

  let media = null;
  const errors = [];
  let blocked = 0;

  for (const fn of METHODS) {
    try {
      media = await fn(code, env);
      if (media && media.items.length) break;
      media = null;
      errors.push(fn.name + ": empty");
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/login|blocked|html|challenge|401|403/i.test(msg)) blocked++;
      errors.push(fn.name + ": " + msg);
    }
  }

  if (!media) {
    const allBlocked = blocked >= 3;
    return json(
      {
        ok: false,
        error: allBlocked
          ? "Instagram এই সার্ভার থেকে request ব্লক করছে। IG_COOKIE সেট করলে ঠিক হয়ে যাবে।"
          : "ভিডিও পাওয়া গেল না। পোস্টটি private বা মুছে ফেলা হতে পারে।",
        hint: allBlocked && !env.IG_COOKIE ? "IG_COOKIE variable সেট করা নেই" : undefined,
        debug: errors,
      },
      502
    );
  }

  const out = [];
  for (let i = 0; i < media.items.length; i++) {
    const it = media.items[i];
    const name =
      "igdown-" + code + (media.items.length > 1 ? "-" + (i + 1) : "") + (it.type === "image" ? ".jpg" : ".mp4");
    out.push({
      type: it.type,
      width: it.width || null,
      height: it.height || null,
      quality: it.width ? it.width + "×" + it.height : "Original",
      thumb: it.thumb || null,
      size: await headSize(it.url),
      url: await signedLink(it.url, name, env),
    });
  }

  return json({
    ok: true,
    via: media.via,
    shortcode: code,
    username: media.username || null,
    caption: media.caption ? media.caption.slice(0, 180) : null,
    items: out,
  });
}

/* ---- method 0: Instagram mobile app API (সবচেয়ে reliable) ----
 * shortcode -> media_id (base64-64 decode) -> /api/v1/media/<id>/info/
 * video_versions array দেয়, তার সর্বোচ্চ width-টা নিই = best quality
 */
async function viaMobileApi(code, env) {
  const id = mediaId(code);
  if (!id) throw new Error("bad shortcode");

  const r = await fetch("https://i.instagram.com/api/v1/media/" + id + "/info/", {
    headers: appHeaders(env),
  });
  const txt = await r.text();
  if (looksLikeHtml(txt)) throw new Error("login wall (html " + r.status + ")");
  if (!r.ok) throw new Error("http " + r.status);

  const j = JSON.parse(txt);
  const first = j.items && j.items[0];
  if (!first) throw new Error("no items");

  const items = [];
  const push = (n) => {
    if (n.video_versions && n.video_versions.length) {
      const best = n.video_versions.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      items.push({
        type: "video",
        url: best.url,
        width: best.width,
        height: best.height,
        thumb: pick(n, ["image_versions2", "candidates", 0, "url"]),
      });
    } else {
      const c = pick(n, ["image_versions2", "candidates"]);
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
    username: pick(first, ["user", "username"]),
    caption: pick(first, ["caption", "text"]),
  };
}

/* ---- method 1: web GraphQL ---- */
async function viaGraphQL(code, env) {
  const body = new URLSearchParams({
    doc_id: DOC_ID,
    variables: JSON.stringify({ shortcode: code, fetch_tagged_user_count: null }),
  });

  const r = await fetch("https://www.instagram.com/api/graphql", {
    method: "POST",
    headers: webHeaders(env, { "content-type": "application/x-www-form-urlencoded" }),
    body,
  });
  const txt = await r.text();
  if (looksLikeHtml(txt)) throw new Error("login wall (html " + r.status + ")");

  const j = JSON.parse(txt);
  const m = j && j.data && j.data.xdt_shortcode_media;
  if (!m) throw new Error("no media node");

  const items = [];
  const push = (n) => {
    if (n.is_video && n.video_url)
      items.push({
        type: "video",
        url: n.video_url,
        width: pick(n, ["dimensions", "width"]),
        height: pick(n, ["dimensions", "height"]),
        thumb: n.display_url,
      });
    else if (n.display_url)
      items.push({
        type: "image",
        url: n.display_url,
        width: pick(n, ["dimensions", "width"]),
        height: pick(n, ["dimensions", "height"]),
        thumb: n.display_url,
      });
  };

  const kids = pick(m, ["edge_sidecar_to_children", "edges"]);
  if (kids && kids.length) kids.forEach((e) => push(e.node));
  else push(m);

  return {
    via: "graphql",
    items,
    username: pick(m, ["owner", "username"]),
    caption: pick(m, ["edge_media_to_caption", "edges", 0, "node", "text"]),
  };
}

/* ---- method 2: embed page scrape ---- */
async function viaEmbed(code, env) {
  const r = await fetch("https://www.instagram.com/p/" + code + "/embed/captioned/", {
    headers: webHeaders(env),
  });
  const html = await r.text();
  if (/LoginAndSignupPage|accounts\/login/.test(html) && !/"video_url"/.test(html))
    throw new Error("login wall");

  const vid = jsonStr(html.match(/"video_url"\s*:\s*"([^"]+)"/));
  if (!vid) throw new Error("video_url not found");

  return {
    via: "embed",
    items: [
      {
        type: "video",
        url: vid,
        thumb: jsonStr(html.match(/"display_url"\s*:\s*"([^"]+)"/)),
        width: num(html.match(/"width"\s*:\s*(\d+)/)),
        height: num(html.match(/"height"\s*:\s*(\d+)/)),
      },
    ],
    username: jsonStr(html.match(/"username"\s*:\s*"([^"]+)"/)),
  };
}

/* ---- method 3: og:video meta ---- */
async function viaOgTag(code, env) {
  const r = await fetch("https://www.instagram.com/reel/" + code + "/", { headers: webHeaders(env) });
  const html = await r.text();
  if (/accounts\/login/.test(html) && !/og:video/.test(html)) throw new Error("login wall");

  const vid =
    (html.match(/property=["']og:video["']\s+content=["']([^"']+)["']/) ||
      html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/) ||
      [])[1];
  if (!vid) throw new Error("og:video not found");

  const thumb = (html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/) || [])[1];
  return {
    via: "og",
    items: [{ type: "video", url: decodeHTML(vid), thumb: thumb && decodeHTML(thumb) }],
  };
}

/* ---- headers ---- */
function webHeaders(env, extra) {
  const h = {
    "user-agent": WEB_UA,
    "x-ig-app-id": APP_ID,
    "accept-language": "en-US,en;q=0.9",
    referer: "https://www.instagram.com/",
    origin: "https://www.instagram.com",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
  };
  if (env && env.IG_COOKIE) h.cookie = env.IG_COOKIE;
  return Object.assign(h, extra || {});
}
function appHeaders(env) {
  const h = {
    "user-agent": APP_UA,
    "x-ig-app-id": APP_ID,
    "x-ig-capabilities": "3brTvw==",
    "x-ig-connection-type": "WIFI",
    "accept-language": "en-US",
    accept: "*/*",
  };
  if (env && env.IG_COOKIE) h.cookie = env.IG_COOKIE;
  return h;
}

/* ---- shortcode -> media_id ---- */
function mediaId(code) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = 0n;
  const s = code.slice(0, 11);
  for (const ch of s) {
    const i = A.indexOf(ch);
    if (i < 0) return null;
    id = id * 64n + BigInt(i);
  }
  return id.toString();
}
function looksLikeHtml(t) {
  const s = t.trim().slice(0, 200).toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html");
}

/* ======================== /debug ========================== */

async function debugProbe(url, env) {
  const code = shortcode(url.searchParams.get("url") || "");
  if (!code) return json({ ok: false, error: "url param লাগবে" }, 400);

  const report = { shortcode: code, media_id: mediaId(code), cookie_set: !!env.IG_COOKIE, methods: {} };
  for (const fn of METHODS) {
    const t0 = Date.now();
    try {
      const r = await fn(code, env);
      report.methods[fn.name] = { ok: true, items: r.items.length, ms: Date.now() - t0 };
    } catch (e) {
      report.methods[fn.name] = { ok: false, error: (e && e.message) || String(e), ms: Date.now() - t0 };
    }
  }
  return json(report);
}

/* ==================== DOWNLOAD PROXY ====================== */

async function proxyDownload(request, url, env) {
  const t = url.searchParams.get("t");
  const s = url.searchParams.get("s");
  const n = url.searchParams.get("n") || "igdown.mp4";
  if (!t || !s) return new Response("missing token", { status: 400 });
  if (!(await verify(t, s, env))) return new Response("bad signature", { status: 403 });

  const payload = JSON.parse(utf8(unb64url(t)));
  if (payload.e < Math.floor(Date.now() / 1000))
    return new Response("link expired — আবার resolve করুন", { status: 410 });

  const range = request.headers.get("range");
  const upstream = await fetch(payload.u, {
    headers: Object.assign({ "user-agent": WEB_UA, referer: "https://www.instagram.com/" }, range ? { range } : {}),
  });
  if (!upstream.ok && upstream.status !== 206) return new Response("upstream " + upstream.status, { status: 502 });

  const h = new Headers();
  h.set("content-type", n.endsWith(".jpg") ? "image/jpeg" : "video/mp4");
  h.set("content-disposition", 'attachment; filename="' + n.replace(/[^\w.\-]/g, "") + '"');
  h.set("accept-ranges", "bytes");
  h.set("cache-control", "private, no-store");
  ["content-length", "content-range"].forEach((k) => {
    const v = upstream.headers.get(k);
    if (v) h.set(k, v);
  });
  return new Response(upstream.body, { status: upstream.status, headers: h });
}

/* ======================= SIGNING ========================== */

async function hmacKey(env) {
  const secret = (env && env.SIGN_SECRET) || "CHANGE_ME_IN_DASHBOARD";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}
async function signedLink(mediaUrl, name, env) {
  const t = b64url(
    new TextEncoder().encode(JSON.stringify({ u: mediaUrl, e: Math.floor(Date.now() / 1000) + LINK_TTL }))
  );
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(t)));
  return "/dl?t=" + encodeURIComponent(t) + "&s=" + encodeURIComponent(sig) + "&n=" + encodeURIComponent(name);
}
async function verify(t, s, env) {
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(env), unb64url(s), new TextEncoder().encode(t));
  } catch {
    return false;
  }
}

/* ======================== HELPERS ========================= */

function shortcode(input) {
  const m = input.match(/instagram\.com\/(?:[\w.\-]+\/)?(?:reels?|reel|p|tv|share\/reel)\/([A-Za-z0-9_\-]{5,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_\-]{8,}$/.test(input)) return input;
  return null;
}
async function headSize(u) {
  try {
    const r = await fetch(u, { method: "HEAD", headers: { "user-agent": WEB_UA, referer: "https://www.instagram.com/" } });
    const n = +r.headers.get("content-length");
    return n ? human(n) : null;
  } catch {
    return null;
  }
}
function human(n) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i ? 1 : 0) + " " + u[i];
}
function num(m) { return m ? +m[1] : null; }
function jsonStr(m) {
  if (!m) return null;
  try { return JSON.parse('"' + m[1] + '"'); }
  catch { return m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"); }
}
function decodeHTML(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x2F;/g, "/").replace(/&#39;/g, "'");
}
function pick(o, path) { return path.reduce((a, k) => (a == null ? a : a[k]), o); }
function b64url(buf) {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function utf8(buf) { return new TextDecoder().decode(buf); }
function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

/* ========================== UI ============================ */

const PAGE = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ig Down — Instagram Reels Downloader</title>
<meta name="description" content="Instagram Reels ডাউনলোড করুন সর্বোচ্চ কোয়ালিটিতে, ওয়াটারমার্ক ছাড়া। ফ্রি, লগইন ছাড়া।">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#08090c;--card:#111319;--line:#1f2330;--fg:#eef0f5;--mut:#8b90a0;--acc:#ff2e6c;--acc2:#8b5cf6;--ok:#22c55e}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--fg);font-family:'Hind Siliguri',system-ui,sans-serif;min-height:100vh;padding:20px 16px 56px;
    background-image:radial-gradient(60vw 45vh at 50% -8%,rgba(255,46,108,.16),transparent 70%),radial-gradient(50vw 40vh at 90% 10%,rgba(139,92,246,.12),transparent 70%)}
  .wrap{max-width:560px;margin:0 auto}
  header{text-align:center;padding:28px 0 26px}
  .logo{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;letter-spacing:-.5px}
  .logo b{background:linear-gradient(95deg,var(--acc),var(--acc2));-webkit-background-clip:text;background-clip:text;color:transparent}
  .tag{color:var(--mut);font-size:14px;margin-top:7px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
  .row{display:flex;gap:9px}
  input{flex:1;min-width:0;background:#0b0d12;color:var(--fg);border:1px solid var(--line);border-radius:12px;padding:14px;font-size:15px;font-family:inherit}
  input:focus{outline:none;border-color:var(--acc)}
  input::placeholder{color:#575c6b}
  button{font-family:inherit;font-weight:700;font-size:15px;border:0;border-radius:12px;cursor:pointer;background:linear-gradient(95deg,var(--acc),var(--acc2));color:#fff;padding:14px 20px;white-space:nowrap}
  button:disabled{opacity:.55;cursor:default}
  .ghost{background:#171a22;border:1px solid var(--line);color:var(--mut);padding:11px 14px;font-size:13px;font-weight:600;border-radius:10px}
  .tools{display:flex;gap:8px;margin-top:11px}
  .note{color:var(--mut);font-size:12.5px;margin-top:12px;line-height:1.6}
  #out{margin-top:18px}
  .err{background:rgba(255,46,108,.08);border:1px solid rgba(255,46,108,.32);color:#ffb3c8;padding:13px 15px;border-radius:12px;font-size:14px;line-height:1.6}
  .result{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}
  .meta{display:flex;gap:13px;align-items:center}
  .meta img{width:66px;height:88px;object-fit:cover;border-radius:10px;background:#0b0d12;flex-shrink:0}
  .meta h3{font-size:15px;font-weight:700}
  .meta p{color:var(--mut);font-size:12.5px;margin-top:4px;line-height:1.5}
  .dl{display:block;margin-top:12px;text-decoration:none}
  .dl span{display:flex;justify-content:space-between;align-items:center;background:#0b0d12;border:1px solid var(--line);border-radius:12px;padding:14px 15px;font-size:14px;color:var(--fg);font-weight:600}
  .dl span i{color:var(--ok);font-style:normal;font-size:13px;font-weight:700}
  .dl:active span{border-color:var(--acc)}
  .spin{width:17px;height:17px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:r .7s linear infinite;display:inline-block;vertical-align:-3px}
  @keyframes r{to{transform:rotate(360deg)}}
  .steps{margin-top:26px}
  .steps h4{font-size:14px;margin-bottom:10px;color:var(--mut);font-weight:600}
  .steps ol{padding-left:20px;color:var(--mut);font-size:13.5px;line-height:1.95}
  footer{text-align:center;color:#5a5f6d;font-size:12px;margin-top:34px;line-height:2}
  footer a{color:#7b818f;text-decoration:none;margin:0 6px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">Ig<b>Down</b></div>
    <div class="tag">Instagram Reels ডাউনলোড করুন — HD, ওয়াটারমার্ক ছাড়া</div>
  </header>

  <div class="card">
    <form id="f" class="row">
      <input id="u" type="text" inputmode="url" autocomplete="off" placeholder="https://www.instagram.com/reel/..." required>
      <button id="b" type="submit">ডাউনলোড</button>
    </form>
    <div class="tools">
      <button type="button" class="ghost" id="paste">পেস্ট করুন</button>
      <button type="button" class="ghost" id="clear">মুছুন</button>
    </div>
    <p class="note">পাবলিক রিল, ছবি ও ক্যারোসেল সাপোর্ট করে। প্রাইভেট অ্যাকাউন্টের পোস্ট ডাউনলোড হবে না।</p>
  </div>

  <div id="out"></div>

  <div class="steps">
    <h4>কীভাবে কাজ করে</h4>
    <ol>
      <li>Instagram অ্যাপে রিলের <b>Share → Copy link</b> চাপুন</li>
      <li>লিংকটা উপরের বক্সে পেস্ট করুন</li>
      <li>ডাউনলোড বাটনে চাপুন — ফাইল সরাসরি আপনার ডিভাইসে সেভ হবে</li>
    </ol>
  </div>

  <footer>
    <div><a href="/privacy">Privacy</a>·<a href="/terms">Terms</a>·<a href="/dmca">DMCA</a>·<a href="/contact">Contact</a></div>
    <div>© Ig Down — Instagram-এর সাথে কোনো সম্পর্ক নেই। নিজের তৈরি বা অনুমতিপ্রাপ্ত কনটেন্টই ডাউনলোড করুন।</div>
  </footer>
</div>

<script>
  var f=document.getElementById('f'),u=document.getElementById('u'),b=document.getElementById('b'),out=document.getElementById('out');

  document.getElementById('paste').onclick=function(){
    if(navigator.clipboard&&navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(t){u.value=t.trim();}).catch(function(){u.focus();});
    } else {u.focus();}
  };
  document.getElementById('clear').onclick=function(){u.value='';out.innerHTML='';u.focus();};

  f.onsubmit=function(ev){
    ev.preventDefault();
    var link=u.value.trim();
    if(!link)return;
    b.disabled=true; b.innerHTML='<span class="spin"></span>'; out.innerHTML='';

    fetch('/api/resolve?url='+encodeURIComponent(link))
      .then(function(r){return r.json();})
      .then(function(d){
        if(!d.ok){out.innerHTML='<div class="err">'+esc(d.error)+'</div>';return;}
        render(d);
      })
      .catch(function(){out.innerHTML='<div class="err">নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।</div>';})
      .then(function(){b.disabled=false;b.textContent='ডাউনলোড';});
  };

  function render(d){
    var first=d.items[0];
    var h='<div class="result"><div class="meta">';
    if(first.thumb) h+='<img src="'+esc(first.thumb)+'" alt="" loading="lazy">';
    h+='<div><h3>'+(d.username?'@'+esc(d.username):'Instagram Reel')+'</h3>';
    h+='<p>'+esc(d.caption||'ডাউনলোড করার জন্য নিচে চাপুন')+'</p></div></div>';
    for(var i=0;i<d.items.length;i++){
      var it=d.items[i];
      var label=(it.type==='image'?'ছবি':'ভিডিও')+(d.items.length>1?' '+(i+1):'')+' · '+esc(it.quality);
      h+='<a class="dl" href="'+it.url+'" download><span>'+label+'<i>'+(it.size?esc(it.size)+' ↓':'↓')+'</i></span></a>';
    }
    h+='</div>';
    out.innerHTML=h;
  }

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
</script>
</body>
</html>`;
