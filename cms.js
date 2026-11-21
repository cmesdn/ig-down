/**
 * cms.js — the parts of the admin panel that edit the site's words:
 *   • Blog: write, edit, schedule as draft, publish, delete
 *   • Pages: About / Contact / Privacy / Terms / DMCA
 *   • Tool pages: title, description, intro and FAQ
 *   • Messages: everything sent through the contact form
 */

import { md, listPosts, getPost, savePost, deletePost, getPage, savePage, resetPage, PAGE_KEYS, getToolText, saveToolText, slugOf, words } from "./content.js";
import { getConfig, saveConfig, notify } from "./store.js";
import { pushAll } from "./push.js";
import { TOOLS, esc } from "./pages.js";
import { pingIndexNow } from "./indexnow.js";

/* ===================== contact messages (D1) ===================== */

let ready = false;
async function init(env) {
  if (ready) return;
  await env.STATS.exec(
    "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, name TEXT, email TEXT, topic TEXT, body TEXT, country TEXT, iph TEXT, status TEXT DEFAULT 'new')"
  );
  await env.STATS.exec("CREATE INDEX IF NOT EXISTS messages_ts ON messages(ts)");
  ready = true;
}

async function hashIp(ip) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("igto-msg:" + ip));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}

const TOPICS = ["General question", "Bug report", "Business / advertising", "Copyright (DMCA)", "Feature request"];

