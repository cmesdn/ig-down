/**
 * monitor.js — live status, plain-language diagnostics, alert rules.
 *
 * Everything here is written so the admin never has to read an error code:
 * each result is turned into "what happened / what it means / what to do".
 */

import { getConfig, getCookies, getStats } from "./store.js";
import { diagnose, resolveMedia, shortcode } from "./resolve.js";
import { getAlertState, getSubs } from "./push.js";

/* ===================== status ===================== */

/**
 * level: "ok"   — at least two healthy cookies, things are fine
 *        "warn" — only one cookie left, or success rate sagging
 *        "down" — no cookie can reach Instagram
 */
export async function siteStatus(env) {
  const cfg = await getConfig(env);
  const cookies = await getCookies(env);
  const stats = await getStats(env);
  const alert = await getAlertState(env);
  const subs = await getSubs(env);

  const live = cookies.filter((c) => c.status === "ok").length;
  const warn = cookies.filter((c) => c.status === "warn").length;
  const dead = cookies.filter((c) => c.status === "dead").length;
  const usable = live + warn;

  let level = "ok";
  if (!cookies.length || usable === 0) level = "down";
  else if (usable === 1) level = "warn";
  else if (stats.rate && stats.rate < 50 && stats.week > 20) level = "warn";

  if (cfg.settings.maintenance) level = "warn";

  return {
    level,
    maintenance: !!cfg.settings.maintenance,
    cookies: {
      total: cookies.length,
      live,
      warn,
      dead,
      items: cookies.map((c) => ({
        label: c.label,
        status: c.status,
        uses: c.uses || 0,
        lastOk: c.lastOk || 0,
        note: c.lastError || "",
      })),
    },
    stats: { today: stats.today, week: stats.week, rate: stats.rate },
    fallbacks: { anonymous: true, externalApi: !!(cfg.settings.apiTemplate || "").trim(), proxy: !!(cfg.settings.proxyTemplate || "").trim() },
    alerts: cfg.alerts,
    push: { devices: subs.length, lastLevel: alert.level, lastAt: alert.at || 0 },
    at: Date.now(),
  };
}

export function statusLine(st, lang) {
  const bn = lang === "bn";
  if (st.level === "down")
    return bn
      ? { title: "সাইট ডাউনলোড করতে পারছে না", body: "কোনো কুকি Instagram-এ পৌঁছাতে পারছে না। এখনই একটা নতুন sessionid যোগ করুন।" }
      : { title: "Downloads are failing", body: "No cookie can reach Instagram. Add a fresh sessionid now." };
  if (st.maintenance)
    return bn
      ? { title: "মেইনটেন্যান্স মোড চালু", body: "ভিজিটররা টুল ব্যবহার করতে পারছে না। সেটিংস থেকে বন্ধ করুন।" }
      : { title: "Maintenance mode is on", body: "Visitors cannot use the tool. Turn it off in Settings." };
  if (st.level === "warn") {
    const one = st.cookies.live + st.cookies.warn === 1;
    return bn
      ? {
          title: one ? "মাত্র একটা কুকি বাকি" : "সফলতার হার কমে গেছে",
          body: one
            ? "এটা মরে গেলে সাইট বন্ধ হয়ে যাবে। আজই আরেকটা যোগ করুন।"
            : "অনেক লিংক ব্যর্থ হচ্ছে। ডায়াগনস্টিক চালিয়ে দেখুন।",
        }
      : {
          title: one ? "Only one cookie left" : "Success rate has dropped",
          body: one ? "If it dies the site goes down. Add another today." : "Many links are failing. Run Diagnostics.",
        };
  }
  return bn
    ? { title: "সব ঠিক আছে", body: "সাইট স্বাভাবিকভাবে ডাউনলোড করছে।" }
    : { title: "Everything is fine", body: "The site is downloading normally." };
}

/* ===================== plain-language diagnostics ===================== */

