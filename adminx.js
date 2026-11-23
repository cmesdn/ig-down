/**
 * adminx.js — owner tools added on top of the admin panel:
 *   Today summary · Visitors for any date range (with / without the owner)
 *   Download history (live) · deleting data by range · keeping data forever or N days
 *   marking the owner's own devices · backup / restore · app update · quick replies
 */

import { rangeReport, history, deleteRange, storage, meToken, postViews, localDay, tzOff, initInsights } from "./insights.js";
import { liveNow } from "./visits.js";
import { getConfig, saveConfig, getCookies } from "./store.js";
import { inbox } from "./cms.js";
import { listPosts, getPost, savePost, getPage, savePage, PAGE_KEYS, getToolText } from "./content.js";

const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const SITE = "https://igtodownload.com";

/* ===================== extra lines for the status API ===================== */

export async function extraStatus(env) {
  const out = {};
  const get = async (k) => { try { return JSON.parse((await env.CONFIG.get(k)) || "null"); } catch (_) { return null; } };
  const d = await get("draftping");
  if (d) out.drafts = d;
  const r = await get("dailyreport");
  if (r) out.report = r;
  const lf = await get("loginfail");
  if (lf) out.loginfail = lf;
  return out;
}

/* ===================== json api ===================== */

export async function apiX(api, request, url, env, lang) {
  const bn = lang !== "en";
  const cfg = await getConfig(env);
  const q = Object.fromEntries(url.searchParams);
  const body = async () => (request.method === "POST" ? await request.json().catch(() => ({})) : {});
  switch (api) {
    case "x_summary": {
      const off = tzOff(cfg);
      const today = localDay(Date.now(), off);
      const r = await rangeReport(env, cfg, { from: today, to: today, me: "all" });
      const rn = await rangeReport(env, cfg, { from: today, to: today, me: "not" });
      const ib = await inbox(env);
      const posts = await listPosts(env, true);
      const cookies = await getCookies(env);
      const live = await liveNow(env);
      return j({
        today, visitsAll: r.visitsAll, visitsNotMe: r.visitsNotMe, people: rn.people, bots: r.bots, downloads: r.dlNotMe, dlAll: r.dlAll, fails: rn.fails,
        unread: ib.unread, drafts: posts.filter((p) => p.status === "draft").length,
        cookies: { live: cookies.filter((c) => c.status !== "dead").length, total: cookies.length },
        liveNow: live.now, liveMe: live.me || 0,
        apk: await apkMeta(env),
      });
    }
    case "x_report":
      return j(Object.assign(await rangeReport(env, cfg, q), { live: await liveNow(env) }));
    case "x_history":
      return j(await history(env, cfg, q));
    case "x_storage":
      return j(Object.assign(await storage(env), { keepDays: +cfg.settings.keepDays || 0, dailyReport: cfg.alerts.dailyReport !== false }));
    case "x_delete": {
      const b = await body();
      if (!["visits", "history", "both"].includes(b.what)) return j({ error: "what" }, 400);
      if (b.all && b.confirm !== "Confirmed") return j({ error: bn ? "সব মুছতে ঠিক Confirmed লিখুন।" : "Type Confirmed to delete everything." }, 400);
      if (!b.all && !b.from) return j({ error: bn ? "তারিখ বেছে নিন।" : "Pick the dates." }, 400);
      return j(Object.assign({ ok: true }, await deleteRange(env, cfg, b)));
    }
    case "x_keep": {
      const b = await body();
      const days = Math.max(0, Math.min(3650, +b.days || 0));
      cfg.settings.keepDays = days;
      if (typeof b.dailyReport === "boolean") cfg.alerts.dailyReport = b.dailyReport;
      await saveConfig(env, cfg);
      return j({ ok: true, keepDays: days });
    }
    case "x_me": {
      const b = await body();
      const t = await meToken(env, !!b.renew);
      return j({ ok: true, link: SITE + "/?me=" + t, off: SITE + "/?me=off" });
    }
    case "x_postviews":
      return j(await postViews(env));
    case "x_replies": {
      if (request.method === "POST") {
        const b = await body();
        const list = (Array.isArray(b.list) ? b.list : []).slice(0, 20).map((x) => ({ name: String(x.name || "").slice(0, 40), text: String(x.text || "").slice(0, 2000) })).filter((x) => x.name && x.text);
        await env.CONFIG.put("replies", JSON.stringify(list));
        return j({ ok: true, list });
      }
      let list = null;
      try { list = JSON.parse((await env.CONFIG.get("replies")) || "null"); } catch (_) {}
      return j({ list: list || DEFAULT_REPLIES });
    }
    case "x_backup": {
      const posts = [];
      for (const p of await listPosts(env, true)) { const full = await getPost(env, p.slug, true); if (full) posts.push(full); }
      const pages = {};
      for (const k of PAGE_KEYS) { const pg = await getPage(env, k); if (pg && pg.custom) pages[k] = { title: pg.title, desc: pg.desc, md: pg.md }; }
      const c = JSON.parse(JSON.stringify(cfg));
      let replies = null; try { replies = JSON.parse((await env.CONFIG.get("replies")) || "null"); } catch (_) {}
      const data = { kind: "igtodownload-backup", version: 1, at: new Date().toISOString(), posts, pages, tooltext: await getToolText(env), config: c, replies };
      return new Response(JSON.stringify(data, null, 1), {
        headers: { "content-type": "application/json", "content-disposition": `attachment; filename="igtodownload-backup-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" },
      });
    }
    case "x_restore": {
      const b = await body();
      if (!b || b.kind !== "igtodownload-backup") return j({ error: bn ? "এটা IGtoDownload-এর ব্যাকআপ ফাইল না।" : "This is not an IGtoDownload backup file." }, 400);
      let n = 0;
      const have = new Set((await listPosts(env, true)).map((p) => p.slug));
      for (const p of b.posts || []) {
        try { await savePost(env, p, have.has(p.slug) ? p.slug : ""); n++; } catch (_) {}
      }
      for (const [k, v] of Object.entries(b.pages || {})) { try { await savePage(env, k, v); } catch (_) {} }
      if (b.tooltext && typeof b.tooltext === "object") await env.CONFIG.put("tooltext", JSON.stringify(b.tooltext));
      if (b.config && typeof b.config === "object" && b.restoreSettings) await saveConfig(env, b.config);
      if (Array.isArray(b.replies)) await env.CONFIG.put("replies", JSON.stringify(b.replies));
      return j({ ok: true, posts: n });
    }
    case "x_apk": {
      const m = await apkMeta(env);
      if (!m) return j({ error: "none" }, 404);
      return j(Object.assign({}, m, { link: await apkLink(env, m.build) }));
    }
  }
  return null;
}

const DEFAULT_REPLIES = [
  { name: "Thanks — fixed", text: "Hi,\n\nThanks for letting us know. We have fixed the problem — please try the link again.\n\nBest regards,\nIGtoDownload" },
  { name: "Private post", text: "Hi,\n\nThat post is from a private account, so it cannot be downloaded by any tool. Only public posts work.\n\nBest regards,\nIGtoDownload" },
  { name: "Advertising", text: "Hi,\n\nThanks for your interest in advertising on IGtoDownload. Please tell us your budget, the ad format and the countries you want to reach, and we will get back to you with options.\n\nBest regards,\nIGtoDownload" },
  { name: "DMCA received", text: "Hi,\n\nWe have received your copyright notice and are reviewing it. IGtoDownload does not host any media, but we will act on valid requests promptly.\n\nBest regards,\nIGtoDownload" },
];

/* ===================== admin app updates ===================== */

async function apkMeta(env) {
  try { return JSON.parse((await env.CONFIG.get("apk:meta")) || "null"); } catch (_) { return null; }
}
async function hmac(env, text) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SIGN_SECRET || "x"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text));
  return [...new Uint8Array(s)].slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function apkLink(env, build) {
  const exp = Math.floor(Date.now() / 1000) + 1800;
  return SITE + "/app-update/igto-admin-" + build + "-" + exp + "-" + (await hmac(env, "apk:" + build + ":" + exp)) + ".apk";
}

/** POST /api/apk from the admin-app build (Bearer DRAFT_KEY) and GET /app-update/<signed>.apk */
export async function handleApk(request, url, env) {
  const path = url.pathname;
  if (path === "/api/apk") {
    if (request.method !== "POST") return j({ error: "POST only" }, 405);
    const auth = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!env.DRAFT_KEY || auth !== env.DRAFT_KEY) return j({ error: "unauthorized" }, 401);
    const build = parseInt(request.headers.get("x-build") || "0", 10);
    const buf = await request.arrayBuffer();
    if (!build || buf.byteLength < 10000 || buf.byteLength > 24e6) return j({ error: "bad upload" }, 400);
    await env.CONFIG.put("apk:bin", buf);
    await env.CONFIG.put("apk:meta", JSON.stringify({ build, version: "1.0." + build, size: buf.byteLength, at: Date.now() }));
    return j({ ok: true, build });
  }
  const m = path.match(/^\/app-update\/igto-admin-(\d+)-(\d+)-([a-f0-9]{32})\.apk$/);
  if (!m) return null;
  if (+m[2] < Date.now() / 1000) return new Response("This download link has expired. Open the admin app and tap Update again.", { status: 410 });
  if (m[3] !== (await hmac(env, "apk:" + m[1] + ":" + m[2]))) return new Response("Not found", { status: 404 });
  const bin = await env.CONFIG.get("apk:bin", "arrayBuffer");
  if (!bin) return new Response("Not found", { status: 404 });
  return new Response(bin, {
    headers: { "content-type": "application/vnd.android.package-archive", "content-disposition": `attachment; filename="igto-admin-1.0.${m[1]}.apk"`, "cache-control": "no-store" },
  });
}

/* ===================== strings ===================== */

const S = {
  bn: {
    today: "আজকের সারাংশ", visitors: "ভিজিটর", withMe: "আমি সহ", noMe: "আমি ছাড়া", onlyMe: "শুধু আমি", downloads: "ডাউনলোড", fails: "ব্যর্থ",
    msgs: "নতুন মেসেজ", drafts: "ড্রাফট অপেক্ষায়", cookies: "কুকি ঠিক আছে", liveNow: "এখন সাইটে",
    update: "নতুন অ্যাপ ভার্সন আছে", updateBtn: "আপডেট করুন", updHint: "চাপলে Chrome-এ ফাইল নামবে, তারপর ইনস্টল চাপুন। লগইন বা সেটিংস হারাবে না।",
    p_today: "আজ", p_yest: "গতকাল", p_7: "৭ দিন", p_30: "৩০ দিন", p_month: "এই মাস", p_all: "সব সময়", p_custom: "তারিখ বাছুন",
    from: "থেকে", to: "পর্যন্ত", apply: "দেখুন", oneDay: "একদিন দেখতে দুই ঘরে একই তারিখ দিন।",
    visits: "ভিজিট", pageviews: "পেজ দেখা", people: "আলাদা মানুষ", peopleSub: "একই ফোন/ব্রাউজার একবার", bots: "বট বাদ", botsSub: "ভিজিট · সার্ভার/স্ক্যানার থেকে", bot: "বট", conv: "ডাউনলোড হার", installs: "অ্যাপ ইনস্টল",
    daily: "দিন অনুযায়ী", monthly: "মাস অনুযায়ী", hourly: "ঘণ্টা অনুযায়ী (আপনার সময়)", sources: "কোথা থেকে এসেছে", countries: "দেশ", pages: "কোন পেজ", devices: "ডিভাইস", appsplit: "অ্যাপ বনাম ব্রাউজার",
    liveT: "এই মুহূর্তে সাইটে", liveHint: "গত ৩ মিনিটে যাদের পেজ খোলা ছিল", inMe: "জন আপনি",
    meBox: "আমার নিজের ভিজিট আলাদা রাখা",
    meHint: "নিচের বাটন চাপলে সাইটটা Chrome-এ খুলবে আর ওই ফোন/ব্রাউজার \"আপনি\" হিসেবে চিহ্নিত হবে। এরপর থেকে ওখান থেকে যত ভিজিট বা ডাউনলোড হবে, সেগুলো \"আমি ছাড়া\" হিসাবে বাদ যাবে। যে যে ফোন/ব্রাউজার থেকে সাইট দেখেন, প্রতিটায় একবার করে চাপুন। (আগের ভিজিটগুলো চিহ্নিত হয় না — চিহ্নিত করার পর থেকে গোনা শুরু।)",
    meBtn: "এই ফোনকে \"আমি\" হিসেবে চিহ্নিত করুন", meOff: "চিহ্ন তুলে নিন", meRenew: "সব ডিভাইসের চিহ্ন বাতিল (নতুন কোড)", meRenewSure: "সব চিহ্নিত ডিভাইস আবার সাধারণ ভিজিটর হিসেবে গোনা হবে। নিশ্চিত?",
    hist: "ডাউনলোড হিস্টরি", show: "কয়টা দেখাবে", all: "সব", ok: "সফল", fail: "ব্যর্থ", search: "লিংক, IP বা ফোন দিয়ে খুঁজুন",
    live: "লাইভ", more: "আরো দেখুন", none: "এই সময়ে কিছু নেই।", copied: "কপি হয়েছে",
    total: "মোট", since: "হিস্টরি রাখা শুরু:",
    data: "ডেটা ও স্টোরেজ", store: "এখন জমা আছে", vrows: "ভিজিট রেকর্ড", hrows: "ডাউনলোড রেকর্ড", approx: "আনুমানিক জায়গা",
    keep: "পুরনো ডেটা নিজে থেকে মুছবে", never: "কখনো না (সব সময় থাকবে)", days: "দিন পর",
    keepHint: "ফ্রি প্ল্যানে ৫ GB পর্যন্ত জায়গা আছে — বছরের পর বছর রাখলেও সাধারণত ভরে না।",
    del: "ডেটা মুছুন", delWhat: "কী মুছবেন", dVisits: "ভিজিটর ডেটা", dHist: "ডাউনলোড হিস্টরি", dBoth: "দুটোই",
    delRange: "উপরে বাছা সময়ের ডেটা মুছুন", delRangeSure: "উপরে বাছা সময়ের ({R}) ডেটা মুছে যাবে, ফেরত আনা যাবে না। নিশ্চিত?",
    delAll: "সব মুছুন", delAllHint: "সব মুছতে নিচে ঠিক Confirmed লিখুন", deleted: "মুছে ফেলা হয়েছে:", rows: "টা রেকর্ড",
    report: "প্রতিদিন সকাল ৯টায় গতকালের রিপোর্ট নোটিফিকেশন",
    backup: "ব্যাকআপ", backupHint: "সব পোস্ট, পেজের লেখা, টুল পেজের লেখা আর সেটিংস একটা ফাইলে নামিয়ে রাখুন। কিছু হারালে এখান থেকে ফেরত আনা যাবে।",
    bDown: "⬇ ব্যাকআপ নামান", bUp: "⬆ ব্যাকআপ থেকে ফেরত আনুন", bSettings: "সেটিংসও ফেরত আনুন (কুকি, অ্যাড ইত্যাদি)", bDone: "ফেরত আনা হয়েছে। পোস্ট:", bSure: "ফাইলের পোস্ট আর পেজগুলো এখনকারগুলোর ওপর বসবে। চালিয়ে যাবেন?",
    replies: "তৈরি উত্তর", repHint: "মেসেজের \"ইমেইলে উত্তর\" চাপলে এগুলো থেকে বেছে নিতে পারবেন।", repName: "নাম", repText: "লেখা", repAdd: "+ নতুন উত্তর", repSave: "সেভ", repNone: "খালি উত্তর",
    ago_s: "এইমাত্র", ago_m: "মিনিট আগে", ago_h: "ঘণ্টা আগে", ago_d: "দিন আগে",
  },
  en: {
    today: "Today at a glance", visitors: "Visitors", withMe: "With me", noMe: "Without me", onlyMe: "Only me", downloads: "Downloads", fails: "Failed",
    msgs: "New messages", drafts: "Drafts waiting", cookies: "Cookies OK", liveNow: "On site now",
    update: "A new app version is available", updateBtn: "Update", updHint: "Chrome downloads the file — then tap Install. You stay signed in.",
    p_today: "Today", p_yest: "Yesterday", p_7: "7 days", p_30: "30 days", p_month: "This month", p_all: "All time", p_custom: "Pick dates",
    from: "From", to: "To", apply: "Show", oneDay: "For a single day, use the same date in both.",
    visits: "Visits", pageviews: "Page views", people: "Unique people", peopleSub: "same phone/browser counted once", bots: "Bots removed", botsSub: "visits · servers/scanners", bot: "Bot", conv: "Download rate", installs: "App installs",
    daily: "By day", monthly: "By month", hourly: "By hour (your time)", sources: "Where they came from", countries: "Countries", pages: "Pages", devices: "Devices", appsplit: "App vs browser",
    liveT: "On the site right now", liveHint: "pages open in the last 3 minutes", inMe: "are you",
    meBox: "Keep my own visits separate",
    meHint: "Tap the button to open the site in Chrome and mark that phone/browser as you. From then on, visits and downloads from it are left out under \"Without me\". Do it once on every phone/browser you check the site from. (Earlier visits are not marked.)",
    meBtn: "Mark this phone as me", meOff: "Unmark", meRenew: "Unmark all devices (new code)", meRenewSure: "All marked devices will count as normal visitors again. Sure?",
    hist: "Download history", show: "Show", all: "All", ok: "OK", fail: "Failed", search: "Search link, IP or phone",
    live: "Live", more: "Load more", none: "Nothing in this period.", copied: "Copied",
    total: "Total", since: "History kept since:",
    data: "Data & storage", store: "Stored now", vrows: "visit records", hrows: "download records", approx: "approx. size",
    keep: "Delete old data automatically", never: "Never (keep forever)", days: "days",
    keepHint: "The free plan has 5 GB — years of data usually fit.",
    del: "Delete data", delWhat: "What to delete", dVisits: "Visitor data", dHist: "Download history", dBoth: "Both",
    delRange: "Delete the period chosen above", delRangeSure: "Data for the chosen period ({R}) will be deleted for good. Sure?",
    delAll: "Delete everything", delAllHint: "Type Confirmed below to delete everything", deleted: "Deleted:", rows: "records",
    report: "Morning report notification at 9 AM (yesterday's numbers)",
    backup: "Backup", backupHint: "Download every post, page text, tool-page text and setting as one file. Restore from it if anything is lost.",
    bDown: "⬇ Download backup", bUp: "⬆ Restore from backup", bSettings: "Also restore settings (cookies, ads, etc.)", bDone: "Restored. Posts:", bSure: "Posts and pages in the file will replace the current ones. Continue?",
    replies: "Quick replies", repHint: "Pick one of these when you tap \"Reply by email\" on a message.", repName: "Name", repText: "Text", repAdd: "+ New reply", repSave: "Save", repNone: "Empty reply",
    ago_s: "just now", ago_m: "min ago", ago_h: "h ago", ago_d: "d ago",
  },
};
export const XS = S;

const sJson = (lang) => JSON.stringify(S[lang] || S.bn).replace(/</g, "\\u003c");

/* ===================== tab html ===================== */

export function summaryBox(lang) {
  return `<div id="xUpd"></div><div class="box xsum"><div class="stathead"><h3>${(S[lang] || S.bn).today}</h3><span class="age" id="xSumAge"></span></div><div class="xcards" id="xSum"><p class="dim">…</p></div></div><script>window.__XS=${sJson(lang)};</script>`;
}

function rangeBar(prefix, def) {
  return `<div class="seg xseg" id="${prefix}Range" data-def="${def}">
  <button data-p="today">·</button><button data-p="yest">·</button><button data-p="7">·</button><button data-p="30">·</button><button data-p="month">·</button><button data-p="all">·</button><button data-p="custom">·</button>
</div>
<div class="xcustom" id="${prefix}Custom" hidden><label>·<input type="date" id="${prefix}From"></label><label>·<input type="date" id="${prefix}To"></label><button class="btn" id="${prefix}Go">·</button><p class="dim" id="${prefix}One"></p></div>`;
}

export function visitorsTab2(lang) {
  const s = S[lang] || S.bn;
  return `
<div class="box livebox">
  <div class="stathead"><h3>${s.liveT}</h3><span class="age" id="xLiveAge"></span></div>
  <div class="livebig"><span class="livedot"></span><b id="xLive">—</b><span id="xLiveMe" class="dim"></span></div>
  <p class="dim">${s.liveHint}</p>
  <div class="two" style="margin-top:12px"><div><h4 class="mh">${s.countries}</h4><div id="xLC" class="bars"></div></div><div><h4 class="mh">${s.pages}</h4><div id="xLP" class="bars"></div></div></div>
</div>
${rangeBar("v", "7")}
<div class="seg xseg xme" id="vMe"><button data-m="all">${s.withMe}</button><button data-m="not">${s.noMe}</button><button data-m="only">${s.onlyMe}</button></div>
<div class="cards" id="xCards"></div>
<div class="box"><h3 id="xDailyT">${s.daily}</h3><div class="chart2" id="xDaily"></div><div class="legend"><span><i class="lv"></i>${s.visits}</span><span><i class="ld"></i>${s.downloads}</span></div><div class="xaxis" id="xAxis"></div></div>
<div class="box"><h3>${s.hourly}</h3><div class="chart2 hours" id="xHours"></div><div class="xaxis"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div></div>
<div class="two"><div class="box"><h3>${s.sources}</h3><div id="xSrc" class="bars"></div></div><div class="box"><h3>${s.countries}</h3><div id="xCtry" class="bars"></div></div></div>
<div class="two"><div class="box"><h3>${s.pages}</h3><div id="xPages" class="bars"></div></div><div class="box"><h3>${s.devices}</h3><div id="xDev" class="bars"></div><h4 class="mh" style="margin-top:14px">${s.appsplit}</h4><div id="xSplit" class="bars"></div></div></div>
${meBox(s)}
${dataBox(s)}
<script>window.__XS=${sJson(lang)};</script>`;
}

export function historyTab(lang) {
  const s = S[lang] || S.bn;
  return `
${rangeBar("h", "all")}
<div class="box">
  <div class="xhrow">
    <div class="seg xseg" id="hStatus"><button data-s="all" class="on">${s.all}</button><button data-s="ok">✓ ${s.ok}</button><button data-s="fail">✕ ${s.fail}</button></div>
    <div class="seg xseg xme" id="hMe"><button data-m="all" class="on">${s.withMe}</button><button data-m="not">${s.noMe}</button><button data-m="only">${s.onlyMe}</button></div>
  </div>
  <div class="xhrow">
    <label class="xlim">${s.show} <select id="hLim"><option>10</option><option selected>25</option><option>50</option><option>100</option><option>200</option><option>500</option></select></label>
    <label class="xlive"><input type="checkbox" id="hLive" checked> <span class="livedot"></span> ${s.live}</label>
  </div>
  <input id="hQ" placeholder="${s.search}" style="margin-top:8px">
  <p class="dim" id="hInfo" style="margin:10px 0 0"></p>
  <div id="hList" class="hlist"></div>
  <button class="btn ghost" id="hMore" hidden style="width:100%;margin-top:10px">${s.more}</button>
</div>
${dataBox(s)}
<script>window.__XS=${sJson(lang)};</script>`;
}

function meBox(s) {
  return `<div class="box"><h3>${s.meBox}</h3><p class="dim">${s.meHint}</p>
<div class="row"><button class="btn" id="meMark">${s.meBtn}</button><button class="btn ghost" id="meUnmark">${s.meOff}</button></div>
<button class="btn ghost" id="meRenew" style="margin-top:8px;font-size:12.5px">${s.meRenew}</button></div>`;
}

function dataBox(s) {
  return `<div class="box"><h3>${s.data}</h3>
<div id="dStore" class="dim">…</div>
<label style="margin-top:12px">${s.keep}</label>
<select id="dKeep"><option value="0">${s.never}</option><option value="30">30 ${s.days}</option><option value="90">90 ${s.days}</option><option value="180">180 ${s.days}</option><option value="365">365 ${s.days}</option><option value="730">730 ${s.days}</option></select>
<p class="dim">${s.keepHint}</p>
<label class="chk" style="margin-top:6px"><input type="checkbox" id="dReport"> ${s.report}</label>
<h4 class="mh" style="margin-top:16px">${s.del}</h4>
<div class="seg xseg" id="dWhat"><button data-w="visits">${s.dVisits}</button><button data-w="history">${s.dHist}</button><button data-w="both" class="on">${s.dBoth}</button></div>
<button class="btn ghost" id="dRange" style="width:100%">${s.delRange}</button>
<p class="dim" style="margin:12px 0 4px">${s.delAllHint}</p>
<div class="row"><input id="dConfirm" placeholder="Confirmed" autocomplete="off" style="flex:1"><button class="btn danger" id="dAll" disabled>${s.delAll}</button></div>
<p id="dOut" class="dim"></p></div>`;
}

export function extrasForSettings(lang) {
  const s = S[lang] || S.bn;
  return `<div class="box"><h3>${s.backup}</h3><p class="dim">${s.backupHint}</p>
<div class="row"><a class="btn" href="/admin?api=x_backup">${s.bDown}</a><label class="btn ghost" style="margin:0">${s.bUp}<input type="file" id="bFile" accept="application/json,.json" hidden></label></div>
<label class="chk" style="margin-top:8px"><input type="checkbox" id="bSettings"> ${s.bSettings}</label><p id="bOut" class="dim"></p></div>
<div class="box"><h3>${s.replies}</h3><p class="dim">${s.repHint}</p><div id="repList"></div>
<div class="row"><button class="btn ghost" id="repAdd">${s.repAdd}</button><button class="btn" id="repSave">${s.repSave}</button></div><p id="repOut" class="dim"></p></div>
<script>window.__XS=${sJson(lang)};</script>`;
}

/* ===================== styles ===================== */

export const XCSS = `
.xcards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}
.xc{display:block;text-decoration:none;color:inherit;background:#0f0f15;border:1px solid #23232c;border-radius:13px;padding:11px 12px;position:relative;transition:transform .15s,border-color .2s}
.xc:active{transform:scale(.97)}
.xc span{display:block;font-size:12px;color:#8c8c9b;margin-bottom:4px}
.xc b{font-size:22px;font-weight:750;letter-spacing:-.3px}
.xc small{display:block;font-size:11.5px;color:#8c8c9b;margin-top:3px}
.xc.hot{border-color:rgba(249,55,125,.55)}.xc.hot b{color:#ff7aa5}
.xc.good b{color:#2bd97c}.xc.warn b{color:#ffb800}
.xupd{display:flex;gap:12px;align-items:center;background:linear-gradient(100deg,rgba(255,138,61,.16),rgba(249,55,125,.16) 50%,rgba(138,63,252,.16));border:1px solid rgba(249,55,125,.45);border-radius:14px;padding:12px 14px;margin-bottom:12px}
.xupd div{flex:1;font-size:13px}.xupd b{display:block;font-size:14.5px;margin-bottom:2px}
.xseg{margin-bottom:10px}
.xseg button{flex:none}
.xme button{flex:1}
.xcustom[hidden]{display:none}
.xcustom{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;background:#101017;border:1px solid #23232c;border-radius:12px;padding:10px;margin:-2px 0 12px}
.xcustom label{margin:0;font-size:12px;color:#8c8c9b;display:grid;gap:4px}
.xcustom input{margin:0;padding:9px 10px}
.xcustom .btn{margin:0;grid-column:1/-1}
.xcustom input{min-width:0;width:100%}
.xcustom p{grid-column:1/-1;margin:0;font-size:12px}
.xaxis{display:flex;justify-content:space-between;font-size:11px;color:#6f6f7d;margin-top:5px}
.cards .card small{display:block;font-size:11.5px;color:#8c8c9b;margin-top:3px;font-weight:500}
.xhrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.xhrow .seg{margin-bottom:8px;width:100%}
.xhrow .seg button{flex:1}
.xlim{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;color:#c9c9d4}.xlim select{width:auto;margin:0;padding:7px 10px}
.xlive{display:flex;align-items:center;gap:7px;margin:0;font-size:13px;color:#c9c9d4;cursor:pointer}.xlive input{width:auto;margin:0}
.hlist{display:grid;gap:7px;margin-top:10px}
.hrow{background:#0f0f15;border:1px solid #23232c;border-left:3px solid #2bd97c;border-radius:12px;padding:10px 11px;font-size:13px;animation:hin .5s ease}
.hrow.f{border-left-color:#f9377d}
.hrow.new{box-shadow:0 0 0 1px rgba(43,217,124,.45) inset}
@keyframes hin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.hrow .t{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hrow .t b{font-size:13.5px}.hrow .t .k{font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;background:#1f1f29;color:#c9c9d4}
.hrow .t .me{background:rgba(138,63,252,.2);color:#c7a6ff}
.hrow .t time{margin-left:auto;color:#8c8c9b;font-size:12px;white-space:nowrap}
.hrow .u{display:block;color:#f9a8c8;word-break:break-all;margin:6px 0 4px;text-decoration:none;font-size:12.5px}
.hrow .m{display:flex;gap:6px 12px;flex-wrap:wrap;color:#9a9aa8;font-size:12px}
.hrow .m button{background:none;border:0;padding:0;color:#9a9aa8;font:inherit;cursor:pointer;text-decoration:underline dotted}
.hrow .e{color:#ff7aa5;font-size:12px;margin-top:4px}
.chk{display:flex!important;gap:9px;align-items:center;font-size:13.5px;cursor:pointer}.chk input{width:auto;margin:0}
.btn.danger{background:#3a1220;border:1px solid #f9377d;color:#ff9dbd}.btn.danger:disabled{opacity:.45}
.reprow{background:#0f0f15;border:1px solid #23232c;border-radius:12px;padding:10px;margin-bottom:8px}
.reprow input,.reprow textarea{margin:4px 0}.reprow textarea{min-height:110px;font-family:inherit;font-size:13.5px}
.reprow .x{background:none;border:0;color:#ff7aa5;font:inherit;font-size:12.5px;cursor:pointer;padding:0}
.pviews{font-size:11.5px;color:#8c8c9b}
`;

/* ===================== client script ===================== */

export const XJS = `
(function(){
var S=window.__XS; if(!S) return;
var BN=!/(?:^|; )iglang=en/.test(document.cookie);
function $(id){return document.getElementById(id)}
function h(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function api(n,data){return fetch('/admin?api='+n,data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{cache:'no-store'}).then(function(r){return r.json()})}
function num(n){n=+n||0;return BN?String(n).replace(/[0-9]/g,function(d){return '০১২৩৪৫৬৭৮৯'[d]}):String(n)}
function ago(ts){var s=Math.round((Date.now()-ts)/1000);if(s<45)return S.ago_s;var m=Math.round(s/60);if(m<60)return num(m)+' '+S.ago_m;var hh=Math.round(m/60);if(hh<48)return num(hh)+' '+S.ago_h;return num(Math.round(hh/24))+' '+S.ago_d}
function ld(d){var z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
window.__xago=ago;

/* ---------- date range bar ---------- */
function rangeBar(prefix,onChange){
  var seg=$(prefix+'Range'); if(!seg) return null;
  var labels={today:S.p_today,yest:S.p_yest,'7':S.p_7,'30':S.p_30,month:S.p_month,all:S.p_all,custom:S.p_custom};
  [].forEach.call(seg.querySelectorAll('button'),function(b){b.textContent=labels[b.dataset.p]});
  var cu=$(prefix+'Custom'), F=$(prefix+'From'), T=$(prefix+'To');
  cu.querySelectorAll('label')[0].firstChild.textContent=S.from; cu.querySelectorAll('label')[1].firstChild.textContent=S.to;
  $(prefix+'Go').textContent=S.apply; $(prefix+'One').textContent=S.oneDay;
  var key='xr_'+prefix, st;
  try{st=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  st=st||{p:seg.dataset.def};
  function calc(p){var n=new Date(),t=ld(n);
    if(p==='today')return{from:t,to:t};
    if(p==='yest'){var y=ld(new Date(n.getTime()-864e5));return{from:y,to:y}}
    if(p==='7')return{from:ld(new Date(n.getTime()-6*864e5)),to:t};
    if(p==='30')return{from:ld(new Date(n.getTime()-29*864e5)),to:t};
    if(p==='month')return{from:t.slice(0,8)+'01',to:t};
    if(p==='all')return{from:'',to:''};
    return{from:st.from||t,to:st.to||t};
  }
  var R={get:function(){var r=calc(st.p);r.p=st.p;return r},label:function(){var r=R.get();return r.p==='all'?S.p_all:(r.from===r.to?r.from:r.from+' → '+r.to)}};
  function paint(){[].forEach.call(seg.querySelectorAll('button'),function(b){b.classList.toggle('on',b.dataset.p===st.p)});cu.hidden=st.p!=='custom';var r=calc(st.p);F.value=r.from||'';T.value=r.to||ld(new Date())}
  seg.onclick=function(e){var b=e.target.closest('button');if(!b)return;st.p=b.dataset.p;if(st.p==='custom'){var r=calc('custom');st.from=r.from;st.to=r.to}save();paint();if(st.p!=='custom')onChange(R.get())};
  $(prefix+'Go').onclick=function(){st.from=F.value;st.to=T.value||F.value;if(st.from>st.to){var x=st.from;st.from=st.to;st.to=x}save();paint();onChange(R.get())};
  function save(){try{localStorage.setItem(key,JSON.stringify(st))}catch(e){}}
  paint(); return R;
}
function meSeg(id,onChange,def){
  var seg=$(id); if(!seg) return null; var key='xm_'+id, v=def||'all';
  try{v=localStorage.getItem(key)||v}catch(e){}
  function paint(){[].forEach.call(seg.querySelectorAll('button'),function(b){b.classList.toggle('on',b.dataset.m===v)})}
  seg.onclick=function(e){var b=e.target.closest('button');if(!b)return;v=b.dataset.m;try{localStorage.setItem(key,v)}catch(x){}paint();onChange()};
  paint(); return {get:function(){return v}};
}
function qs(o){return Object.keys(o).filter(function(k){return o[k]!==''&&o[k]!=null}).map(function(k){return '&'+k+'='+encodeURIComponent(o[k])}).join('')}

/* ---------- today summary (status tab) ---------- */
function card(href,label,val,sub,cls){return '<a class="xc '+(cls||'')+'" href="'+href+'"><span>'+label+'</span><b>'+val+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</a>'}
function loadSummary(){
  if(!$('xSum')) return;
  api('x_summary').then(function(d){
    $('xSum').innerHTML=
      card('/admin?tab=visitors',S.visitors,num(d.visitsNotMe),S.noMe+' · '+S.people+' '+num(d.people||0)+(d.bots?' · 🤖 '+num(d.bots):''))+
      card('/admin?tab=history',S.downloads,num(d.downloads),d.fails?('✕ '+num(d.fails)+' '+S.fails):'',d.fails>d.downloads&&d.fails>2?'warn':'')+
      card('/admin?tab=msgs',S.msgs,num(d.unread),'',d.unread?'hot':'')+
      card('/admin?tab=blog',S.drafts,num(d.drafts),'',d.drafts?'warn':'')+
      card('/admin?tab=cookies',S.cookies,num(d.cookies.live)+' / '+num(d.cookies.total),'',d.cookies.live?'good':'hot')+
      card('/admin?tab=visitors',S.liveNow,num(d.liveNow),d.liveMe?(num(d.liveMe)+' '+S.inMe):'','');
    $('xSumAge').textContent=new Date().toLocaleTimeString();
    upd(d.apk);
  }).catch(function(){});
}
function upd(apk){
  var A=window.IGtoApp, box=$('xUpd'); if(!A||!apk||!box) return;
  var cur=parseInt(String(A.version()).split('.').pop(),10)||0;
  if(apk.build>cur){
    box.innerHTML='<div class="xupd"><div><b>🆕 '+S.update+' '+h(apk.version)+'</b>'+S.updHint+'</div><button class="btn" id="updGo" style="margin:0">'+S.updateBtn+'</button></div>';
    $('updGo').onclick=function(){this.textContent='…';api('x_apk').then(function(r){if(r.link)location.href=r.link})};
  }
}
if($('xSum')){loadSummary();setInterval(function(){if(!document.hidden)loadSummary()},30000)}

/* ---------- visitors ---------- */
function bars(id,rows,map){
  var box=$(id); if(!box) return;
  if(!rows||!rows.length){box.innerHTML='<p class="dim">'+S.none+'</p>';return}
  var max=Math.max.apply(null,rows.map(function(r){return r.n}));
  box.innerHTML=rows.map(function(r){var name=map&&map[r.k]!=null?map[r.k]:(r.k===''?'—':r.k);return '<div class="bar2"><i style="width:'+Math.max(3,Math.round(r.n/Math.max(1,max)*100))+'%"></i><span>'+h(name)+'</span><b>'+num(r.n)+'</b></div>'}).join('');
}
var VR, VM;
function c2(l,v,sub){return '<div class="card"><span>'+l+'</span><b>'+v+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</div>'}
function loadV(){
  if(!$('xCards')) return; var r=VR.get();
  $('xCards').innerHTML='<p class="dim">…</p>';
  api('x_report'+qs({from:r.from,to:r.to,me:VM.get()}).replace('&','&')).then(function(d){
    var VV=window.__V||{src:{},dev:{},T:{}};
    $('xCards').innerHTML=
      c2(S.people,num(d.people||0),S.peopleSub)+
      c2(S.visits,num(d.visits),VM.get()==='all'?(S.noMe+': '+num(d.visitsNotMe)):(S.withMe+': '+num(d.visitsAll)))+
      c2(S.pageviews,num(d.pageviews))+
      c2(S.downloads,num(d.downloads),d.fails?('✕ '+num(d.fails)+' '+S.fails):'')+
      c2(S.conv,num(d.conversion)+'%')+c2(S.installs,num(d.installs))+
      c2('🤖 '+S.bots,num(d.bots||0),num(d.botViews||0)+' '+S.botsSub);
    $('xDailyT').textContent=d.unit==='month'?S.monthly:S.daily;
    var ser=d.series, max=Math.max(1,Math.max.apply(null,ser.map(function(x){return Math.max(x.visits,x.downloads)}).concat([1])));
    $('xDaily').innerHTML=ser.map(function(x){return '<div class="c" title="'+x.day+': '+x.visits+' / '+x.downloads+'"><span class="v" style="height:'+Math.round(x.visits/max*100)+'%"></span><span class="d" style="height:'+Math.round(x.downloads/max*100)+'%"></span></div>'}).join('')||'<p class="dim">'+S.none+'</p>';
    $('xAxis').innerHTML=ser.length?'<span>'+ser[0].day+'</span><span>'+ser[ser.length-1].day+'</span>':'';
    var hm=Math.max(1,Math.max.apply(null,d.hours));
    $('xHours').innerHTML=d.hours.map(function(n,i){return '<div class="c" title="'+i+':00 — '+n+'"><span style="height:'+Math.round(n/hm*100)+'%"></span></div>'}).join('');
    bars('xSrc',d.sources,VV.src);bars('xCtry',d.countries);bars('xPages',d.pages);bars('xDev',d.devices,VV.dev);
    bars('xSplit',[{k:'app',n:d.app.app},{k:'web',n:d.app.web}].filter(function(x){return x.n}),{app:(VV.T&&VV.T.app)||'App',web:(VV.T&&VV.T.web)||'Browser'});
    live(d.live);
  });
}
function live(L){ if(!L||!$('xLive'))return; $('xLive').textContent=num(L.now); $('xLiveMe').textContent=L.me?(' · '+num(L.me)+' '+S.inMe):''; $('xLiveAge').textContent=new Date().toLocaleTimeString(); bars('xLC',L.countries); bars('xLP',L.pages); }
if($('xCards')){
  VR=rangeBar('v',loadV); VM=meSeg('vMe',loadV,'not'); loadV();
  setInterval(function(){if(!document.hidden)api('live').then(live)},15000);
}

/* ---------- my devices ---------- */
if($('meMark')){
  $('meMark').onclick=function(){api('x_me',{}).then(function(r){location.href=r.link})};
  $('meUnmark').onclick=function(){api('x_me',{}).then(function(r){location.href=r.off})};
  $('meRenew').onclick=function(){if(!confirm(S.meRenewSure))return;api('x_me',{renew:true}).then(function(){alert('✓')})};
}

/* ---------- download history ---------- */
var HR,HM,hStatus='all',hMin=0,hMax=0,hTimer=null;
function row(x,isNew){
  var d=new Date(x.ts), kind=x.kind==='carousel'?('🖼×'+x.n):x.kind==='image'?'🖼':x.kind==='video'?'🎬':'';
  return '<div class="hrow'+(x.ok?'':' f')+(isNew?' new':'')+'"><div class="t"><b>'+(x.ok?'✓':'✕')+'</b>'+(kind?'<span class="k">'+kind+'</span>':'')+(x.me?'<span class="k me">'+S.onlyMe.replace(/শুধু |Only /,'')+'</span>':'')+(x.app?'<span class="k">App</span>':'')+(x.bot?'<span class="k">🤖 '+S.bot+'</span>':'')+
    '<time title="'+d.toLocaleString()+'">'+d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+' · '+ago(x.ts)+'</time></div>'+
    (x.url?'<a class="u" href="'+h(/^https?:/.test(x.url)?x.url:'#')+'" target="_blank" rel="noopener">'+h(x.url)+'</a>':'')+
    '<div class="m"><span>📱 '+h(x.ua||x.device||'—')+'</span><span>🌐 <button data-c="'+h(x.ip)+'">'+h(x.ip||'—')+'</button></span>'+(x.country?'<span>📍 '+h(x.country)+'</span>':'')+(x.ms?'<span>⏱ '+(x.ms/1000).toFixed(1)+'s</span>':'')+'</div>'+
    (x.err?'<div class="e">'+h(x.err)+'</div>':'')+'</div>';
}
function hq(extra){var r=HR.get();return qs(Object.assign({from:r.from,to:r.to,me:HM.get(),status:hStatus,limit:$('hLim').value,q:$('hQ').value.trim()},extra||{}))}
function loadH(){
  $('hList').innerHTML='<p class="dim">…</p>';
  api('x_history'+hq()).then(function(d){
    var rows=d.rows||[];
    hMax=rows.length?rows[0].id:hMax; hMin=rows.length?rows[rows.length-1].id:0;
    $('hList').innerHTML=rows.map(function(x){return row(x)}).join('')||'<p class="dim">'+S.none+'</p>';
    $('hMore').hidden=rows.length<+$('hLim').value;
    $('hInfo').textContent=S.total+': '+num(d.total)+' · ✓ '+num(d.okn)+' · ✕ '+num(d.total-d.okn)+' ('+HR.label()+')';
  });
}
function pollH(){
  if(hTimer)clearTimeout(hTimer);
  hTimer=setTimeout(function(){
    if(!document.hidden&&$('hLive').checked&&hMax){
      api('x_history'+hq({after:hMax,limit:100})).then(function(d){
        var rows=d.rows||[]; if(rows.length){
          hMax=rows[0].id; var em=$('hList').querySelector('p.dim'); if(em) em.remove();
          $('hList').insertAdjacentHTML('afterbegin',rows.map(function(x){return row(x,true)}).join(''));
          var lim=+$('hLim').value, all=$('hList').querySelectorAll('.hrow'); for(var i=lim;i<all.length;i++)all[i].remove();
          $('hInfo').textContent=S.total+': '+num(d.total)+' · ✓ '+num(d.okn)+' · ✕ '+num(d.total-d.okn)+' ('+HR.label()+')';
        }
      }).catch(function(){});
    } else if(!document.hidden&&$('hLive').checked&&!hMax){ loadH(); }
    pollH();
  },5000);
}
if($('hList')){
  HR=rangeBar('h',loadH); HM=meSeg('hMe',loadH);
  $('hStatus').onclick=function(e){var b=e.target.closest('button');if(!b)return;hStatus=b.dataset.s;[].forEach.call(this.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b)});loadH()};
  try{var L=localStorage.getItem('xh_lim');if(L)$('hLim').value=L}catch(e){}
  $('hLim').onchange=function(){try{localStorage.setItem('xh_lim',this.value)}catch(e){}loadH()};
  var qt;$('hQ').oninput=function(){clearTimeout(qt);qt=setTimeout(loadH,400)};
  $('hMore').onclick=function(){var b=this;b.textContent='…';api('x_history'+hq({before:hMin})).then(function(d){var rows=d.rows||[];if(rows.length)hMin=rows[rows.length-1].id;$('hList').insertAdjacentHTML('beforeend',rows.map(function(x){return row(x)}).join(''));b.textContent=S.more;b.hidden=rows.length<+$('hLim').value})};
  $('hList').addEventListener('click',function(e){var b=e.target.closest('button[data-c]');if(!b)return;try{navigator.clipboard.writeText(b.dataset.c);b.textContent=S.copied;setTimeout(function(){b.textContent=b.dataset.c},1200)}catch(x){}});
  loadH(); pollH();
}

/* ---------- data & storage ---------- */
if($('dStore')){
  var dWhat='both';
  function store(){api('x_storage').then(function(s){
    $('dStore').innerHTML=S.store+': <b>'+num(s.visits)+'</b> '+S.vrows+' · <b>'+num(s.history)+'</b> '+S.hrows+' · '+S.approx+' <b>'+(s.kb>1024?(s.kb/1024).toFixed(1)+' MB':num(s.kb)+' KB')+'</b>';
    $('dKeep').value=String(s.keepDays||0); $('dReport').checked=s.dailyReport;
  })}
  store();
  $('dKeep').onchange=function(){api('x_keep',{days:+this.value}).then(function(){$('dOut').textContent='✓'})};
  $('dReport').onchange=function(){api('x_keep',{days:+$('dKeep').value,dailyReport:this.checked}).then(function(){$('dOut').textContent='✓'})};
  $('dWhat').onclick=function(e){var b=e.target.closest('button');if(!b)return;dWhat=b.dataset.w;[].forEach.call(this.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b)})};
  function curRange(){return (VR||HR).get()}
  function label(){return (VR||HR).label()}
  $('dRange').onclick=function(){
    var r=curRange(); if(r.p==='all'){$('dConfirm').focus();return}
    if(!confirm(S.delRangeSure.replace('{R}',label())))return;
    api('x_delete',{what:dWhat,from:r.from,to:r.to}).then(function(x){$('dOut').textContent=x.error||(S.deleted+' '+num(x.deleted)+' '+S.rows);store();if($('xCards'))loadV();if($('hList'))loadH()});
  };
  $('dConfirm').oninput=function(){$('dAll').disabled=this.value!=='Confirmed'};
  $('dAll').onclick=function(){
    if(!confirm(S.delAll+'?'))return;
    api('x_delete',{what:dWhat,all:true,confirm:$('dConfirm').value}).then(function(x){$('dOut').textContent=x.error||(S.deleted+' '+num(x.deleted)+' '+S.rows);$('dConfirm').value='';$('dAll').disabled=true;store();if($('xCards'))loadV();if($('hList'))loadH()});
  };
}

/* ---------- backup ---------- */
if($('bFile')){
  $('bFile').onchange=function(){var f=this.files[0];if(!f)return;this.value='';
    if(!confirm(S.bSure))return;
    f.text().then(function(t){var d;try{d=JSON.parse(t)}catch(e){$('bOut').textContent='✕ JSON';return}
      d.restoreSettings=$('bSettings').checked;
      api('x_restore',d).then(function(r){$('bOut').textContent=r.error||(S.bDone+' '+num(r.posts))})});
  };
}

/* ---------- quick replies ---------- */
var REP=null;
function repDraw(){
  $('repList').innerHTML=REP.map(function(r,i){return '<div class="reprow" data-i="'+i+'"><input class="rn" value="'+h(r.name)+'" placeholder="'+S.repName+'"><textarea class="rt" placeholder="'+S.repText+'">'+h(r.text)+'</textarea><button class="x" data-x="'+i+'">✕</button></div>'}).join('');
}
function repRead(){REP=[].map.call($('repList').querySelectorAll('.reprow'),function(x){return{name:x.querySelector('.rn').value,text:x.querySelector('.rt').value}})}
if($('repList')){
  api('x_replies').then(function(d){REP=d.list||[];repDraw()});
  $('repAdd').onclick=function(){repRead();REP.push({name:'',text:''});repDraw()};
  $('repList').onclick=function(e){var b=e.target.closest('[data-x]');if(!b)return;repRead();REP.splice(+b.dataset.x,1);repDraw()};
  $('repSave').onclick=function(){repRead();api('x_replies',{list:REP}).then(function(r){$('repOut').textContent=r.ok?'✓':'✕'})};
}
/* pick a quick reply when answering a message */
document.addEventListener('click',function(e){
  var a=e.target.closest('.msgi a[data-r]'); if(!a||a.dataset.picked) return;
  e.preventDefault();
  api('x_replies').then(function(d){
    var list=d.list||[]; var box=a.parentNode.querySelector('.reppick');
    if(box){box.remove();return}
    box=document.createElement('div');box.className='reppick';box.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;width:100%';
    box.innerHTML=list.map(function(r,i){return '<button data-p="'+i+'">'+h(r.name)+'</button>'}).join('')+'<button data-p="-1">'+S.repNone+'</button>';
    a.parentNode.appendChild(box);
    box.onclick=function(ev){var b=ev.target.closest('[data-p]');if(!b)return;var i=+b.dataset.p;
      var href=a.getAttribute('href'), m=href.match(/^mailto:([^?]*)\\?subject=([^&]*)&body=(.*)$/);
      var text=i>=0?list[i].text:'';
      if(m) href='mailto:'+m[1]+'?subject='+m[2]+'&body='+encodeURIComponent(text)+m[3];
      a.dataset.picked='1'; box.remove(); a.setAttribute('href',href); a.click(); setTimeout(function(){delete a.dataset.picked},500);
    };
  });
},true);

/* ---------- blog: views per post ---------- */
if(document.getElementById('cmsView')){
  var pv=null;
  api('x_postviews').then(function(d){pv=d;paintPV()});
  function paintPV(){ if(!pv) return; [].forEach.call(document.querySelectorAll('.pitem'),function(it){
    var b=it.querySelector('[data-e]'); if(!b||it.querySelector('.pviews')) return; var v=pv[b.dataset.e];
    var meta=it.querySelector('.meta'); if(meta) meta.insertAdjacentHTML('beforeend','<span class="pviews">👁 '+num(v?v.all:0)+(v&&v.d30?' · 30d '+num(v.d30):'')+'</span>');
  })}
  new MutationObserver(paintPV).observe(document.getElementById('cmsView'),{childList:true,subtree:true});
}
})();
`;