/** POST /api/contact from the public site. */
export async function handleContact(request, env, ctx) {
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (request.method !== "POST") return j({ error: "POST only" }, 405);
  const b = await request.json().catch(() => null);
  if (!b) return j({ error: "Bad request." }, 400);
  // bots: the hidden field is filled, or the form was sent faster than a person can type
  if (b.website) return j({ ok: true });
  const t = +b.t || 0;
  if (t && Date.now() - t < 3000) return j({ ok: true });

  const name = String(b.name || "").trim().slice(0, 80);
  const email = String(b.email || "").trim().slice(0, 120);
  const msg = String(b.msg || "").trim().slice(0, 4000);
  const topic = TOPICS.includes(b.topic) ? b.topic : TOPICS[0];
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || msg.length < 10)
    return j({ error: "Please fill in your name, a valid email and a message of at least 10 characters." }, 400);
  if ((msg.match(/https?:\/\//g) || []).length > 4) return j({ error: "Too many links in the message." }, 400);

  await init(env);
  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const iph = await hashIp(ip);
  const hourAgo = Date.now() - 3600_000;
  const mine = await env.STATS.prepare("SELECT COUNT(*) n FROM messages WHERE iph=? AND ts>?").bind(iph, hourAgo).first();
  if (mine && mine.n >= 3) return j({ error: "You have sent several messages already. Please wait a while before sending another." }, 429);
  const day = await env.STATS.prepare("SELECT COUNT(*) n FROM messages WHERE ts>?").bind(Date.now() - 86400_000).first();
  if (day && day.n >= 300) return j({ error: "We are receiving a lot of messages right now. Please try again tomorrow." }, 429);

  const country = request.headers.get("CF-IPCountry") || "";
  const r = await env.STATS.prepare("INSERT INTO messages (ts,name,email,topic,body,country,iph,status) VALUES (?,?,?,?,?,?,?,'new')")
    .bind(Date.now(), name, email, topic, msg, country, iph).run();

  // wake the admin phone (at most once every 2 minutes) and Telegram, if set up
  ctx.waitUntil((async () => {
    try {
      const prev = JSON.parse((await env.CONFIG.get("msgping")) || "null");
      if (!prev || Date.now() - prev.at > 120_000) {
        await env.CONFIG.put("msgping", JSON.stringify({ id: r.meta.last_row_id, at: Date.now() }));
        await pushAll(env);
      }
    } catch (_) {}
    await notify(env, "✉️ New message (" + topic + ") from " + name + " <" + email + ">\n\n" + msg.slice(0, 600));
  })());
  return j({ ok: true });
}

/** Small summary for the status API: unread count and the newest message. */
export async function inbox(env) {
  try {
    await init(env);
    const u = await env.STATS.prepare("SELECT COUNT(*) n FROM messages WHERE status='new'").first();
    const last = await env.STATS.prepare("SELECT id,ts,name,topic,body FROM messages ORDER BY id DESC LIMIT 1").first();
    let ping = null;
    try { ping = JSON.parse((await env.CONFIG.get("msgping")) || "null"); } catch (_) {}
    return {
      unread: (u && u.n) || 0,
      lastMsg: last ? { id: last.id, ts: last.ts, name: last.name, topic: last.topic, snippet: String(last.body).slice(0, 120) } : null,
      ping: ping && Date.now() - ping.at < 180_000 ? ping : null,
    };
  } catch (_) {
    return { unread: 0, lastMsg: null, ping: null };
  }
}

export async function clearMessages(env) {
  await init(env);
  await env.STATS.exec("DELETE FROM messages");
}

/* ===================== admin JSON api ===================== */

const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function cmsApi(api, request, url, env, lang) {
  const bn = lang !== "en";
  const body = async () => (request.method === "POST" ? await request.json().catch(() => ({})) : {});
  switch (api) {
    case "cms_posts": {
      let last = null;
      try { last = JSON.parse((await env.CONFIG.get("indexnow_last")) || "null"); } catch (_) {}
      return j({ posts: await listPosts(env, true), indexnow: last });
    }
    case "cms_post": {
      const p = await getPost(env, url.searchParams.get("slug") || "", true);
      return p ? j({ post: p }) : j({ error: "not found" }, 404);
    }
    case "cms_save": {
      const b = await body();
      try {
        const p = await savePost(env, b.post || {}, b.orig || "");
        const idx = p.status === "published" ? await pingIndexNow(env, ["/blog/" + p.slug, "/blog"]) : null;
        return j({ ok: true, post: p, indexnow: idx });
      } catch (e) {
        const why = String(e.message);
        const m = why === "exists" ? (bn ? "এই URL-এ আগেই একটা পোস্ট আছে। URL বদলান।" : "A post already uses this URL. Change the URL.")
          : why === "title" ? (bn ? "শিরোনাম দিন।" : "Add a title.")
          : (bn ? "URL ঠিক নেই — ইংরেজি অক্ষর, সংখ্যা আর - দিন।" : "Invalid URL — use English letters, numbers and dashes.");
        return j({ error: m }, 400);
      }
    }
    case "cms_del": {
      const b = await body();
      if (!b.slug) return j({ error: "slug" }, 400);
      await deletePost(env, b.slug);
      return j({ ok: true });
    }
    case "cms_md": {
      const b = await body();
      return j({ html: md(b.md || ""), words: words(b.md || ""), slug: slugOf(b.title || "") });
    }
    case "cms_pages":
      return j({ pages: await Promise.all(PAGE_KEYS.map((k) => getPage(env, k))) });
    case "cms_page_save": {
      const b = await body();
      if (!PAGE_KEYS.includes(b.key)) return j({ error: "page" }, 400);
      if (b.reset) await resetPage(env, b.key);
      else await savePage(env, b.key, b);
      const idx = await pingIndexNow(env, ["/" + b.key]);
      return j({ ok: true, page: await getPage(env, b.key), indexnow: idx });
    }
    case "cms_tools": {
      const ov = await getToolText(env);
      return j({
        tools: Object.values(TOOLS).map((t) => {
          const o = ov[t.slug] || {};
          return { slug: t.slug, custom: !!ov[t.slug], title: o.title || t.title, desc: o.desc || t.desc, h1: o.h1 || t.h1, intro: o.intro || t.intro, faq: o.faq && o.faq.length ? o.faq : t.faq };
        }),
      });
    }
    case "cms_tool_save": {
      const b = await body();
      if (!Object.values(TOOLS).some((t) => t.slug === b.slug)) return j({ error: "tool" }, 400);
      await saveToolText(env, b.slug, b.reset ? null : b);
      const idx = await pingIndexNow(env, ["/" + b.slug]);
      return j({ ok: true, indexnow: idx });
    }
    case "msg_list": {
      await init(env);
      const f = url.searchParams.get("f") || "all";
      const where = f === "new" ? "WHERE status='new'" : f === "done" ? "WHERE status='done'" : "";
      const r = await env.STATS.prepare(`SELECT id,ts,name,email,topic,body,country,status FROM messages ${where} ORDER BY id DESC LIMIT 200`).all();
      const c = await env.STATS.prepare("SELECT status, COUNT(*) n FROM messages GROUP BY status").all();
      const counts = { new: 0, read: 0, done: 0 };
      for (const x of c.results || []) counts[x.status] = x.n;
      const cfg = await getConfig(env);
      return j({ items: r.results || [], counts, email: cfg.settings.contactEmail || "" });
    }
    case "msg_mark": {
      const b = await body();
      await init(env);
      if (!["new", "read", "done"].includes(b.status)) return j({ error: "status" }, 400);
      await env.STATS.prepare("UPDATE messages SET status=? WHERE id=?").bind(b.status, +b.id || 0).run();
      return j({ ok: true });
    }
    case "msg_del": {
      const b = await body();
      await init(env);
      await env.STATS.prepare("DELETE FROM messages WHERE id=?").bind(+b.id || 0).run();
      return j({ ok: true });
    }
    case "msg_email": {
      const b = await body();
      const e = String(b.email || "").trim();
      if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return j({ error: bn ? "ইমেইল ঠিক নেই।" : "That email does not look right." }, 400);
      const cfg = await getConfig(env);
      cfg.settings.contactEmail = e;
      await saveConfig(env, cfg);
      return j({ ok: true });
    }
  }
  return null;
}

/* ===================== admin tabs (HTML) ===================== */

const S = {
  bn: {
    posts: "পোস্ট", pages: "পেজ", tools: "টুল পেজ",
    newpost: "+ নতুন পোস্ট", loading: "লোড হচ্ছে…",
    howto: "কিভাবে পোস্ট লিখবেন",
    howtoBody: `<ol>
<li><b>নতুন পোস্ট</b> চাপুন। শিরোনাম লিখলে URL নিজে থেকে তৈরি হবে।</li>
<li><b>ডেসক্রিপশন</b> ১২০–১৬০ অক্ষরের দিন — Google সার্চে এটাই দেখায়।</li>
<li>লেখায় উপরের বাটন দিয়ে হেডিং (H2), বোল্ড, লিস্ট, লিংক, ছবি দিন। প্রতিটা বড় অংশের শুরুতে H2 দিন।</li>
<li><b>প্রিভিউ</b> দেখে নিন, তারপর <b>পাবলিশ</b>। পরে লিখতে চাইলে <b>ড্রাফট সেভ</b>।</li>
<li>পাবলিশ করলে sitemap নিজে আপডেট হয়; সাইটে ১–২ মিনিটের মধ্যে দেখা যায়।</li>
</ol><p class="dim">টিপস: একটা পোস্ট = একটা প্রশ্নের পূর্ণ উত্তর। ৮০০+ শব্দ, ৪–৬টা H2, অন্তত ২টা ভেতরের লিংক (যেমন /reels বা অন্য পোস্ট)। লেখা ইংরেজিতে রাখুন, কারণ সাইট ইংরেজি।</p>`,
    title: "শিরোনাম (Title)", url: "URL", desc: "ডেসক্রিপশন (Google-এ দেখায়)", kw: "কীওয়ার্ড (কমা দিয়ে, ঐচ্ছিক)",
    cover: "কভার ছবি (ঐচ্ছিক)", upload: "ছবি আপলোড", remove: "সরান", date: "তারিখ", body: "লেখা",
    write: "লিখুন", preview: "প্রিভিউ", draft: "ড্রাফট সেভ", publish: "পাবলিশ", update: "আপডেট করুন", cancel: "বাতিল", back: "← সব পোস্ট",
    view: "দেখুন", edit: "এডিট", del: "মুছুন", sure: "পোস্টটা পুরোপুরি মুছে যাবে। নিশ্চিত?",
    published: "লাইভ", drafted: "ড্রাফট", saved: "সেভ হয়েছে ✓", savedLive: "পাবলিশ হয়েছে ✓ সাইটে ১–২ মিনিটে দেখা যাবে।",
    unsaved: "সেভ না করা পরিবর্তন আছে। তবুও বের হবেন?",
    seo: "SEO চেকলিস্ট", words: "শব্দ", min: "মিনিট পড়া",
    c_title: "শিরোনাম ৩০–৬৫ অক্ষর", c_desc: "ডেসক্রিপশন ১২০–১৬০ অক্ষর", c_words: "অন্তত ৬০০ শব্দ", c_h2: "অন্তত ৩টা H2 হেডিং", c_link: "অন্তত ১টা ভেতরের লিংক", c_img: "কভার ছবি আছে",
    pageHint: "About, Contact, Privacy, Terms আর DMCA পেজের লেখা এখান থেকে বদলান। “আগের লেখা ফেরত” দিলে আসল লেখায় ফিরে যাবে।",
    reset: "আগের লেখা ফেরত", resetSure: "আপনার বদলানো লেখা মুছে আসল লেখা ফিরবে। নিশ্চিত?", custom: "বদলানো", orig: "আসল",
    toolHint: "প্রতিটা ডাউনলোড পেজের Google টাইটেল, ডেসক্রিপশন, বড় শিরোনাম, পরিচিতি আর FAQ বদলান। FAQ লিখুন এভাবে — প্রতিটা প্রশ্নের আগে “Q:” আর উত্তরের আগে “A:”।",
    h1: "বড় শিরোনাম (H1)", intro: "পরিচিতি লেখা", faq: "প্রশ্ন-উত্তর (FAQ)", save: "সেভ",
    msgs: "মেসেজ", m_all: "সব", m_new: "নতুন", m_done: "সমাধান হয়েছে", m_none: "কোনো মেসেজ নেই।",
    reply: "ইমেইলে উত্তর", markDone: "সমাধান ✓", markNew: "আবার নতুন", m_del: "মুছুন", m_sure: "মেসেজটা মুছে ফেলবেন?",
    emailT: "সাইটে দেখানো ইমেইল", emailHint: "Contact পেজে এই ঠিকানা দেখাবে। Cloudflare Email Routing চালু করার পর এখানে লিখুন (যেমন contact@igtodownload.com)। ফাঁকা রাখলে শুধু ফর্ম দেখাবে।",
    msgHint: "সাইটের Contact ফর্ম থেকে আসা সব মেসেজ এখানে জমা হয়। নতুন মেসেজ এলে অ্যাপে নোটিফিকেশন যায়।",
    toolbar: { h2: "H2", h3: "H3", b: "B", i: "I", ul: "• লিস্ট", ol: "1. লিস্ট", q: "❝", a: "🔗 লিংক", img: "🖼 ছবি", hr: "—" },
    linkAsk: "লিংক দিন (যেমন /reels বা https://...)", linkText: "লিংকের লেখা",
    inOk: "Bing ও Yandex-কে জানানো হয়েছে ✓", inBad: "Bing/Yandex-কে জানানো যায়নি (পরে আবার চেষ্টা হবে)",
    inLast: "শেষবার Bing/Yandex-কে জানানো:", inNever: "এখনো কিছু পাবলিশ করে জানানো হয়নি",
    drafts: "সাপ্তাহিক ড্রাফট পড়ে পাবলিশ করুন", 
  },
  en: {
    posts: "Posts", pages: "Pages", tools: "Tool pages",
    newpost: "+ New post", loading: "Loading…",
    howto: "How to write a post",
    howtoBody: `<ol>
<li>Tap <b>New post</b>. The URL is created from the title automatically.</li>
<li>Write a <b>description</b> of 120–160 characters — Google shows it in results.</li>
<li>Use the buttons for headings (H2), bold, lists, links and pictures. Start each main section with an H2.</li>
<li>Check the <b>Preview</b>, then <b>Publish</b>. To finish later, <b>Save draft</b>.</li>
<li>Publishing updates the sitemap automatically; the post appears on the site within 1–2 minutes.</li>
</ol><p class="dim">Tip: one post = a complete answer to one question. 800+ words, 4–6 H2s, at least 2 internal links (e.g. /reels or another post).</p>`,
    title: "Title", url: "URL", desc: "Description (shown on Google)", kw: "Keywords (comma separated, optional)",
    cover: "Cover picture (optional)", upload: "Upload picture", remove: "Remove", date: "Date", body: "Text",
    write: "Write", preview: "Preview", draft: "Save draft", publish: "Publish", update: "Update", cancel: "Cancel", back: "← All posts",
    view: "View", edit: "Edit", del: "Delete", sure: "This post will be deleted for good. Sure?",
    published: "Live", drafted: "Draft", saved: "Saved ✓", savedLive: "Published ✓ It shows on the site within 1–2 minutes.",
    unsaved: "You have unsaved changes. Leave anyway?",
    seo: "SEO checklist", words: "words", min: "min read",
    c_title: "Title 30–65 characters", c_desc: "Description 120–160 characters", c_words: "At least 600 words", c_h2: "At least 3 H2 headings", c_link: "At least 1 internal link", c_img: "Has a cover picture",
    pageHint: "Change the text of About, Contact, Privacy, Terms and DMCA. “Restore original” brings the built-in text back.",
    reset: "Restore original", resetSure: "Your edits will be removed and the original text restored. Sure?", custom: "Edited", orig: "Original",
    toolHint: "Change each download page's Google title, description, main heading, intro and FAQ. Write the FAQ with “Q:” before each question and “A:” before each answer.",
    h1: "Main heading (H1)", intro: "Intro text", faq: "Questions (FAQ)", save: "Save",
    msgs: "Messages", m_all: "All", m_new: "New", m_done: "Solved", m_none: "No messages.",
    reply: "Reply by email", markDone: "Solved ✓", markNew: "Mark new", m_del: "Delete", m_sure: "Delete this message?",
    emailT: "Email shown on the site", emailHint: "Shown on the Contact page. Fill this in after setting up Cloudflare Email Routing (e.g. contact@igtodownload.com). Leave empty to show only the form.",
    msgHint: "Everything sent through the site's Contact form lands here. You get a notification in the app for new messages.",
    toolbar: { h2: "H2", h3: "H3", b: "B", i: "I", ul: "• List", ol: "1. List", q: "❝", a: "🔗 Link", img: "🖼 Picture", hr: "—" },
    linkAsk: "Link (e.g. /reels or https://...)", linkText: "Link text",
    inOk: "Bing & Yandex notified ✓", inBad: "Could not notify Bing/Yandex",
    inLast: "Last Bing/Yandex ping:", inNever: "Nothing published and pinged yet",
    drafts: "Review the weekly drafts and publish them", 
  },
};

export function blogTab(lang) {
  const s = S[lang] || S.bn;
  return `
<div class="seg" id="cmsSeg"><button data-v="posts" class="on">${s.posts}</button><button data-v="pages">${s.pages}</button><button data-v="tools">${s.tools}</button></div>
<div id="cmsView"><div class="box dim">${s.loading}</div></div>
<script>window.__CMS=${JSON.stringify(s).replace(/</g, "\\u003c")};window.__MD=${md.toString().replace(/<\/script/gi, "<\\/script")};</script>`;
}

export function msgsTab(lang) {
  const s = S[lang] || S.bn;
  return `
<div class="box">
  <p class="dim" style="margin:0 0 10px">${s.msgHint}</p>
  <div class="seg" id="msgSeg"><button data-f="new" class="on">${s.m_new} <b id="cNew"></b></button><button data-f="all">${s.m_all}</button><button data-f="done">${s.m_done}</button></div>
  <div id="msgList"><p class="dim">${s.loading}</p></div>
</div>
<div class="box">
  <h3>${s.emailT}</h3>
  <p class="dim">${s.emailHint}</p>
  <div class="row"><input id="cEmail" type="email" placeholder="contact@igtodownload.com" style="flex:1;min-width:200px"><button class="btn" id="cEmailSave">${s.save}</button></div>
  <p class="dim" id="cEmailOut"></p>
</div>
<script>window.__CMS=${JSON.stringify(s).replace(/</g, "\\u003c")};</script>`;
}

/* ===================== styles + client script ===================== */

export const CMS_CSS = `
.seg{display:flex;gap:6px;background:#101017;border:1px solid #23232c;border-radius:12px;padding:4px;margin-bottom:12px;overflow-x:auto;scrollbar-width:none}
.seg::-webkit-scrollbar{display:none}
.seg button{flex:1;white-space:nowrap;background:none;border:0;color:#9a9aa8;font:inherit;font-size:13.5px;font-weight:600;padding:9px 12px;border-radius:9px;cursor:pointer}
.seg button.on{background:#1f1f29;color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.05) inset}
.seg button b{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#f9377d;color:#fff;font-size:11px;margin-left:4px}
.seg button b:empty{display:none}
.plist{display:grid;gap:8px}
.pitem{display:grid;grid-template-columns:56px 1fr;gap:11px;align-items:center;background:#0f0f15;border:1px solid #23232c;border-radius:13px;padding:10px}
.pitem .th{width:56px;height:56px;border-radius:10px;background:#1b1b24 center/cover no-repeat;display:grid;place-items:center;color:#55556a;font-size:20px}
.pitem h4{font-size:14px;line-height:1.35;margin:0 0 3px;font-weight:650;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pitem .meta{font-size:12px;color:#8c8c9b;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pitem .acts{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
.pitem .acts a,.pitem .acts button{font:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:9px;background:#1b1b24;border:1px solid #2a2a34;color:#c9c9d4;text-decoration:none;cursor:pointer}
.pitem .acts .dz{color:#ff7aa5}
.st{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}
.st.live{background:rgba(43,217,124,.14);color:#2bd97c}.st.draft{background:rgba(255,184,0,.14);color:#ffb800}
.ed label{margin-top:12px}
.slugrow{display:flex;align-items:center;gap:0;background:#0d0d13;border:1px solid #26262f;border-radius:10px;overflow:hidden}
.slugrow span{padding:0 0 0 12px;color:#6f6f7d;font-size:13px;white-space:nowrap}
.slugrow input{border:0;background:none;padding-left:2px}
.cnt{float:right;font-weight:500;color:#8c8c9b}.cnt.good{color:#2bd97c}.cnt.bad{color:#ffb800}
.coverbox{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.coverbox img{width:120px;height:68px;object-fit:cover;border-radius:9px;border:1px solid #26262f}
.tbar{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding:6px;background:#101017;border:1px solid #26262f;border-bottom:0;border-radius:10px 10px 0 0;position:sticky;top:56px;z-index:5}
.tbar::-webkit-scrollbar{display:none}
.tbar button{flex:none;font:inherit;font-size:12.5px;font-weight:700;background:#1b1b24;border:1px solid #2a2a34;color:#d6d6e0;border-radius:8px;padding:7px 10px;cursor:pointer}
.tbar .sp{flex:1}
.tbar button.on{background:rgba(249,55,125,.16);border-color:rgba(249,55,125,.55);color:#fff}
textarea.mdbox{border-radius:0 0 10px 10px;font-family:inherit;font-size:15px;line-height:1.65;min-height:58vh;margin:0}
.mdprev{border:1px solid #26262f;border-radius:0 0 10px 10px;padding:16px;min-height:58vh;background:#fbfbfd;color:#14141a;font-size:15.5px;line-height:1.7}
.mdprev h2{font-size:21px;margin:22px 0 8px}.mdprev h3{font-size:17px;margin:18px 0 6px}.mdprev p{margin:0 0 13px;color:#3b3b48}
.mdprev ul,.mdprev ol{margin:0 0 14px 22px;color:#3b3b48}.mdprev a{color:#d1206c}
.mdprev img{max-width:100%;border-radius:12px}.mdprev blockquote{border-left:3px solid #d1206c;margin:0 0 14px;padding:8px 14px;background:#f1f1f6;border-radius:0 10px 10px 0}
.mdprev figcaption{font-size:13px;color:#6c6c7a;text-align:center}.mdprev h1{font-size:25px;margin:0 0 10px}
.edbar{position:sticky;bottom:0;background:rgba(11,11,17,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:10px 0 calc(10px + env(safe-area-inset-bottom));margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;z-index:6;border-top:1px solid #23232c}
.edbar .btn{flex:1;margin:0;min-width:110px}
.seo{display:grid;gap:5px;font-size:13px;margin-top:6px}
.seo div::before{content:"○ ";color:#6f6f7d}.seo .ok::before{content:"✓ ";color:#2bd97c}.seo .ok{color:#c9c9d4}.seo div{color:#8c8c9b}
.edout{font-size:13.5px;margin-top:8px;min-height:1em}
.msgi{background:#0f0f15;border:1px solid #23232c;border-radius:13px;padding:12px;margin-top:8px}
.msgi.new{border-color:rgba(249,55,125,.45)}
.msgi .hd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.msgi .hd b{font-size:14.5px}.msgi .hd span{font-size:12px;color:#8c8c9b}
.msgi .tp{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:#1f1f29;color:#c9c9d4;margin:6px 0}
.msgi .tx{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.55;color:#d6d6e0;margin:4px 0 10px}
.msgi .em{font-size:13px;color:#8c8c9b;word-break:break-all}
.msgi .acts{display:flex;gap:6px;flex-wrap:wrap}
.msgi .acts a,.msgi .acts button{font:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:9px;background:#1b1b24;border:1px solid #2a2a34;color:#c9c9d4;text-decoration:none;cursor:pointer}
.msgi .acts .pri{background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc);border:0;color:#fff}
.msgi .acts .dz{color:#ff7aa5}
.faqbox{font-family:inherit;font-size:14px;line-height:1.55;min-height:260px}
`;

export const CMS_JS = `
(function(){
var S=window.__CMS; if(!S) return;
function $(id){return document.getElementById(id)}
function h(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function api(name,data){
  var o=data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{};
  return fetch('/admin?api='+name,o).then(function(r){return r.json()});
}
function slugify(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)}
function wc(s){var p=String(s||'').replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g,'').replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g,'$1').replace(/[#>*\`_-]/g,' ').replace(/\\s+/g,' ').trim();return p?p.split(' ').length:0}
function seg(box,cb){box.querySelectorAll('button').forEach(function(b){b.onclick=function(){box.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});cb(b)}})}

/* shrink a picture on the phone, then store it for good */
function uploadPic(file,done,stat){
  var img=new Image(),u=URL.createObjectURL(file);
  stat&&(stat.textContent='…');
  img.onload=function(){
    var w=img.naturalWidth,hh=img.naturalHeight,max=1400;
    if(w>max){hh=Math.round(hh*max/w);w=max}
    var c=document.createElement('canvas');c.width=w;c.height=hh;c.getContext('2d').drawImage(img,0,0,w,hh);URL.revokeObjectURL(u);
    var q=0.85,d=c.toDataURL('image/jpeg',q);while(d.length>560000&&q>0.4){q-=0.1;d=c.toDataURL('image/jpeg',q)}
    api('nimg',{data:d,keep:true}).then(function(r){if(r.error){stat&&(stat.textContent=r.error);return}stat&&(stat.textContent='✓ '+Math.round(r.size/1024)+' KB');done(r.url)}).catch(function(){stat&&(stat.textContent='Upload failed')});
  };
  img.onerror=function(){stat&&(stat.textContent='?')};
  img.src=u;
}

/* ================= blog ================= */
var view=$('cmsView');
if(view){
  var dirty=false;
  window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=''}});
  seg($('cmsSeg'),function(b){ if(dirty&&!confirm(S.unsaved))return; dirty=false; ({posts:showList,pages:showPages,tools:showTools})[b.dataset.v](); });
  showList();
}

function showList(){
  view.innerHTML='<div class="box dim">'+S.loading+'</div>';
  api('cms_posts').then(function(d){
    var ps=d.posts||[];
    var nd=ps.filter(function(x){return x.status==='draft'}).length, il=d.indexnow;
    view.innerHTML='<div class="box"><div class="row" style="justify-content:space-between"><button class="btn" id="newPost">'+S.newpost+'</button><span class="dim">'+ps.length+'</span></div>'+
      (nd?'<p style="margin:10px 0 0;color:#ffb800;font-size:13.5px">✎ '+nd+' — '+S.drafts+'</p>':'')+
      '<p class="dim" style="margin:8px 0 0;font-size:12.5px">'+S.inLast+' '+(il?(il.ok?'✓ ':'⚠ ')+new Date(il.at).toLocaleString()+' ('+il.status+')':S.inNever)+'</p>'+
      '<details class="guide" style="margin-top:10px"><summary>'+S.howto+'</summary><div class="gbody">'+S.howtoBody+'</div></details></div>'+
      '<div class="plist">'+ps.map(function(p){
        return '<div class="pitem"><div class="th" style="'+(p.cover?'background-image:url('+h(p.cover)+')':'')+'">'+(p.cover?'':'✎')+'</div>'+
          '<div><h4>'+h(p.title)+'</h4><div class="meta"><span class="st '+(p.status==='draft'?'draft':'live')+'">'+(p.status==='draft'?S.drafted:S.published)+'</span><span>'+h(p.date)+'</span><span>'+(p.words||0)+' '+S.words+'</span></div></div>'+
          '<div class="acts"><button data-e="'+h(p.slug)+'">'+S.edit+'</button>'+(p.status==='draft'?'':'<a href="/blog/'+h(p.slug)+'" target="_blank">'+S.view+'</a>')+'<button class="dz" data-d="'+h(p.slug)+'">'+S.del+'</button></div></div>';
      }).join('')+'</div>';
    $('newPost').onclick=function(){editor(null)};
    view.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){b.textContent='…';api('cms_post&slug='+encodeURIComponent(b.dataset.e)).then(function(r){editor(r.post)})}});
    view.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){if(!confirm(S.sure))return;api('cms_del',{slug:b.dataset.d}).then(showList)}});
  });
}

function editor(p){
  var isNew=!p; p=p||{title:'',slug:'',desc:'',kw:'',cover:'',date:new Date().toISOString().slice(0,10),status:'draft',md:''};
  var slugTouched=!isNew;
  view.innerHTML='<div class="box ed">'+
    '<button class="btn ghost" id="edBack" style="margin:0 0 6px">'+S.back+'</button>'+
    '<label>'+S.title+' <span class="cnt" id="tCnt"></span></label><input id="eTitle" maxlength="140" value="'+h(p.title)+'">'+
    '<label>'+S.url+'</label><div class="slugrow"><span>/blog/</span><input id="eSlug" value="'+h(p.slug)+'"></div>'+
    '<label>'+S.desc+' <span class="cnt" id="dCnt"></span></label><textarea id="eDesc" rows="3" maxlength="300" style="font-family:inherit;font-size:14px">'+h(p.desc)+'</textarea>'+
    '<label>'+S.kw+'</label><input id="eKw" value="'+h(p.kw)+'">'+
    '<label>'+S.cover+'</label><div class="coverbox"><img id="cImg" '+(p.cover?'src="'+h(p.cover)+'"':'hidden')+' alt=""><label class="btn ghost" style="margin:0;display:inline-block;font-size:13px">'+S.upload+'<input type="file" accept="image/*" id="cFile" hidden></label><button class="btn ghost" id="cDel" style="margin:0" '+(p.cover?'':'hidden')+'>'+S.remove+'</button><span class="dim" id="cStat"></span></div>'+
    '<label>'+S.date+'</label><input id="eDate" type="date" value="'+h(p.date)+'" style="max-width:200px">'+
    '<label>'+S.body+' <span class="cnt" id="wCnt"></span></label>'+
    '<div class="tbar" id="tbar">'+
      ['h2','h3','b','i','ul','ol','q','a','img','hr'].map(function(k){return '<button type="button" data-t="'+k+'">'+S.toolbar[k]+'</button>'}).join('')+
      '<span class="sp"></span><button type="button" id="pvBtn">'+S.preview+'</button></div>'+
    '<textarea class="mdbox" id="eMd" spellcheck="true">'+h(p.md)+'</textarea><div class="mdprev" id="ePv" hidden></div>'+
    '<input type="file" accept="image/*" id="iFile" hidden>'+
    '<h3 style="margin-top:16px">'+S.seo+'</h3><div class="seo" id="seo"></div>'+
    '<div class="edout" id="edOut"></div>'+
    '<div class="edbar"><button class="btn ghost" id="eDraft">'+S.draft+'</button><button class="btn" id="ePub">'+(p.status==='published'&&!isNew?S.update:S.publish)+'</button></div>'+
  '</div>';
  var T=$('eTitle'),SL=$('eSlug'),D=$('eDesc'),M=$('eMd'),cover=p.cover||'';
  function mark(){dirty=true;check()}
  function check(){
    var tl=T.value.trim().length,dl=D.value.trim().length,w=wc(M.value),h2=(M.value.match(/^##\\s+\\S/gm)||[]).length,
        il=/\\]\\(\\/[^)]*\\)/.test(M.value);
    $('tCnt').textContent=tl;$('tCnt').className='cnt '+(tl>=30&&tl<=65?'good':'bad');
    $('dCnt').textContent=dl;$('dCnt').className='cnt '+(dl>=120&&dl<=160?'good':'bad');
    $('wCnt').textContent=w+' '+S.words+' · '+Math.max(1,Math.round(w/200))+' '+S.min;
    var c=[[tl>=30&&tl<=65,S.c_title],[dl>=120&&dl<=160,S.c_desc],[w>=600,S.c_words],[h2>=3,S.c_h2],[il,S.c_link],[!!cover,S.c_img]];
    $('seo').innerHTML=c.map(function(x){return '<div class="'+(x[0]?'ok':'')+'">'+x[1]+'</div>'}).join('');
  }
  T.oninput=function(){if(!slugTouched)SL.value=slugify(T.value);mark()};
  SL.oninput=function(){slugTouched=true;mark()};
  SL.onblur=function(){SL.value=slugify(SL.value)};
  [D,$('eKw'),$('eDate'),M].forEach(function(x){x.oninput=mark});
  check();

  function wrap(a,b,ph){
    var s=M.selectionStart,e=M.selectionEnd,v=M.value,sel=v.slice(s,e)||ph||'';
    M.value=v.slice(0,s)+a+sel+b+v.slice(e);M.focus();M.selectionStart=s+a.length;M.selectionEnd=s+a.length+sel.length;mark();
  }
  function line(prefix){
    var s=M.selectionStart,v=M.value,ls=v.lastIndexOf('\\n',s-1)+1;
    M.value=v.slice(0,ls)+prefix+v.slice(ls);M.focus();M.selectionStart=M.selectionEnd=s+prefix.length;mark();
  }
  function block(txt){
    var s=M.selectionStart,v=M.value,pre=(s>0&&v[s-1]!=='\\n'?'\\n\\n':(s>1&&v[s-2]!=='\\n'?'\\n':''));
    M.value=v.slice(0,s)+pre+txt+'\\n\\n'+v.slice(s);M.focus();M.selectionStart=M.selectionEnd=s+pre.length+txt.length+2;mark();
  }
  $('tbar').querySelectorAll('[data-t]').forEach(function(b){b.onmousedown=function(e){e.preventDefault()};b.onclick=function(){
    var k=b.dataset.t;
    if(k==='h2')line('## ');else if(k==='h3')line('### ');else if(k==='b')wrap('**','**','bold');else if(k==='i')wrap('*','*','italic');
    else if(k==='ul')line('- ');else if(k==='ol')line('1. ');else if(k==='q')line('> ');else if(k==='hr')block('---');
    else if(k==='a'){var u=prompt(S.linkAsk,'/');if(!u)return;var sel=M.value.slice(M.selectionStart,M.selectionEnd);if(!sel){sel=prompt(S.linkText,'')||u}
      var s=M.selectionStart,e=M.selectionEnd;M.value=M.value.slice(0,s)+'['+sel+']('+u.trim()+')'+M.value.slice(e);M.focus();mark()}
    else if(k==='img'){$('iFile').click()}
  }});
  $('iFile').onchange=function(){var f=this.files[0];if(!f)return;this.value='';var at=M.selectionStart;
    uploadPic(f,function(url){M.selectionStart=M.selectionEnd=at;var alt=prompt(S.linkText,'')||'';block('!['+alt.replace(/[\\[\\]]/g,'')+']('+url+')')},$('edOut'))};
  $('cFile').onchange=function(){var f=this.files[0];if(!f)return;this.value='';uploadPic(f,function(url){cover=url;$('cImg').src=url;$('cImg').hidden=false;$('cDel').hidden=false;mark()},$('cStat'))};
  $('cDel').onclick=function(){cover='';$('cImg').hidden=true;$('cDel').hidden=true;mark()};
  var pv=false;
  $('pvBtn').onclick=function(){pv=!pv;this.classList.toggle('on',pv);this.textContent=pv?S.write:S.preview;
    if(pv){$('ePv').innerHTML=(T.value?'<h1>'+h(T.value)+'</h1>':'')+(cover?'<img src="'+h(cover)+'" style="margin-bottom:14px">':'')+window.__MD(M.value)}
    $('ePv').hidden=!pv;M.hidden=pv;$('tbar').querySelectorAll('[data-t]').forEach(function(b){b.disabled=pv})};
  $('edBack').onclick=function(){if(dirty&&!confirm(S.unsaved))return;dirty=false;showList()};
  function save(status){
    var out=$('edOut');out.textContent='…';
    var post={title:T.value,slug:slugify(SL.value||T.value),desc:D.value,kw:$('eKw').value,cover:cover,date:$('eDate').value,status:status,md:M.value};
    api('cms_save',{post:post,orig:isNew?'':p.slug}).then(function(r){
      if(r.error){out.style.color='#ff7aa5';out.textContent=r.error;return}
      dirty=false;isNew=false;p=r.post;SL.value=p.slug;slugTouched=true;out.style.color='#2bd97c';
      out.innerHTML=status==='published'?S.savedLive+' <a href="/blog/'+h(p.slug)+'" target="_blank" style="color:#f9377d">'+S.view+' ↗</a>'+(r.indexnow?'<br><span style="color:'+(r.indexnow.ok?'#2bd97c':'#ffb800')+'">'+(r.indexnow.ok?S.inOk:S.inBad)+'</span>':''):S.saved;
      $('ePub').textContent=status==='published'?S.update:S.publish;
    }).catch(function(){out.style.color='#ff7aa5';out.textContent='Network error'});
  }
  $('eDraft').onclick=function(){save('draft')};
  $('ePub').onclick=function(){save('published')};
}

function showPages(){
  view.innerHTML='<div class="box dim">'+S.loading+'</div>';
  api('cms_pages').then(function(d){
    view.innerHTML='<div class="box"><p class="dim" style="margin:0">'+S.pageHint+'</p></div>'+d.pages.map(function(pg){
      return '<details class="box pgx" data-k="'+pg.key+'"><summary style="cursor:pointer;font-weight:700">'+h(pg.title)+' <span class="st '+(pg.custom?'draft':'live')+'">'+(pg.custom?S.custom:S.orig)+'</span></summary>'+
        '<label>'+S.title+'</label><input class="pT" value="'+h(pg.title)+'">'+
        '<label>'+S.desc+'</label><textarea class="pD" rows="2" style="font-family:inherit;font-size:14px">'+h(pg.desc)+'</textarea>'+
        '<label>'+S.body+'</label><textarea class="pM mdbox" style="min-height:40vh;border-radius:10px">'+h(pg.md)+'</textarea>'+
        '<div class="row" style="margin-top:10px"><button class="btn pS">'+S.save+'</button>'+(pg.custom?'<button class="btn ghost pR">'+S.reset+'</button>':'')+'<a class="btn ghost" href="/'+pg.key+'" target="_blank">'+S.view+'</a></div><div class="edout pO"></div></details>';
    }).join('');
    view.querySelectorAll('.pgx').forEach(function(x){
      var k=x.dataset.k,o=x.querySelector('.pO');
      x.querySelector('.pS').onclick=function(){o.textContent='…';api('cms_page_save',{key:k,title:x.querySelector('.pT').value,desc:x.querySelector('.pD').value,md:x.querySelector('.pM').value}).then(function(r){o.style.color=r.ok?'#2bd97c':'#ff7aa5';o.textContent=r.ok?S.saved:(r.error||'Error')})};
      var r=x.querySelector('.pR');if(r)r.onclick=function(){if(!confirm(S.resetSure))return;api('cms_page_save',{key:k,reset:true}).then(showPages)};
    });
  });
}

function faqToText(f){return (f||[]).map(function(x){return 'Q: '+x[0]+'\\nA: '+x[1]}).join('\\n\\n')}
function textToFaq(t){var out=[],cur=null;String(t||'').split('\\n').forEach(function(l){var m;
  if((m=l.match(/^\\s*Q:\\s*(.*)$/i))){cur=[m[1].trim(),''];out.push(cur)}
  else if((m=l.match(/^\\s*A:\\s*(.*)$/i))&&cur){cur[1]=(cur[1]?cur[1]+' ':'')+m[1].trim()}
  else if(cur&&l.trim()){cur[1]+=(cur[1]?' ':'')+l.trim()}});
  return out.filter(function(x){return x[0]&&x[1]})}

function showTools(){
  view.innerHTML='<div class="box dim">'+S.loading+'</div>';
  api('cms_tools').then(function(d){
    view.innerHTML='<div class="box"><p class="dim" style="margin:0">'+S.toolHint+'</p></div>'+d.tools.map(function(t){
      return '<details class="box tlx" data-s="'+h(t.slug)+'"><summary style="cursor:pointer;font-weight:700">/'+h(t.slug)+' <span class="st '+(t.custom?'draft':'live')+'">'+(t.custom?S.custom:S.orig)+'</span></summary>'+
        '<label>'+S.title+' <span class="cnt">Google</span></label><input class="tT" value="'+h(t.title)+'">'+
        '<label>'+S.desc+'</label><textarea class="tD" rows="3" style="font-family:inherit;font-size:14px">'+h(t.desc)+'</textarea>'+
        '<label>'+S.h1+'</label><input class="tH" value="'+h(t.h1)+'">'+
        '<label>'+S.intro+'</label><textarea class="tI" rows="5" style="font-family:inherit;font-size:14px">'+h(t.intro)+'</textarea>'+
        '<label>'+S.faq+'</label><textarea class="tF faqbox">'+h(faqToText(t.faq))+'</textarea>'+
        '<div class="row" style="margin-top:10px"><button class="btn tS">'+S.save+'</button>'+(t.custom?'<button class="btn ghost tR">'+S.reset+'</button>':'')+'<a class="btn ghost" href="/'+h(t.slug)+'" target="_blank">'+S.view+'</a></div><div class="edout tO"></div></details>';
    }).join('');
    view.querySelectorAll('.tlx').forEach(function(x){
      var s=x.dataset.s,o=x.querySelector('.tO');
      x.querySelector('.tS').onclick=function(){o.textContent='…';
        api('cms_tool_save',{slug:s,title:x.querySelector('.tT').value,desc:x.querySelector('.tD').value,h1:x.querySelector('.tH').value,intro:x.querySelector('.tI').value,faq:textToFaq(x.querySelector('.tF').value)})
        .then(function(r){o.style.color=r.ok?'#2bd97c':'#ff7aa5';o.textContent=r.ok?S.saved:(r.error||'Error')})};
      var r=x.querySelector('.tR');if(r)r.onclick=function(){if(!confirm(S.resetSure))return;api('cms_tool_save',{slug:s,reset:true}).then(showTools)};
    });
  });
}

/* ================= messages ================= */
var ml=$('msgList');
if(ml){
  var filt='new';
  seg($('msgSeg'),function(b){filt=b.dataset.f;loadMsgs()});
  function ago(ts){var m=Math.round((Date.now()-ts)/60000);if(m<60)return m+'m';var hh=Math.round(m/60);if(hh<48)return hh+'h';return new Date(ts).toISOString().slice(0,10)}
  function loadMsgs(){
    api('msg_list&f='+filt).then(function(d){
      $('cNew').textContent=d.counts.new||'';
      if($('cEmail')&&!$('cEmail').dataset.set){$('cEmail').value=d.email||'';$('cEmail').dataset.set=1}
      if(!d.items.length){ml.innerHTML='<p class="dim" style="margin-top:12px">'+S.m_none+'</p>';return}
      ml.innerHTML=d.items.map(function(m){
        var subj=encodeURIComponent('Re: '+m.topic+' — IGtoDownload');
        var quote=encodeURIComponent('\\n\\n\\n— On '+new Date(m.ts).toUTCString()+', '+m.name+' wrote:\\n> '+m.body.split('\\n').join('\\n> '));
        return '<div class="msgi '+(m.status==='new'?'new':'')+'" data-id="'+m.id+'"><div class="hd"><b>'+h(m.name)+'</b><span>'+ago(m.ts)+(m.country?' · '+h(m.country):'')+'</span></div>'+
          '<span class="tp">'+h(m.topic)+'</span><div class="em">'+h(m.email)+'</div><div class="tx">'+h(m.body)+'</div>'+
          '<div class="acts"><a class="pri" href="mailto:'+h(m.email)+'?subject='+subj+'&body='+quote+'" data-r="1">'+S.reply+'</a>'+
          (m.status==='done'?'<button data-s="new">'+S.markNew+'</button>':'<button data-s="done">'+S.markDone+'</button>')+
          '<button class="dz" data-x="1">'+S.m_del+'</button></div></div>';
      }).join('');
      ml.querySelectorAll('.msgi').forEach(function(x){
        var id=x.dataset.id;
        x.querySelector('[data-r]').addEventListener('click',function(){api('msg_mark',{id:id,status:'read'})});
        var s=x.querySelector('[data-s]');s.onclick=function(){api('msg_mark',{id:id,status:s.dataset.s}).then(loadMsgs)};
        x.querySelector('[data-x]').onclick=function(){if(!confirm(S.m_sure))return;api('msg_del',{id:id}).then(loadMsgs)};
      });
    });
  }
  loadMsgs();
  $('cEmailSave').onclick=function(){var o=$('cEmailOut');o.textContent='…';api('msg_email',{email:$('cEmail').value}).then(function(r){o.style.color=r.ok?'#2bd97c':'#ff7aa5';o.textContent=r.ok?S.saved:r.error})};
}
})();
`;