const RULES = [
  {
    test: /\b401\b|\b403\b|login wall|checkpoint|challenge|not authorized/i,
    bn: ["কুকি গ্রহণ করেনি", "Instagram এই অ্যাকাউন্টটাকে ঢুকতে দেয়নি। কুকির মেয়াদ শেষ হয়ে গেছে, অথবা অ্যাকাউন্টে verification চাওয়া হচ্ছে।", "কুকি ট্যাবে গিয়ে নতুন একটা sessionid যোগ করুন, আর এটা মুছে দিন।"],
    en: ["Cookie rejected", "Instagram refused this account. The cookie has expired, or the account is being asked to verify itself.", "Add a fresh sessionid in the Cookies tab and delete this one."],
    kind: "auth",
  },
  {
    test: /\b429\b|please wait|rate limit/i,
    bn: ["অতিরিক্ত ব্যবহার", "এই অ্যাকাউন্ট দিয়ে খুব বেশি রিকোয়েস্ট গেছে, তাই Instagram কিছুক্ষণের জন্য থামিয়ে দিয়েছে। কুকি নষ্ট হয়নি।", "আরও কুকি যোগ করুন, আর সেটিংসে ক্যাশ সময় বাড়িয়ে দিন। কয়েক ঘণ্টায় নিজেই ঠিক হয়ে যাবে।"],
    en: ["Too many requests", "This account sent too many requests, so Instagram paused it for a while. The cookie is not broken.", "Add more cookies and raise the cache duration in Settings. It clears itself within hours."],
    kind: "auth",
  },
  {
    test: /\b400\b|\b404\b|no items|no media node|not found.*media/i,
    bn: ["পোস্টটা পাওয়া যায়নি", "Instagram বলছে এই পোস্ট নেই। সাধারণত এর মানে পোস্টটা মুছে ফেলা হয়েছে, অথবা অ্যাকাউন্টটা প্রাইভেট।", "কিছু করার নেই — আপনার সাইট ঠিক আছে। অন্য একটা পাবলিক রিল দিয়ে পরীক্ষা করুন।"],
    en: ["Post not found", "Instagram says this post does not exist. Usually that means it was deleted, or the account is private.", "Nothing to fix — your site is fine. Try another public reel."],
    kind: "post",
  },
  {
    test: /bad shortcode/i,
    bn: ["এটা পোস্টের লিংক না", "যে লিংক দিয়েছেন সেটা কোনো রিল বা পোস্টের লিংক নয় — হয়তো প্রোফাইলের লিংক।", "Instagram অ্যাপে পোস্ট খুলে Share → Copy link দিয়ে লিংক নিন।"],
    en: ["Not a post link", "The link is not a reel or post — it may be a profile link.", "Open the post in Instagram, tap Share, then Copy link."],
    kind: "post",
  },
  {
    test: /video_url not found|og:video not found|empty/i,
    bn: ["এই পদ্ধতিতে পাওয়া যায়নি", "এটা স্বাভাবিক। এই পদ্ধতিটা দুর্বল, তাই প্রায়ই খালি ফেরত আসে। সাইট তখন পরের পদ্ধতি চেষ্টা করে।", "উপরের mobile-api সারিতে সবুজ থাকলে কিছু করার নেই।"],
    en: ["This route found nothing", "That is normal. This is a weaker route and often comes back empty; the site then tries the next one.", "If the mobile-api row above is green, nothing needs doing."],
    kind: "soft",
  },
  {
    test: /non-json|api http|no external api|no media url/i,
    bn: ["বাইরের API সাড়া দেয়নি", "শেষ-ভরসার API কাজ করেনি বা সেট করা নেই।", "সেটিংসে API টেমপ্লেট আর কী ঠিক আছে কিনা দেখুন। সেট না করে থাকলে এটা উপেক্ষা করুন।"],
    en: ["External API did not answer", "The last-resort API failed or is not configured.", "Check the API template and key in Settings. Ignore this if you never set one up."],
    kind: "soft",
  },
  {
    test: /fetch failed|network|timeout|tls|econn/i,
    bn: ["সংযোগ সমস্যা", "Instagram-এর সার্ভারে পৌঁছানো যায়নি। সাময়িক সমস্যা হতে পারে।", "এক-দুই মিনিট পর আবার চেষ্টা করুন।"],
    en: ["Connection problem", "Could not reach Instagram's servers. This is usually temporary.", "Try again in a minute or two."],
    kind: "soft",
  },
];

const METHOD_NAME = {
  viaMobileApi: { bn: "প্রধান পদ্ধতি (সবচেয়ে ভালো)", en: "Main route (best quality)" },
  viaGraphQL: { bn: "দ্বিতীয় পদ্ধতি", en: "Second route" },
  viaEmbed: { bn: "তৃতীয় পদ্ধতি", en: "Third route" },
  viaOgTag: { bn: "চতুর্থ পদ্ধতি", en: "Fourth route" },
  "external-api": { bn: "বাইরের API", en: "External API" },
};

export function explainRow(row, lang) {
  const bn = lang === "bn";
  if (row.ok)
    return {
      kind: "ok",
      head: bn ? "কাজ করছে" : "Working",
      why: bn ? `${row.items}টা ফাইল পাওয়া গেছে, ${row.ms} মিলিসেকেন্ডে।` : `Found ${row.items} file(s) in ${row.ms} ms.`,
      fix: "",
    };
  const r = RULES.find((x) => x.test.test(row.error || "")) || {
    bn: ["অজানা সমস্যা", "এই ভুলটা চেনা যায়নি।", "অন্য একটা লিংক দিয়ে পরীক্ষা করুন।"],
    en: ["Unknown problem", "This error was not recognised.", "Try testing with a different link."],
    kind: "soft",
  };
  const t = bn ? r.bn : r.en;
  return { kind: r.kind, head: t[0], why: t[1], fix: t[2] };
}

export function methodLabel(name, lang) {
  const m = METHOD_NAME[name];
  return m ? (lang === "bn" ? m.bn : m.en) : name;
}

