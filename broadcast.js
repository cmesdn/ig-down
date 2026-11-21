/**
 * broadcast.js — notifications to site/app users, plus app usage counters.
 *
 * Users opt in themselves (only ever offered after a successful download).
 * Subscriptions live in D1 with the visitor's country, so the admin can
 * target by country. Sending is batched: the free Workers plan allows ~50
 * outbound requests per invocation, so the admin page drives the send in
 * chunks of 40 and shows a progress bar.
 */

import { getVapid, sendTickle } from "./push.js";

const BATCH = 40;
let READY = false;

async function init(env) {
  if (READY || !env.STATS) return;
  await env.STATS.exec(
    "CREATE TABLE IF NOT EXISTS subs (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT UNIQUE, country TEXT, created INTEGER, active INTEGER DEFAULT 1)"
  );
  await env.STATS.exec(
    "CREATE TABLE IF NOT EXISTS broadcasts (id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, title TEXT, body TEXT, url TEXT, image TEXT, countries TEXT, target INTEGER DEFAULT 0, sent INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, gone INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, cursor INTEGER DEFAULT 0, done INTEGER DEFAULT 0)"
  );
  await env.STATS.exec("CREATE INDEX IF NOT EXISTS idx_subs_country ON subs (country)");
  READY = true;
}

/* ===================== public: subscribe ===================== */

export async function subscribeUser(env, sub, country) {
  if (!env.STATS) return { ok: false };
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint)) return { ok: false };
  await init(env);
  await env.STATS.prepare(
    "INSERT INTO subs (endpoint, country, created, active) VALUES (?,?,?,1) ON CONFLICT(endpoint) DO UPDATE SET active=1, country=excluded.country"
  )
    .bind(sub.endpoint.slice(0, 600), (country || "").slice(0, 2), Date.now())
    .run();
  return { ok: true };
}

export async function unsubscribeUser(env, endpoint) {
  if (!env.STATS || !endpoint) return { ok: false };
  await init(env);
  await env.STATS.prepare("UPDATE subs SET active=0 WHERE endpoint=?").bind(String(endpoint).slice(0, 600)).run();
  return { ok: true };
}

/* ===================== public: what the service worker shows ===================== */

export async function latestBroadcast(env) {
  try {
    const raw = await env.CONFIG.get("broadcast");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export async function countClick(env, id) {
  if (!env.STATS || !id) return;
  await init(env);
  await env.STATS.prepare("UPDATE broadcasts SET clicks = clicks + 1 WHERE id=?").bind(+id || 0).run();
}

/* ===================== admin: compose + send ===================== */

export async function createBroadcast(env, b) {
  await init(env);
  const countries = (b.countries || "")
    .toUpperCase()
    .split(/[\s,]+/)
    .filter((c) => /^[A-Z]{2}$/.test(c))
    .join(",");
  const target = await countTargets(env, countries);
  const res = await env.STATS.prepare(
    "INSERT INTO broadcasts (created, title, body, url, image, countries, target) VALUES (?,?,?,?,?,?,?)"
  )
    .bind(Date.now(), b.title.slice(0, 80), b.body.slice(0, 220), (b.url || "/").slice(0, 300), (b.image || "").slice(0, 300), countries, target)
    .run();
  const id = res.meta && res.meta.last_row_id;

  // what the service worker will display when the tickle arrives
  await env.CONFIG.put(
    "broadcast",
    JSON.stringify({ id, title: b.title.slice(0, 80), body: b.body.slice(0, 220), url: b.url || "/", image: b.image || "" })
  );
  return { id, target };
}

async function countTargets(env, countries) {
  const list = countries ? countries.split(",") : [];
  if (!list.length) {
    const r = await env.STATS.prepare("SELECT COUNT(*) n FROM subs WHERE active=1").first();
    return (r && r.n) || 0;
  }
  const q = "SELECT COUNT(*) n FROM subs WHERE active=1 AND country IN (" + list.map(() => "?").join(",") + ")";
  const r = await env.STATS.prepare(q).bind(...list).first();
  return (r && r.n) || 0;
}

/** Send the next batch. The admin page calls this repeatedly until done. */
export async function sendBatch(env, id) {
  await init(env);
  const b = await env.STATS.prepare("SELECT * FROM broadcasts WHERE id=?").bind(+id || 0).first();
  if (!b) return { error: "not found" };
  if (b.done) return { done: true, sent: b.sent, failed: b.failed, gone: b.gone, target: b.target };

  const list = b.countries ? b.countries.split(",") : [];
  let q = "SELECT id, endpoint FROM subs WHERE active=1 AND id > ?";
  const args = [b.cursor || 0];
  if (list.length) {
    q += " AND country IN (" + list.map(() => "?").join(",") + ")";
    args.push(...list);
  }
  q += " ORDER BY id LIMIT " + BATCH;
  const rows = (await env.STATS.prepare(q).bind(...args).all()).results || [];

  if (!rows.length) {
    await env.STATS.prepare("UPDATE broadcasts SET done=1 WHERE id=?").bind(b.id).run();
    return { done: true, sent: b.sent, failed: b.failed, gone: b.gone, target: b.target };
  }

  const vapid = await getVapid(env);
  let sent = 0, failed = 0, gone = 0;
  const dead = [];
  const results = await Promise.all(rows.map((r) => sendTickle(r.endpoint, vapid)));
  results.forEach((res, i) => {
    if (res === "ok") sent++;
    else if (res === "gone") { gone++; dead.push(rows[i].id); }
    else failed++;
  });

  if (dead.length)
    await env.STATS.prepare("UPDATE subs SET active=0 WHERE id IN (" + dead.map(() => "?").join(",") + ")").bind(...dead).run();

  const cursor = rows[rows.length - 1].id;
  await env.STATS.prepare(
    "UPDATE broadcasts SET sent = sent + ?, failed = failed + ?, gone = gone + ?, cursor = ? WHERE id=?"
  )
    .bind(sent, failed, gone, cursor, b.id)
    .run();

  return {
    done: false,
    sent: b.sent + sent,
    failed: b.failed + failed,
    gone: b.gone + gone,
    target: b.target,
  };
}

/* ===================== admin: numbers ===================== */

export async function audience(env) {
  const empty = { subscribers: 0, countries: [], installs7: 0, installs30: 0, opens7: 0, shares7: 0, recent: [] };
  if (!env.STATS) return empty;
  try {
    await init(env);
    const d7 = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
    const one = async (sql, ...b) => ((await env.STATS.prepare(sql).bind(...b).first()) || {}).n || 0;

    return {
      subscribers: await one("SELECT COUNT(*) n FROM subs WHERE active=1"),
      countries:
        (await env.STATS.prepare("SELECT country, COUNT(*) n FROM subs WHERE active=1 AND country!='' GROUP BY country ORDER BY n DESC LIMIT 10").all())
          .results || [],
      installs7: await one("SELECT COUNT(*) n FROM events WHERE kind='install' AND day>=?", d7),
      installs30: await one("SELECT COUNT(*) n FROM events WHERE kind='install' AND day>=?", d30),
      opens7: await one("SELECT COUNT(*) n FROM events WHERE kind='app_open' AND day>=?", d7),
      shares7: await one("SELECT COUNT(*) n FROM events WHERE kind='share_in' AND day>=?", d7),
      recent:
        (await env.STATS.prepare("SELECT id, created, title, image, countries, target, sent, failed, gone, clicks, done FROM broadcasts ORDER BY id DESC LIMIT 10").all())
          .results || [],
    };
  } catch (_) {
    return empty;
  }
}
