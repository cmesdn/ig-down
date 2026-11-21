/**
 * visits.js — live visitors and site analytics.
 *
 * A visit is one browser session (anonymous id kept in sessionStorage, gone
 * when the tab closes — no cookies, no cross-day tracking). The page sends
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

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|lighthouse|headless|pagespeed/i;

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

export async function track(env, request, body) {
  if (!env.STATS || !body) return;
  const ua = request.headers.get("user-agent") || "";
  if (BOT.test(ua)) return;
  const t = body.t === "view" ? "view" : body.t === "beat" ? "beat" : null;
  const sid = String(body.s || "");
  if (!t || !/^[a-z0-9]{8,40}$/.test(sid)) return;

  await init(env);
  const now = Date.now();
  const d = new Date(now);
  const path = String(body.p || "/").slice(0, 80);
  const country = (request.headers.get("CF-IPCountry") || "").slice(0, 2);
  const dev = device(ua);
  const app = body.a ? 1 : 0;

  const stmts = [
    env.STATS.prepare(
      "INSERT INTO presence (sid, last, path, country, device, app) VALUES (?,?,?,?,?,?) " +
        "ON CONFLICT(sid) DO UPDATE SET last=excluded.last, path=excluded.path"
    ).bind(sid, now, path, country, dev, app),
  ];
  if (t === "view") {
    const host = new URL(request.url).hostname.replace(/^www\./, "");
    stmts.push(
      env.STATS.prepare(
        "INSERT INTO visits (ts, day, hour, sid, path, country, device, src, app) VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(now, d.toISOString().slice(0, 10), d.getUTCHours(), sid, path, country, dev, source(String(body.r || ""), host), app)
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
    const since = Date.now() - LIVE_MS;
    const all = async (sql) => (await env.STATS.prepare(sql).bind(since).all()).results || [];
    const one = async (sql) => ((await env.STATS.prepare(sql).bind(since).first()) || {}).n || 0;
    return {
      now: await one("SELECT COUNT(*) n FROM presence WHERE last > ?"),
      app: await one("SELECT COUNT(*) n FROM presence WHERE last > ? AND app=1"),
      countries: await all("SELECT country k, COUNT(*) n FROM presence WHERE last > ? AND country!='' GROUP BY country ORDER BY n DESC LIMIT 8"),
      pages: await all("SELECT path k, COUNT(*) n FROM presence WHERE last > ? GROUP BY path ORDER BY n DESC LIMIT 8"),
      devices: await all("SELECT device k, COUNT(*) n FROM presence WHERE last > ? GROUP BY device ORDER BY n DESC"),
    };
  } catch (_) {
    return empty;
  }
}

/** Everything the Visitors tab shows, for a window of N days (1, 7, 30 or 90). */
export async function report(env, days) {
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

    out.visits = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE day >= ?", from);
    out.pageviews = await one("SELECT COUNT(*) n FROM visits WHERE day >= ?", from);
    // the events table only exists once something has been downloaded
    const safe = async (fn, d) => { try { return await fn(); } catch { return d; } };
    out.downloads = await safe(() => one("SELECT COUNT(*) n FROM events WHERE kind='resolve' AND ok=1 AND day >= ?", from), 0);
    out.installs = await safe(() => one("SELECT COUNT(*) n FROM events WHERE kind='install' AND day >= ?", from), 0);
    out.conversion = out.visits ? Math.round((out.downloads / out.visits) * 100) : 0;

    out.totals.today = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE day = ?", today);
    out.totals.d7 = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE day >= ?", dayAgo(6));
    out.totals.d30 = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE day >= ?", dayAgo(29));
    out.totals.d90 = await one("SELECT COUNT(DISTINCT sid) n FROM visits WHERE day >= ?", dayAgo(89));

    const vByDay = await all("SELECT day, COUNT(DISTINCT sid) v FROM visits WHERE day >= ? GROUP BY day", N === 1 ? dayAgo(0) : from);
    const dByDay = await safe(() => all("SELECT day, COUNT(*) d FROM events WHERE kind='resolve' AND ok=1 AND day >= ? GROUP BY day", from), []);
    const vm = Object.fromEntries(vByDay.map((r) => [r.day, r.v]));
    const dm = Object.fromEntries(dByDay.map((r) => [r.day, r.d]));
    const span = Math.max(N, 7);
    for (let i = span - 1; i >= 0; i--) {
      const d = dayAgo(i);
      out.series.push({ day: d, visits: vm[d] || 0, downloads: dm[d] || 0 });
    }

    const hrs = await all("SELECT hour h, COUNT(DISTINCT sid) n FROM visits WHERE day = ? GROUP BY hour", today);
    const hm = Object.fromEntries(hrs.map((r) => [r.h, r.n]));
    for (let h = 0; h < 24; h++) out.hours.push(hm[h] || 0);

    out.pages = await all("SELECT path k, COUNT(*) n FROM visits WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 10", from);
    out.countries = await all("SELECT country k, COUNT(DISTINCT sid) n FROM visits WHERE day >= ? AND country!='' GROUP BY country ORDER BY n DESC LIMIT 10", from);
    out.sources = await all("SELECT src k, COUNT(DISTINCT sid) n FROM visits WHERE day >= ? AND src!='internal' GROUP BY src ORDER BY n DESC LIMIT 10", from);
    out.devices = await all("SELECT device k, COUNT(DISTINCT sid) n FROM visits WHERE day >= ? GROUP BY device ORDER BY n DESC", from);
    const split = await all("SELECT app k, COUNT(DISTINCT sid) n FROM visits WHERE day >= ? GROUP BY app", from);
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