/** Overall verdict for a whole diagnostics run */
export function verdict(rows, lang) {
  const bn = lang === "bn";
  const anyOk = rows.some((r) => r.ok);
  const kinds = rows.filter((r) => !r.ok).map((r) => explainRow(r, lang).kind);
  const authCount = kinds.filter((k) => k === "auth").length;
  const postCount = kinds.filter((k) => k === "post").length;

  if (anyOk)
    return {
      tone: "ok",
      head: bn ? "এই লিংকটা ঠিকমতো ডাউনলোড হবে" : "This link will download fine",
      body: bn
        ? "অন্তত একটা পদ্ধতি সফল হয়েছে, তাই ইউজাররা এই রিলটা পাবে। নিচে লাল সারি থাকলেও চিন্তার কিছু নেই — সাইট একটার পর একটা পদ্ধতি চেষ্টা করে, প্রথমটা সফল হলেই থেমে যায়।"
        : "At least one route succeeded, so visitors will get this reel. Red rows below are fine — the site tries routes in order and stops at the first success.",
    };
  if (authCount >= 2)
    return {
      tone: "bad",
      head: bn ? "কুকি বদলাতে হবে" : "Cookies need replacing",
      body: bn
        ? "Instagram আপনার অ্যাকাউন্টগুলোকে ঢুকতে দিচ্ছে না। কুকি ট্যাবে গিয়ে একটা নতুন sessionid যোগ করুন — এটাই একমাত্র সমাধান।"
        : "Instagram is refusing your accounts. Go to the Cookies tab and add a fresh sessionid — that is the only fix.",
    };
  if (postCount >= 2)
    return {
      tone: "mid",
      head: bn ? "সাইট ঠিক আছে, পোস্টটাই সমস্যা" : "Your site is fine, the post is the problem",
      body: bn
        ? "এই নির্দিষ্ট পোস্টটা মুছে ফেলা হয়েছে বা প্রাইভেট অ্যাকাউন্টের। অন্য একটা পাবলিক রিল দিয়ে পরীক্ষা করে দেখুন — ওটা কাজ করলে কিছু ঠিক করার নেই।"
        : "This particular post is deleted or belongs to a private account. Test a different public reel — if that works, nothing needs fixing.",
    };
  return {
    tone: "mid",
    head: bn ? "কিছু একটা আটকে আছে" : "Something is blocking this",
    body: bn
      ? "কোনো পদ্ধতিই সফল হয়নি, কিন্তু কারণটা পরিষ্কার না। নিচের সারিগুলো পড়ুন, আর অন্য একটা রিল দিয়েও পরীক্ষা করুন।"
      : "No route succeeded and the cause is not obvious. Read the rows below, and try a second reel as well.",
  };
}

/* ===================== one-shot "is it working now?" ===================== */

export async function quickCheck(url, env, lang) {
  const bn = lang === "bn";
  const code = shortcode(url || "");
  if (!code)
    return {
      tone: "mid",
      head: bn ? "লিংকটা ঠিক নয়" : "That link is not right",
      body: bn ? "Instagram অ্যাপে পোস্ট খুলে Share → Copy link দিয়ে লিংকটা নিন।" : "Open the post in Instagram, tap Share, then Copy link.",
    };
  const t0 = Date.now();
  try {
    const d = await resolveMedia(code, env, null, { noCache: true });
    const ms = Date.now() - t0;
    const it = d.items[0];
    return {
      tone: "ok",
      head: bn ? "হ্যাঁ, এখন ঠিক আছে" : "Yes, it is working now",
      body: bn
        ? `${ms} মিলিসেকেন্ডে ${d.items.length}টা ফাইল পাওয়া গেছে${it && it.quality ? `, কোয়ালিটি ${it.quality}` : ""}${d.username ? `, @${d.username}-এর পোস্ট` : ""}। ইউজাররা এটা ডাউনলোড করতে পারবে।`
        : `Found ${d.items.length} file(s) in ${ms} ms${it && it.quality ? `, quality ${it.quality}` : ""}${d.username ? `, posted by @${d.username}` : ""}. Visitors can download this.`,
      via: d.via,
    };
  } catch (e) {
    const rows = [{ ok: false, error: (e && e.message) || String(e) }];
    const v = verdict(rows, lang);
    const ex = explainRow(rows[0], lang);
    return { tone: v.tone === "ok" ? "mid" : v.tone, head: v.head, body: ex.why + (ex.fix ? " " + ex.fix : "") };
  }
}

export async function fullDiagnose(url, env, lang) {
  const code = shortcode(url || "");
  if (!code) return { error: lang === "bn" ? "এটা Instagram পোস্টের লিংক নয়।" : "That is not an Instagram post link." };
  const rows = await diagnose(code, env);
  return {
    code,
    verdict: verdict(rows, lang),
    rows: rows.map((r) => Object.assign({}, r, { label: methodLabel(r.method, lang), plain: explainRow(r, lang) })),
  };
}
