/**
 * store.js — KV config, cookie pool, D1 stats
 */

const MEM = { cfg: null, cfgExp: 0, ck: null, ckExp: 0, rr: 0, dbReady: false, probe: null, probeExp: 0 };
const TTL = 60_000; // in-isolate cache, keeps KV reads tiny at scale

export const DEFAULT_CONFIG = {
  brand: { name: "IGtoDownload", tagline: "Download Instagram videos, reels, photos & IGTV in HD" },
  analytics: { ga4: "", adsense: "", gscTag: "", adsenseClient: "" },
  settings: {
    cacheTtl: 3600,
    rateLimitPerHour: 40,
    maintenance: false,
    adsEnabled: true,
    telegramToken: "",
    telegramChat: "",
    cacheSalt: 0,
    // optional: route Instagram calls through a URL-template proxy
    proxyTemplate: "",
    proxyHeaders: "",
    // optional: last-resort external resolver API
    apiTemplate: "",
    apiHeaders: "",
    probeUrl: "",
  },
  alerts: {
    lang: "bn",
    vibrate: true,
    vibrateSeconds: 2,
    vibrateRepeat: 3,
    vibrateGapMs: 400,
    pollSeconds: 30,
    notifyWarn: true,
    repeatMinutes: 180,
  },
  ads: {},
  seo: {},
};

export const AD_SLOTS = [
  { id: "header", label: "Header banner", hint: "Top of every page, under the nav" },
  { id: "under_input", label: "Under search box", hint: "Highest CTR position" },
  { id: "above_result", label: "Above result", hint: "Shows once a video is found" },
  { id: "below_result", label: "Below result", hint: "Right under the download buttons" },
  { id: "in_content", label: "Mid content", hint: "Between the article sections" },
  { id: "sidebar", label: "Sidebar", hint: "Desktop only, sticky" },
  { id: "sticky_bottom", label: "Sticky bottom", hint: "Anchor ad, mobile friendly" },
  { id: "sticky_top", label: "Sticky top", hint: "Anchor ad at the top" },
  { id: "footer", label: "Footer", hint: "Above the footer links" },
  { id: "native", label: "Native / in-feed", hint: "Blends with the FAQ list" },
];

function freshConfig() {
  const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  for (const s of AD_SLOTS) c.ads[s.id] = { code: "", enabled: false, device: "both" };
  return c;
}

export async function getConfig(env) {
  const now = Date.now();
  if (MEM.cfg && now < MEM.cfgExp) return MEM.cfg;
  let cfg = freshConfig();
  try {
    const raw = await env.CONFIG.get("config");
    if (raw) cfg = deepMerge(cfg, JSON.parse(raw));
  } catch (_) {}
  MEM.cfg = cfg;
  MEM.cfgExp = now + TTL;
  return cfg;
}

export async function saveConfig(env, cfg) {
  await env.CONFIG.put("config", JSON.stringify(cfg));
  MEM.cfg = cfg;
  MEM.cfgExp = Date.now() + TTL;
}

/* ---------------- cookie pool ---------------- */

export async function getCookies(env) {
  const now = Date.now();
  if (MEM.ck && now < MEM.ckExp) return MEM.ck;
  let list = [];
  try {
    const raw = await env.CONFIG.get("cookies");
    if (raw) list = JSON.parse(raw);
  } catch (_) {}
  // seed from the IG_COOKIE secret the first time
  if (!list.length && env.IG_COOKIE) {
    list = [{ id: "seed", label: "from IG_COOKIE secret", value: env.IG_COOKIE, status: "ok", fails: 0, uses: 0, lastOk: 0 }];
  }
  MEM.ck = list;
  MEM.ckExp = now + TTL;
  return list;
}

export async function saveCookies(env, list) {
  await env.CONFIG.put("cookies", JSON.stringify(list));
  MEM.ck = list;
  MEM.ckExp = Date.now() + TTL;
}

export function flushCookieCache() {
  MEM.ckExp = 0;
}

/**
 * Healthy cookies first, in round-robin order so load spreads evenly.
 * Dead ones are appended rather than dropped: if every cookie is marked dead
 * the site still tries them, and a working one revives itself on the spot.
 */
export function pickOrder(list) {
  const usable = list.filter((c) => c.value);
  const live = usable.filter((c) => c.status !== "dead");
  const dead = usable.filter((c) => c.status === "dead");
  if (!live.length) return dead;
  const start = MEM.rr++ % live.length;
  return live.slice(start).concat(live.slice(0, start)).concat(dead);
}

/* ---- probe code: a post we know exists, used by the health check ---- */

