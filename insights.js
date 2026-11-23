/**
 * insights.js — the owner's view of the site over any period:
 *   • visitor reports for any date range (all time by default)
 *   • "me" — the owner's own devices, so his visits can be shown or left out
 *   • download history: every resolve attempt, ok or failed, with device, IP and link
 *   • deleting data for a range, or all of it
 *   • the daily morning summary
 * Dates are the owner's local dates (Asia/Dhaka, UTC+6, unless changed in settings).
 */

import { isDatacenter } from "./visits.js";
const BOT_UA = /bot|crawl|spider|slurp|headless|inspectiontool|python|curl|wget|axios|node-fetch|undici|go-http|okhttp|java\/|scrapy|puppeteer|playwright|selenium/i;

let READY = false;
export async function initInsights(env) {
  if (READY || !env.STATS) return;
  const ex = async (s) => { try { await env.STATS.exec(s); } catch (_) {} };
  await ex("CREATE TABLE IF NOT EXISTS dlog (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, ok INTEGER, code TEXT, url TEXT, kind TEXT, n INTEGER, err TEXT, ip TEXT, device TEXT, ua TEXT, country TEXT, me INTEGER DEFAULT 0, app INTEGER DEFAULT 0, ms INTEGER)");
  await ex("CREATE INDEX IF NOT EXISTS idx_dlog_ts ON dlog (ts)");
  await ex("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day TEXT, hour INTEGER, sid TEXT, path TEXT, country TEXT, device TEXT, src TEXT, app INTEGER)");
  await ex("CREATE TABLE IF NOT EXISTS presence (sid TEXT PRIMARY KEY, last INTEGER, path TEXT, country TEXT, device TEXT, app INTEGER)");
  await ex("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day TEXT, kind TEXT, ok INTEGER, method TEXT, ms INTEGER, country TEXT, err TEXT)");
  await ex("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, name TEXT, email TEXT, topic TEXT, body TEXT, country TEXT, iph TEXT, status TEXT DEFAULT 'new')");
  await ex("ALTER TABLE visits ADD COLUMN me INTEGER DEFAULT 0");
  await ex("ALTER TABLE presence ADD COLUMN me INTEGER DEFAULT 0");
  await ex("CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits (ts)");
  await ex("ALTER TABLE visits ADD COLUMN vid TEXT");
  await ex("ALTER TABLE visits ADD COLUMN bot INTEGER DEFAULT 0");
  await ex("ALTER TABLE presence ADD COLUMN bot INTEGER DEFAULT 0");
  await ex("ALTER TABLE dlog ADD COLUMN bot INTEGER DEFAULT 0");
  READY = true;
}

/* ===================== the owner's own devices ===================== */

let ME = { v: null, exp: 0 };
export async function meToken(env, renew) {
  if (!renew && ME.v && ME.exp > Date.now()) return ME.v;
  let t = renew ? null : await env.CONFIG.get("metoken");
  if (!t) {
    t = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, "0")).join("");
    await env.CONFIG.put("metoken", t);
  }
  ME = { v: t, exp: Date.now() + 60_000 };
  return t;
}
export async function isMe(env, token) {
  if (!token || typeof token !== "string" || token.length < 16) return false;
  return token === (await meToken(env));
}

/* ===================== device details ===================== */

