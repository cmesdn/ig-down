/**
 * visits.js — live visitors and site analytics.
 *
 * A visit is one browser session (anonymous id kept in sessionStorage, gone
 * when the tab closes). A separate random visitor id in localStorage lets the
 * same browser be counted once as a "person". No cookies.
 * Bots: known bot user agents are dropped; automated browsers and visits from
 * server/hosting networks are stored with bot>0 and left out of every report. The page sends
 * one "view" beacon on load and a light "beat" every two minutes while the
 * tab is visible, so "live now" means "active in the last three minutes".
 *
 * Everything is kept for 90 days and then deleted automatically.
 */

const LIVE_MS = 3 * 60_000;
const KEEP_DAYS = 90;
let READY = false;

async function init(env) {
  if (READY || !env.STATS) return;
  await env.STATS.exec(
    "CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day TEXT, hour INTEGER, sid TEXT, path TEXT, country TEXT, device TEXT, src TEXT, app INTEGER)"
  );
  await env.STATS.exec("CREATE INDEX IF NOT EXISTS idx_visits_day ON visits (day)");
  await env.STATS.exec(
    "CREATE TABLE IF NOT EXISTS presence (sid TEXT PRIMARY KEY, last INTEGER, path TEXT, country TEXT, device TEXT, app INTEGER)"
  );
  await env.STATS.exec("CREATE INDEX IF NOT EXISTS idx_presence_last ON presence (last)");
  READY = true;
}

/* ===================== collecting ===================== */

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|lighthouse|headless|pagespeed|inspectiontool|google-|adsbot|mediapartners|feedfetcher|gtmetrix|pingdom|uptime|monitor|scanner|python|curl|wget|axios|node-fetch|undici|go-http|okhttp|java\/|httpclient|scrapy|phantom|selenium|puppeteer|playwright|censys|shodan|zgrab|masscan|nuclei/i;

/* Networks that host servers, not homes or phones: visits from them are almost always
   bots, scanners or tools (or a VPN). Matched by AS number, then by the network's name.
   Cloudflare WARP and iCloud Private Relay are left out on purpose: real phones use them. */
const DC_ASN = new Set([15169, 396982, 19527, 16509, 14618, 8987, 8075, 8068, 14061, 16276, 24940, 213230, 63949, 20473, 31898, 45102, 37963, 132203, 45090, 51167, 60781, 16265, 28753, 9009, 12876, 136907, 55990, 47583, 60068, 40021, 36352, 62567, 398324, 398705, 211298, 202425, 135377, 7941, 46664, 53667, 35540, 197540, 51396, 49981, 39572, 212238, 140227, 21859, 32613, 22612, 26496, 30083, 33070, 133752, 4134, 4837]);
const DC_ORG = /amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|ovh|hetzner|linode|vultr|choopa|oracle|alibaba|aliyun|tencent|huawei cloud|contabo|leaseweb|m247|scaleway|hostinger|datacamp|hosting|datacenter|data center|colocation|servers?\b|vps|cloud ?(computing|services)|censys|shodan|internet measurement|packet ?host|psychz|quadranet|serverion|frantech|buyvm|ionos|1&1|godaddy|namecheap|dreamhost|bluehost|hostgator|kamatera|upcloud|cherry ?servers|g-core|gcore|stark industries|aeza|pq hosting|zenlayer|tzulo/i;
export function isDatacenter(cf) {
  if (!cf) return false;
  if (DC_ASN.has(+cf.asn)) return true;
  return DC_ORG.test(String(cf.asOrganization || ""));
}