export async function rememberGoodCode(env, code) {
  const now = Date.now();
  if (MEM.probe === code && now < MEM.probeExp) return;
  MEM.probe = code;
  MEM.probeExp = now + 1800_000; // write at most twice an hour
  try { await env.CONFIG.put("lastgood", code); } catch (_) {}
}

export async function probeCode(env, cfg) {
  try {
    const v = await env.CONFIG.get("lastgood");
    if (v) return v;
  } catch (_) {}
  const u = cfg && cfg.settings && cfg.settings.probeUrl;
  if (u) {
    const m = String(u).match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_\-]{5,})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_\-]{8,16}$/.test(String(u).trim())) return String(u).trim();
  }
  return null;
}

export function normalizeCookie(v) {
  const s = (v || "").trim();
  if (!s) return "";
  if (s.includes("sessionid=")) return s;
  return "sessionid=" + s;
}

/* ---------------- D1 stats ---------------- */

export async function initDb(env) {
  if (MEM.dbReady || !env.STATS) return;
  await env.STATS.exec(
    "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, day TEXT, kind TEXT, ok INTEGER, method TEXT, ms INTEGER, country TEXT, err TEXT)"
  );
  await env.STATS.exec("CREATE INDEX IF NOT EXISTS idx_day ON events (day)");
  MEM.dbReady = true;
}

export async function logEvent(env, row) {
  if (!env.STATS) return;
  try {
    await initDb(env);
    const ts = Date.now();
    await env.STATS.prepare(
      "INSERT INTO events (ts, day, kind, ok, method, ms, country, err) VALUES (?,?,?,?,?,?,?,?)"
    )
      .bind(ts, new Date(ts).toISOString().slice(0, 10), row.kind || "resolve", row.ok ? 1 : 0, row.method || "", row.ms || 0, row.country || "", (row.err || "").slice(0, 120))
      .run();
  } catch (_) {}
}

export async function getStats(env) {
  const empty = { today: 0, week: 0, month: 0, rate: 0, methods: [], days: [], countries: [], errors: [] };
  if (!env.STATS) return empty;
  try {
    await initDb(env);
    const day = new Date().toISOString().slice(0, 10);
    const d7 = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);

    const q = async (sql, ...b) => (await env.STATS.prepare(sql).bind(...b).all()).results || [];

    const [t] = await q("SELECT COUNT(*) n FROM events WHERE day=? AND kind='resolve' AND ok=1", day);
    const [w] = await q("SELECT COUNT(*) n FROM events WHERE day>=? AND kind='resolve' AND ok=1", d7);
    const [m] = await q("SELECT COUNT(*) n FROM events WHERE day>=? AND kind='resolve' AND ok=1", d30);
    const [r] = await q(
      "SELECT SUM(ok) s, COUNT(*) c FROM events WHERE day>=? AND kind='resolve'",
      d7
    );
    const methods = await q(
      "SELECT method, COUNT(*) n, SUM(ok) ok FROM events WHERE day>=? AND kind='resolve' GROUP BY method ORDER BY n DESC",
      d7
    );
    const days = await q(
      "SELECT day, COUNT(*) n, SUM(ok) ok FROM events WHERE day>=? AND kind='resolve' GROUP BY day ORDER BY day",
      d30
    );
    const countries = await q(
      "SELECT country, COUNT(*) n FROM events WHERE day>=? AND country!='' GROUP BY country ORDER BY n DESC LIMIT 8",
      d7
    );
    const errors = await q(
      "SELECT err, COUNT(*) n FROM events WHERE day>=? AND ok=0 AND err!='' GROUP BY err ORDER BY n DESC LIMIT 6",
      d7
    );

    return {
      today: (t && t.n) || 0,
      week: (w && w.n) || 0,
      month: (m && m.n) || 0,
      rate: r && r.c ? Math.round((r.s / r.c) * 100) : 0,
      methods,
      days,
      countries,
      errors,
    };
  } catch (_) {
    return empty;
  }
}

export async function prune(env) {
  if (!env.STATS) return;
  try {
    const cut = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    await env.STATS.prepare("DELETE FROM events WHERE day < ?").bind(cut).run();
  } catch (_) {}
}

/* ---------------- misc ---------------- */

export function deepMerge(base, over) {
  if (over == null) return base;
  if (typeof base !== "object" || Array.isArray(base) || typeof over !== "object" || Array.isArray(over)) return over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

export async function notify(env, text) {
  const cfg = await getConfig(env);
  const { telegramToken, telegramChat } = cfg.settings;
  if (!telegramToken || !telegramChat) return;
  try {
    await fetch("https://api.telegram.org/bot" + telegramToken + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChat, text }),
    });
  } catch (_) {}
}