export function uaInfo(ua) {
  ua = String(ua || "");
  let os = "Other", model = "", browser = "";
  let m;
  if ((m = ua.match(/Android\s([\d.]+)(?:;\s*([^;)]+))?(?:;\s*([^;)]+))?/))) {
    os = "Android " + m[1].split(".")[0];
    const parts = [m[2], m[3]].filter(Boolean).map((s) => s.replace(/\s*Build\/.*/, "").trim()).filter((s) => s && !/^(K|wv|Linux|U|en-\w+)$/i.test(s));
    model = parts[parts.length - 1] || "";
  } else if ((m = ua.match(/(iPhone|iPad|iPod).*?OS\s([\d_]+)/))) {
    os = m[1] + " iOS " + m[2].split("_")[0];
  } else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "Mac";
  else if (/CrOS/.test(ua)) os = "Chromebook";
  else if (/Linux/.test(ua)) os = "Linux";
  if (/Instagram/.test(ua)) browser = "Instagram app";
  else if (/FBAN|FBAV/.test(ua)) browser = "Facebook app";
  else if (/EdgA?\//.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox|FxiOS/.test(ua)) browser = "Firefox";
  else if (/CriOS|Chrome\//.test(ua)) browser = /; wv\)/.test(ua) ? "WebView" : "Chrome";
  else if (/Safari/.test(ua)) browser = "Safari";
  const kind = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : /windows|macintosh|linux|cros/i.test(ua) ? "desktop" : "other";
  return { kind, text: [os, model, browser].filter(Boolean).join(" · ").slice(0, 90) };
}

/* ===================== download history ===================== */

export async function logDownload(env, request, row) {
  if (!env.STATS) return;
  try {
    await initInsights(env);
    const ua = request.headers.get("user-agent") || "";
    const d = uaInfo(ua);
    const me = (await isMe(env, request.headers.get("x-me") || "")) ? 1 : 0;
    const bot = me ? 0 : BOT_UA.test(ua) || isDatacenter(request.cf) ? 1 : 0;
    await env.STATS.prepare(
      "INSERT INTO dlog (ts, ok, code, url, kind, n, err, ip, device, ua, country, me, app, ms, bot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      Date.now(), row.ok ? 1 : 0, String(row.code || "").slice(0, 40), String(row.url || "").slice(0, 300), row.kind || "", row.n || 0,
      String(row.err || "").slice(0, 160), request.headers.get("CF-Connecting-IP") || "", d.kind, d.text,
      (request.headers.get("CF-IPCountry") || "").slice(0, 2), me, request.headers.get("x-app") === "1" ? 1 : 0, row.ms || 0, bot
    ).run();
  } catch (_) {}
}

/* ===================== ranges ===================== */

export function tzOff(cfg) { const o = +(cfg && cfg.settings && cfg.settings.tzOffset); return isFinite(o) && Math.abs(o) <= 14 ? o : 6; }
export function localDay(ts, off) { return new Date(ts + off * 3600e3).toISOString().slice(0, 10); }
function bounds(from, to, off) {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const f = ok(from) ? Date.parse(from + "T00:00:00Z") - off * 3600e3 : 0;
  const t = ok(to) ? Date.parse(to + "T00:00:00Z") + 864e5 - off * 3600e3 : Date.now() + 864e5;
  return [f, t];
}
const meSql = (me) => (me === "not" ? " AND COALESCE(me,0)=0" : me === "only" ? " AND me=1" : "");

/** Everything the Visitors tab shows for a date range. */
export async function rangeReport(env, cfg, q) {
  const off = tzOff(cfg);
  const mod = (off >= 0 ? "+" : "") + off + " hours";
  const [f, t] = bounds(q.from, q.to, off);
  const me = ["all", "not", "only"].includes(q.me) ? q.me : "all";
  const out = {
    from: q.from || "", to: q.to || "", me, visits: 0, visitsAll: 0, visitsNotMe: 0, pageviews: 0,
    people: 0, bots: 0, botViews: 0, downloads: 0, fails: 0, dlAll: 0, dlNotMe: 0, conversion: 0, installs: 0,
    series: [], unit: "day", hours: [], pages: [], countries: [], sources: [], devices: [], app: { app: 0, web: 0 }, first: null, historySince: null,
  };
  if (!env.STATS) return out;
  await initInsights(env);
  const one = async (sql, ...b) => { try { return ((await env.STATS.prepare(sql).bind(...b).first()) || {}).n || 0; } catch (_) { return 0; } };
  const all = async (sql, ...b) => { try { return (await env.STATS.prepare(sql).bind(...b).all()).results || []; } catch (_) { return []; } };
  const W0 = " WHERE ts >= ? AND ts < ?";
  const W = W0 + " AND COALESCE(bot,0)=0";
  const M = meSql(me);

  out.visitsAll = await one("SELECT COUNT(DISTINCT sid) n FROM visits" + W, f, t);
  out.visitsNotMe = await one("SELECT COUNT(DISTINCT sid) n FROM visits" + W + " AND COALESCE(me,0)=0", f, t);
  out.visits = me === "all" ? out.visitsAll : me === "not" ? out.visitsNotMe : out.visitsAll - out.visitsNotMe;
  out.pageviews = await one("SELECT COUNT(*) n FROM visits" + W + M, f, t);
  out.people = await one("SELECT COUNT(DISTINCT COALESCE(vid,sid)) n FROM visits" + W + M, f, t);
  out.bots = await one("SELECT COUNT(DISTINCT sid) n FROM visits" + W0 + " AND bot>0", f, t);
  out.botViews = await one("SELECT COUNT(*) n FROM visits" + W0 + " AND bot>0", f, t);
  out.dlAll = await one("SELECT COUNT(*) n FROM dlog" + W + " AND ok=1", f, t);
  out.dlNotMe = await one("SELECT COUNT(*) n FROM dlog" + W + " AND ok=1 AND COALESCE(me,0)=0", f, t);
  out.downloads = me === "all" ? out.dlAll : me === "not" ? out.dlNotMe : out.dlAll - out.dlNotMe;
  out.fails = await one("SELECT COUNT(*) n FROM dlog" + W + " AND ok=0" + M, f, t);
  out.installs = await one("SELECT COUNT(*) n FROM events WHERE kind='install' AND ts >= ? AND ts < ?", f, t);
  out.botDl = await one("SELECT COUNT(*) n FROM dlog" + W0 + " AND bot>0", f, t);
  out.conversion = out.visits ? Math.min(100, Math.round((out.downloads / out.visits) * 100)) : 0;
  out.first = (await all("SELECT MIN(ts) t FROM visits WHERE COALESCE(bot,0)=0"))[0]?.t || null;
  out.historySince = (await all("SELECT MIN(ts) t FROM dlog"))[0]?.t || null;

  // span: whole days in the range (all-time starts at the first visit)
  const start = Math.max(f, out.first || f || Date.now());
  const end = Math.max(start + 1, Math.min(t, Date.now()));
  // count whole local calendar days from the first to the last, both included
  const days = Math.max(1, Math.round((Date.parse(localDay(end - 1, off)) - Date.parse(localDay(start, off))) / 864e5) + 1);
  const fmt = days > 120 ? "%Y-%m" : "%Y-%m-%d";
  out.unit = days > 120 ? "month" : "day";
  const g = `strftime('${fmt}', ts/1000, 'unixepoch', '${mod}')`;
  const vRows = await all(`SELECT ${g} k, COUNT(DISTINCT sid) v FROM visits${W}${M} GROUP BY k`, f, t);
  const dRows = await all(`SELECT ${g} k, COUNT(*) d FROM dlog${W} AND ok=1${M} GROUP BY k`, f, t);
  const vm = Object.fromEntries(vRows.map((r) => [r.k, r.v]));
  const dm = Object.fromEntries(dRows.map((r) => [r.k, r.d]));
  if (out.unit === "day") {
    const s0 = localDay(start, off);
    for (let i = 0; i < Math.min(days, 120); i++) {
      const k = new Date(Date.parse(s0 + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10);
      if (Date.parse(k) > Date.now() + off * 3600e3) break;
      out.series.push({ day: k, visits: vm[k] || 0, downloads: dm[k] || 0 });
    }
  } else {
    const keys = [...new Set([...Object.keys(vm), ...Object.keys(dm)])].sort();
    for (const k of keys) out.series.push({ day: k, visits: vm[k] || 0, downloads: dm[k] || 0 });
  }
  const hrs = await all(`SELECT CAST(strftime('%H', ts/1000, 'unixepoch', '${mod}') AS INTEGER) h, COUNT(DISTINCT sid) n FROM visits${W}${M} GROUP BY h`, f, t);
  const hm = Object.fromEntries(hrs.map((r) => [r.h, r.n]));
  for (let h = 0; h < 24; h++) out.hours.push(hm[h] || 0);

  out.pages = await all(`SELECT path k, COUNT(*) n FROM visits${W}${M} GROUP BY path ORDER BY n DESC LIMIT 12`, f, t);
  out.countries = await all(`SELECT country k, COUNT(DISTINCT sid) n FROM visits${W}${M} AND country!='' GROUP BY country ORDER BY n DESC LIMIT 12`, f, t);
  out.sources = await all(`SELECT src k, COUNT(DISTINCT sid) n FROM visits${W}${M} AND src!='internal' GROUP BY src ORDER BY n DESC LIMIT 10`, f, t);
  out.devices = await all(`SELECT device k, COUNT(DISTINCT sid) n FROM visits${W}${M} GROUP BY device ORDER BY n DESC`, f, t);
  for (const r of await all(`SELECT app k, COUNT(DISTINCT sid) n FROM visits${W}${M} GROUP BY app`, f, t)) out.app[r.k ? "app" : "web"] = r.n;
  return out;
}

/** Download history rows, newest first. */
export async function history(env, cfg, q) {
  if (!env.STATS) return { rows: [], total: 0 };
  await initInsights(env);
  const off = tzOff(cfg);
  const [f, t] = bounds(q.from, q.to, off);
  const lim = Math.max(1, Math.min(500, +q.limit || 10));
  let where = " WHERE ts >= ? AND ts < ?" + meSql(q.me);
  const b = [f, t];
  if (q.status === "ok") where += " AND ok=1";
  if (q.status === "fail") where += " AND ok=0";
  if (+q.before) { where += " AND id < ?"; b.push(+q.before); }
  if (+q.after) { where += " AND id > ?"; b.push(+q.after); }
  if (q.q) { where += " AND (url LIKE ? OR ip LIKE ? OR ua LIKE ? OR err LIKE ?)"; const s = "%" + String(q.q).slice(0, 60) + "%"; b.push(s, s, s, s); }
  try {
    const rows = (await env.STATS.prepare("SELECT id,ts,ok,code,url,kind,n,err,ip,device,ua,country,me,app,ms,bot FROM dlog" + where + " ORDER BY id DESC LIMIT ?").bind(...b, lim).all()).results || [];
    const cnt = await env.STATS.prepare("SELECT COUNT(*) n, SUM(ok) okn FROM dlog WHERE ts >= ? AND ts < ?" + meSql(q.me)).bind(f, t).first();
    return { rows, total: (cnt && cnt.n) || 0, okn: (cnt && cnt.okn) || 0 };
  } catch (_) {
    return { rows: [], total: 0, okn: 0 };
  }
}

/** Delete visitor data and/or download history for a range (or everything). */
export async function deleteRange(env, cfg, q) {
  if (!env.STATS) return { deleted: 0 };
  await initInsights(env);
  const off = tzOff(cfg);
  const [f, t] = q.all ? [0, Date.now() + 864e5] : bounds(q.from, q.to, off);
  let deleted = 0;
  const run = async (sql, ...b) => { try { const r = await env.STATS.prepare(sql).bind(...b).run(); deleted += (r.meta && r.meta.changes) || 0; } catch (_) {} };
  if (q.what === "visits" || q.what === "both") {
    await run("DELETE FROM visits WHERE ts >= ? AND ts < ?", f, t);
    await run("DELETE FROM events WHERE kind IN ('install','app_open','share_in','push_click','banner_shown','banner_accept','notify_accept','appsec_tap','appsec_accept') AND ts >= ? AND ts < ?", f, t);
    if (q.all) await run("DELETE FROM presence");
  }
  if (q.what === "history" || q.what === "both") {
    await run("DELETE FROM dlog WHERE ts >= ? AND ts < ?", f, t);
    await run("DELETE FROM events WHERE kind='resolve' AND ts >= ? AND ts < ?", f, t);
  }
  return { deleted };
}

export async function storage(env) {
  const out = { visits: 0, history: 0, messages: 0, oldest: null, kb: 0 };
  if (!env.STATS) return out;
  await initInsights(env);
  const one = async (sql) => { try { return (await env.STATS.prepare(sql).first()) || {}; } catch (_) { return {}; } };
  out.visits = (await one("SELECT COUNT(*) n FROM visits")).n || 0;
  out.history = (await one("SELECT COUNT(*) n FROM dlog")).n || 0;
  out.events = (await one("SELECT COUNT(*) n FROM events")).n || 0;
  out.messages = (await one("SELECT COUNT(*) n FROM messages")).n || 0;
  const o = await one("SELECT MIN(ts) t FROM visits");
  out.oldest = o.t || null;
  out.kb = Math.round((out.visits * 130 + out.history * 360 + out.events * 90 + out.messages * 900) / 1024);
  return out;
}

/** Automatic clean-up: only when the owner set a number of days (0 = keep forever). */
export async function autoPrune(env, cfg) {
  const days = +(cfg.settings && cfg.settings.keepDays) || 0;
  if (!env.STATS) return;
  await initInsights(env);
  try { await env.STATS.prepare("DELETE FROM presence WHERE last < ?").bind(Date.now() - 864e5).run(); } catch (_) {}
  if (!days) return;
  const cut = Date.now() - days * 864e5;
  for (const sql of ["DELETE FROM visits WHERE ts < ?", "DELETE FROM dlog WHERE ts < ?", "DELETE FROM events WHERE ts < ?"]) {
    try { await env.STATS.prepare(sql).bind(cut).run(); } catch (_) {}
  }
}

/* ===================== summaries ===================== */

/** Numbers for one local day, without the owner's own visits. */
export async function daySummary(env, cfg, day) {
  const r = await rangeReport(env, cfg, { from: day, to: day, me: "not" });
  return { day, visits: r.visits, downloads: r.downloads, fails: r.fails, installs: r.installs };
}

/** Views per blog post (all time and last 30 days), without the owner. */
export async function postViews(env) {
  if (!env.STATS) return {};
  await initInsights(env);
  try {
    const since = Date.now() - 30 * 864e5;
    const rows = (await env.STATS.prepare(
      "SELECT path, COUNT(*) n, SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) m FROM visits WHERE path LIKE '/blog/%' AND COALESCE(me,0)=0 AND COALESCE(bot,0)=0 GROUP BY path"
    ).bind(since).all()).results || [];
    const out = {};
    for (const r of rows) out[r.path.slice(6)] = { all: r.n, d30: r.m || 0 };
    return out;
  } catch (_) {
    return {};
  }
}