function device(ua) {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

function source(ref, host) {
  if (!ref) return "direct";
  let h = "";
  try { h = new URL(ref).hostname.replace(/^www\./, ""); } catch { return "other"; }
  if (h === host) return "internal";
  if (/(^|\.)google\./.test(h)) return "google";
  if (/(^|\.)bing\.com$/.test(h)) return "bing";
  if (/instagram\.com$/.test(h)) return "instagram";
  if (/facebook\.com$|fb\.com$|messenger\.com$/.test(h)) return "facebook";
  if (/youtube\.com$|youtu\.be$/.test(h)) return "youtube";
  if (/tiktok\.com$/.test(h)) return "tiktok";
  if (/t\.co$|twitter\.com$|x\.com$/.test(h)) return "x";
  if (/telegram|t\.me$/.test(h)) return "telegram";
  if (/whatsapp/.test(h)) return "whatsapp";
  if (/duckduckgo|yahoo|yandex|baidu|ecosia|brave/.test(h)) return "other search";
  return "other";
}

import { isMe, initInsights } from "./insights.js";

export async function track(env, request, body) {
  if (!env.STATS || !body) return;
  const ua = request.headers.get("user-agent") || "";
  if (BOT.test(ua)) return;
  const t = body.t === "view" ? "view" : body.t === "beat" ? "beat" : null;
  const sid = String(body.s || "");
  if (!t || !/^[a-z0-9]{8,40}$/.test(sid)) return;

  await init(env);
  await initInsights(env);
  const me = (await isMe(env, body.m)) ? 1 : 0;
  const now = Date.now();
  const d = new Date(now);
  const path = String(body.p || "/").slice(0, 80);
  const country = (request.headers.get("CF-IPCountry") || "").slice(0, 2);
  const dev = device(ua);
  const app = body.a ? 1 : 0;
  const vid = /^[a-z0-9]{8,40}$/.test(String(body.v || "")) ? String(body.v) : sid;
  // the owner is never a bot; otherwise automated browsers and server networks are
  const bot = me ? 0 : body.w ? 1 : isDatacenter(request.cf) ? 2 : 0;

  const stmts = [
    env.STATS.prepare(
      "INSERT INTO presence (sid, last, path, country, device, app, me, bot) VALUES (?,?,?,?,?,?,?,?) " +
        "ON CONFLICT(sid) DO UPDATE SET last=excluded.last, path=excluded.path, me=excluded.me, bot=excluded.bot"
    ).bind(sid, now, path, country, dev, app, me, bot),
  ];
  if (t === "view") {
    const host = new URL(request.url).hostname.replace(/^www\./, "");
    stmts.push(
      env.STATS.prepare(
        "INSERT INTO visits (ts, day, hour, sid, path, country, device, src, app, me, vid, bot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(now, d.toISOString().slice(0, 10), d.getUTCHours(), sid, path, country, dev, source(String(body.r || ""), host), app, me, vid, bot)
    );
  }
  if (env.STATS.batch) await env.STATS.batch(stmts);
  else for (const s of stmts) await s.run();
}

/* ===================== reading ===================== */

export async function liveNow(env) {
  const empty = { now: 0, countries: [], pages: [], devices: [], app: 0 };
  if (!env.STATS) return empty;
  try {
    await init(env);
    await initInsights(env);
    const since = Date.now() - LIVE_MS;
    const all = async (sql) => (await env.STATS.prepare(sql).bind(since).all()).results || [];
    const one = async (sql) => ((await env.STATS.prepare(sql).bind(since).first()) || {}).n || 0;
    return {
      now: await one("SELECT COUNT(*) n FROM presence WHERE last > ? AND COALESCE(bot,0)=0"),
      me: await one("SELECT COUNT(*) n FROM presence WHERE last > ? AND COALESCE(bot,0)=0 AND me=1"),
      app: await one("SELECT COUNT(*) n FROM presence WHERE last > ? AND COALESCE(bot,0)=0 AND app=1"),
      countries: await all("SELECT country k, COUNT(*) n FROM presence WHERE last > ? AND COALESCE(bot,0)=0 AND country!='' GROUP BY country ORDER BY n DESC LIMIT 8"),
      pages: await all("SELECT path k, COUNT(*) n FROM presence WHERE last > ? AND COALESCE(bot,0)=0 GROUP BY path ORDER BY n DESC LIMIT 8"),
      devices: await all("SELECT device k, COUNT(*) n FROM presence WHERE last > ? AND COALESCE(bot,0)=0 GROUP BY device ORDER BY n DESC"),
    };
  } catch (_) {
    return empty;
  }
}

/** Everything the Visitors tab shows, for a window of N days (1, 7, 30 or 90). */
export async function report(env, days) {
  await initInsights(env).catch(() => {});
  const N = [1, 7, 30, 90].includes(+days) ? +days : 7;
  const out = {
    days: N, visits: 0, pageviews: 0, downloads: 0, conversion: 0, installs: 0,
    series: [], hours: [], pages: [], countries: [], sources: [], devices: [], app: { app: 0, web: 0 },
    totals: { today: 0, d7: 0, d30: 0, d90: 0 },
  };
  if (!env.STATS) return out;
  try {
    await init(env);
    const dayAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const from = dayAgo(N - 1);
    const today = dayAgo(0);
    const one = async (sql, ...b) => ((await env.STATS.prepare(sql).bind(...b).first()) || {}).n || 0;
    const all = async (sql, ...b) => (await env.STATS.prepare(sql).bind(...b).all()).results || [];

    out.visits = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ?", from);
    out.pageviews = await one("SELECT COUNT(*) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ?", from);
    // the events table only exists once something has been downloaded
    const safe = async (fn, d) => { try { return await fn(); } catch { return d; } };
    out.downloads = await safe(() => one("SELECT COUNT(*) n FROM events WHERE kind='resolve' AND ok=1 AND day >= ?", from), 0);
    out.installs = await safe(() => one("SELECT COUNT(*) n FROM events WHERE kind='install' AND day >= ?", from), 0);
    out.conversion = out.visits ? Math.round((out.downloads / out.visits) * 100) : 0;

    out.totals.today = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day = ?", today);
    out.totals.d7 = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ?", dayAgo(6));
    out.totals.d30 = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ?", dayAgo(29));
    out.totals.d90 = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ?", dayAgo(89));

    const vByDay = await all("SELECT day, COUNT(DISTINCT sid) v FROM visits WHERE COALESCE(bot,0)=0 AND day >= ? GROUP BY day", N === 1 ? dayAgo(0) : from);
    const dByDay = await safe(() => all("SELECT day, COUNT(*) d FROM events WHERE kind='resolve' AND ok=1 AND day >= ? GROUP BY day", from), []);
    const vm = Object.fromEntries(vByDay.map((r) => [r.day, r.v]));
    const dm = Object.fromEntries(dByDay.map((r) => [r.day, r.d]));
    const span = Math.max(N, 7);
    for (let i = span - 1; i >= 0; i--) {
      const d = dayAgo(i);
      out.series.push({ day: d, visits: vm[d] || 0, downloads: dm[d] || 0 });
    }

    const hrs = await all("SELECT hour h, COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day = ? GROUP BY hour", today);
    const hm = Object.fromEntries(hrs.map((r) => [r.h, r.n]));
    for (let h = 0; h < 24; h++) out.hours.push(hm[h] || 0);

    out.pages = await all("SELECT path k, COUNT(*) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ? GROUP BY path ORDER BY n DESC LIMIT 10", from);
    out.countries = await all("SELECT country k, COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ? AND country!='' GROUP BY country ORDER BY n DESC LIMIT 10", from);
    out.sources = await all("SELECT src k, COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ? AND src!='internal' GROUP BY src ORDER BY n DESC LIMIT 10", from);
    out.devices = await all("SELECT device k, COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ? GROUP BY device ORDER BY n DESC", from);
    const split = await all("SELECT app k, COUNT(DISTINCT sid) n FROM visits WHERE COALESCE(bot,0)=0 AND day >= ? GROUP BY app", from);
    for (const r of split) out.app[r.k ? "app" : "web"] = r.n;
  } catch (_) {}
  return out;
}

/* ===================== housekeeping ===================== */

export async function pruneVisits(env) {
  if (!env.STATS) return;
  try {
    await init(env);
    const cut = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    await env.STATS.prepare("DELETE FROM visits WHERE day < ?").bind(cut).run();
    await env.STATS.prepare("DELETE FROM presence WHERE last < ?").bind(Date.now() - 864e5).run();
  } catch (_) {}
}

/**
 * scope "stats": every number — visits, downloads, events, notification history.
 * scope "all":   the above plus subscribers, cookies, ads, SEO, settings and alerts.
 * The admin password and the push signing keys are always kept, so the owner
 * can still sign in and installed phones keep working.
 */
export async function resetData(env, scope) {
  const done = [];
  if (env.STATS) {
    await init(env);
    const tables = ["visits", "presence", "events", "broadcasts"];
    if (scope === "all") tables.push("subs");
    for (const t of tables) {
      try { await env.STATS.prepare("DELETE FROM " + t).run(); done.push(t); } catch (_) {}
    }
  }
  if (scope === "all") {
    for (const k of ["config", "cookies", "broadcast", "alertstate", "lastgood", "pushsubs"]) {
      try { await env.CONFIG.delete(k); done.push(k); } catch (_) {}
    }
  } else {
    try { await env.CONFIG.delete("broadcast"); } catch (_) {}
  }
  return done;
}
