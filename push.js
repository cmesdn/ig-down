/**
 * push.js — Web Push for the admin app.
 *
 * Payload-free ("tickle") push: the Worker only pokes the browser, and the
 * service worker then fetches the real status itself. That skips the whole
 * aes128gcm payload-encryption dance and is far less fragile, while still
 * waking the phone with a vibration when the app is closed.
 */

const SUBS_KEY = "pushsubs";
const VAPID_KEY = "vapid";
const STATE_KEY = "alertstate";

/* ===================== VAPID keys ===================== */

export async function getVapid(env) {
  let v = null;
  try {
    const raw = await env.CONFIG.get(VAPID_KEY);
    if (raw) v = JSON.parse(raw);
  } catch (_) {}
  if (v && v.publicKey && v.privateJwk) return v;

  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  v = { publicKey: b64u(rawPub), privateJwk: privJwk };
  await env.CONFIG.put(VAPID_KEY, JSON.stringify(v));
  return v;
}

async function jwt(audience, vapid, subject) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject || "mailto:admin@example.com" };
  const data = b64u(enc(JSON.stringify(header))) + "." + b64u(enc(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc(data));
  return data + "." + b64u(new Uint8Array(sig));
}

/* ===================== subscriptions ===================== */

export async function getSubs(env) {
  try {
    const raw = await env.CONFIG.get(SUBS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function addSub(env, sub, ua) {
  const list = await getSubs(env);
  if (!sub || !sub.endpoint) throw new Error("bad subscription");
  if (list.some((s) => s.endpoint === sub.endpoint)) return list.length;
  list.push({ endpoint: sub.endpoint, ua: (ua || "").slice(0, 80), added: Date.now() });
  if (list.length > 10) list.splice(0, list.length - 10);
  await env.CONFIG.put(SUBS_KEY, JSON.stringify(list));
  return list.length;
}

export async function removeSub(env, endpoint) {
  const list = (await getSubs(env)).filter((s) => s.endpoint !== endpoint);
  await env.CONFIG.put(SUBS_KEY, JSON.stringify(list));
  return list.length;
}

export async function clearSubs(env) {
  await env.CONFIG.put(SUBS_KEY, "[]");
}

/* ===================== sending ===================== */

export async function pushAll(env, subject) {
  const subs = await getSubs(env);
  if (!subs.length) return { sent: 0, failed: 0, gone: 0 };
  const vapid = await getVapid(env);
  let sent = 0, failed = 0, gone = 0;
  const dead = [];

  for (const s of subs) {
    try {
      const u = new URL(s.endpoint);
      const token = await jwt(u.origin, vapid, subject);
      const r = await fetch(s.endpoint, {
        method: "POST",
        headers: {
          TTL: "300",
          Urgency: "high",
          "Content-Length": "0",
          Authorization: "vapid t=" + token + ", k=" + vapid.publicKey,
        },
      });
      if (r.status === 404 || r.status === 410) { gone++; dead.push(s.endpoint); }
      else if (r.ok || r.status === 201 || r.status === 202) sent++;
      else failed++;
    } catch (_) {
      failed++;
    }
  }
  if (dead.length) {
    const keep = subs.filter((s) => !dead.includes(s.endpoint));
    await env.CONFIG.put(SUBS_KEY, JSON.stringify(keep));
  }
  return { sent, failed, gone };
}

/**
 * Only push when the situation actually changes, or after a quiet period,
 * so a long outage does not buzz the phone every half hour.
 */
export async function pushIfChanged(env, level, note, repeatMinutes) {
  let prev = { level: "ok", at: 0 };
  try {
    const raw = await env.CONFIG.get(STATE_KEY);
    if (raw) prev = JSON.parse(raw);
  } catch (_) {}

  const now = Date.now();
  const changed = prev.level !== level;
  const stale = now - (prev.at || 0) > (repeatMinutes || 180) * 60_000;
  const shouldPush = level !== "ok" && (changed || stale);
  const recovered = level === "ok" && prev.level !== "ok";

  if (shouldPush || recovered) {
    await env.CONFIG.put(STATE_KEY, JSON.stringify({ level, at: now, note: note || "" }));
    const res = await pushAll(env);
    return Object.assign({ pushed: true, level, recovered }, res);
  }
  if (changed) await env.CONFIG.put(STATE_KEY, JSON.stringify({ level, at: prev.at || now, note: note || "" }));
  return { pushed: false, level };
}

export async function getAlertState(env) {
  try {
    const raw = await env.CONFIG.get(STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { level: "ok", at: 0, note: "" };
}

/* ===================== helpers ===================== */

function enc(s) { return new TextEncoder().encode(s); }
function b64u(buf) {
  let s = "";
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
