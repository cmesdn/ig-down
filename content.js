/**
 * content.js — everything the admin can edit without a redeploy:
 * blog posts, policy/about/contact pages, and the text on the tool pages.
 * Built-in text below is only the starting point; anything saved in the
 * admin panel (KV) wins.
 */

/* ===================== markdown (safe subset) =====================
 * Self-contained on purpose: the admin editor runs this same function
 * in the browser for its live preview (via md.toString()).
 */
export function md(src) {
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function safeUrl(u) { return /^(https?:\/\/|\/|#|mailto:)/i.test(u) ? u : "#"; }
  function slugify(s) { return String(s).toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, a, u) { return '<img src="' + safeUrl(u) + '" alt="' + a + '" loading="lazy" decoding="async">'; })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
        var ext = /^https?:/i.test(u);
        return '<a href="' + safeUrl(u) + '"' + (ext ? ' target="_blank" rel="noopener nofollow"' : "") + ">" + t + "</a>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
  }
  var lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  var out = [], para = [], list = null, quote = [];
  function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
  function flushList() { if (list) { out.push("<" + list.t + ">" + list.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + list.t + ">"); list = null; } }
  function flushQuote() { if (quote.length) { out.push("<blockquote><p>" + inline(quote.join(" ")) + "</p></blockquote>"); quote = []; } }
  function flushAll() { flushPara(); flushList(); flushQuote(); }
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i], m;
    if (!l.trim()) { flushAll(); continue; }
    if ((m = l.match(/^(#{2,4})\s+(.+)$/))) {
      flushAll();
      var lv = m[1].length, tx = inline(m[2].trim());
      out.push("<h" + lv + (lv === 2 ? ' id="' + slugify(m[2]) + '"' : "") + ">" + tx + "</h" + lv + ">");
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(l.trim())) { flushAll(); out.push("<hr>"); continue; }
    if ((m = l.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      flushAll();
      out.push('<figure><img src="' + safeUrl(m[2]) + '" alt="' + esc(m[1]) + '" loading="lazy" decoding="async">' + (m[1] ? "<figcaption>" + esc(m[1]) + "</figcaption>" : "") + "</figure>");
      continue;
    }
    if ((m = l.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = l.match(/^\s*[-*]\s+(.+)$/)) || (m = l.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote();
      var t = /^\s*\d/.test(l) ? "ol" : "ul";
      if (!list || list.t !== t) { flushList(); list = { t: t, items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += " " + l.trim(); continue; }
    flushList(); flushQuote();
    para.push(l.trim());
  }
  flushAll();
  return out.join("\n");
}

export function headings(src) {
  var res = [];
  String(src || "").split("\n").forEach(function (l) {
    var m = l.match(/^##\s+(.+)$/);
    if (m) res.push({ text: m[1].replace(/\*\*|`|\*/g, "").trim(), id: m[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) });
  });
  return res;
}

export function plain(src) {
  return String(src || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#>*`_-]/g, " ").replace(/\s+/g, " ").trim();
}
export function words(src) { const p = plain(src); return p ? p.split(" ").length : 0; }
export function slugOf(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }

/* ===================== storage ===================== */

const MEM = new Map();
const TTL = 60_000;
async function kget(env, key) {
  const c = MEM.get(key);
  if (c && c.exp > Date.now()) return c.v;
  let v = null;
  try { const raw = await env.CONFIG.get(key); if (raw) v = JSON.parse(raw); } catch (_) {}
  MEM.set(key, { v, exp: Date.now() + TTL });
  return v;
}
async function kput(env, key, v) {
  if (v == null) await env.CONFIG.delete(key); else await env.CONFIG.put(key, JSON.stringify(v));
  MEM.set(key, { v, exp: Date.now() + TTL });
}

const fromPairs = (body) => body.map((b) => "## " + b[0] + "\n\n" + b[1]).join("\n\n");
function metaOf(p) {
  return { slug: p.slug, title: p.title, desc: p.desc, kw: p.kw || "", date: p.date, updated: p.updated || p.date, cover: p.cover || "", status: p.status || "published", words: words(p.md) };
}
function defaultPosts() {
  return BLOG.slice().reverse().map((b) => ({ slug: b.slug, title: b.title, desc: b.desc, kw: b.kw || "", date: b.date, updated: b.updated || b.date, cover: b.cover || "", status: "published", md: b.md || fromPairs(b.body) }));
}

/** All posts, newest first. Drafts only when asked. */
export async function listPosts(env, withDrafts) {
  let idx = await kget(env, "blog:index");
  if (!Array.isArray(idx)) idx = defaultPosts().map(metaOf);
  idx = idx.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updated).localeCompare(String(a.updated)));
  return withDrafts ? idx : idx.filter((p) => p.status === "published");
}

export async function getPost(env, slug, withDrafts) {
  const idx = await listPosts(env, true);
  const meta = idx.find((p) => p.slug === slug);
  if (!meta || (!withDrafts && meta.status !== "published")) return null;
  const saved = await kget(env, "blog:post:" + slug);
  if (saved) return saved;
  const d = defaultPosts().find((p) => p.slug === slug);
  return d ? Object.assign({}, d, meta) : null;
}

export async function savePost(env, input, origSlug) {
  const slug = slugOf(input.slug || input.title);
  if (!slug) throw new Error("slug");
  if (!String(input.title || "").trim()) throw new Error("title");
  const idx = await listPosts(env, true);
  if (slug !== origSlug && idx.some((p) => p.slug === slug)) throw new Error("exists");
  const today = new Date().toISOString().slice(0, 10);
  const prev = origSlug ? await getPost(env, origSlug, true) : null;
  const post = {
    slug,
    title: String(input.title).trim().slice(0, 140),
    desc: String(input.desc || "").trim().slice(0, 300),
    kw: String(input.kw || "").trim().slice(0, 300),
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : (prev && prev.date) || today,
    updated: today,
    cover: /^(\/|https:\/\/)/.test(input.cover || "") ? String(input.cover).slice(0, 500) : "",
    status: input.status === "draft" ? "draft" : "published",
    md: String(input.md || "").slice(0, 120_000),
  };
  await env.CONFIG.put("blog:post:" + slug, JSON.stringify(post));
  MEM.set("blog:post:" + slug, { v: post, exp: Date.now() + TTL });
  const next = idx.filter((p) => p.slug !== slug && p.slug !== origSlug);
  next.push(metaOf(post));
  await kput(env, "blog:index", next);
  if (origSlug && origSlug !== slug) await kput(env, "blog:post:" + origSlug, null);
  return post;
}

export async function deletePost(env, slug) {
  const idx = await listPosts(env, true);
  await kput(env, "blog:index", idx.filter((p) => p.slug !== slug));
  await kput(env, "blog:post:" + slug, null);
}

/* ----- policy / about / contact pages ----- */
export const PAGE_KEYS = ["about", "contact", "privacy", "terms", "dmca"];
export async function getPage(env, key) {
  if (!LEGAL[key]) return null;
  const saved = await kget(env, "page:" + key);
  const d = { key, title: LEGAL[key].title, desc: LEGAL[key].desc, md: fromPairs(LEGAL[key].body), custom: false };
  return saved ? Object.assign(d, saved, { custom: true }) : d;
}
export async function savePage(env, key, input) {
  if (!LEGAL[key]) throw new Error("page");
  await kput(env, "page:" + key, {
    title: String(input.title || LEGAL[key].title).trim().slice(0, 140),
    desc: String(input.desc || "").trim().slice(0, 300),
    md: String(input.md || "").slice(0, 60_000),
    updated: new Date().toISOString().slice(0, 10),
  });
}
export async function resetPage(env, key) { await kput(env, "page:" + key, null); }

/* ----- tool-page text (title, description, intro, FAQ) ----- */
export async function getToolText(env) { return (await kget(env, "tooltext")) || {}; }
export async function saveToolText(env, slug, input) {
  const all = Object.assign({}, await getToolText(env));
  if (input == null) delete all[slug];
  else all[slug] = {
    title: String(input.title || "").trim().slice(0, 140),
    desc: String(input.desc || "").trim().slice(0, 300),
    h1: String(input.h1 || "").trim().slice(0, 120),
    intro: String(input.intro || "").trim().slice(0, 4000),
    faq: (Array.isArray(input.faq) ? input.faq : []).filter((f) => f && f[0] && f[1]).slice(0, 20).map((f) => [String(f[0]).slice(0, 300), String(f[1]).slice(0, 1500)]),
  };
  await kput(env, "tooltext", all);
}

/* ===================== built-in text ===================== */

const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    desc: "How IGtoDownload handles your data: what we collect, what we do not, cookies, analytics and advertising.",
    body: [
      ["What we collect", "We do not ask for an account, an email address or any Instagram credentials. To keep the service working and to stop abuse, each download request is logged with the time, the link that was pasted, whether it worked, your IP address, country and a short description of your device and browser (for example \"Android 14 · Chrome\"). We also count page visits by country, device type and page. These logs are used only to run, secure and improve this site; they are never sold, and the site owner may delete them at any time."],
      ["Files and storage", "Downloaded media is never written to our servers. When you press download, the file streams from Instagram's content servers through this site to your device, and nothing is retained afterwards."],
      ["Data kept on your device", "A few small values are stored in your own browser so the site works the way you left it: your light or dark theme, a list of your recent downloads (so you can find them again), and whether you closed the install banner. These stay on your device and are never sent to us. One random, anonymous number is also kept so that the same browser is counted as one visitor in our page statistics; it contains nothing about you and is not shared with anyone. Clearing your browser data, or tapping Clear in the recent downloads list, removes it."],
      ["Notifications", "If you choose to turn on notifications, your browser gives us an anonymous delivery address. We store it with your country so we can send occasional, relevant updates. It does not identify you. You can turn notifications off at any time in your browser or phone settings, and the address is deleted from our list the next time a message cannot be delivered to it."],
      ["The installed app", "Installing the app adds a shortcut that opens this site full screen. It uses the same site and the same rules described here. When you share a reel to the app, only the shared link is read; nothing else on your device is accessed. If you have allowed clipboard access, the app may read a copied Instagram link when you open it, to save you a step — nothing else is read, and nothing is sent anywhere except the link you choose to download."],
      ["Analytics", "We may use Google Analytics to understand which pages people find useful. Google processes this data under its own privacy policy. You can block it with any standard browser setting or extension."],
      ["Advertising", "Pages may display ads from third-party networks. Those networks may use cookies to show relevant ads. You can manage ad personalisation through your Google account settings or your browser."],
      ["Third parties", "Media is fetched from Instagram, which is operated by Meta. Your use of their content remains subject to their terms."],
      ["Changes", "If this policy changes, the updated version will be posted on this page."],
    ],
  },
  terms: {
    title: "Terms of Service",
    desc: "The terms you agree to when using IGtoDownload, including acceptable use and limitations of liability.",
    body: [
      ["Acceptable use", "This service is provided so that you can save content you created yourself, or content you have the creator's permission to save. You agree not to use it to copy, redistribute or republish anyone else's work without their consent. Respecting copyright is your responsibility, not ours."],
      ["No affiliation", "IGtoDownload is an independent tool. It is not affiliated with, endorsed by, or connected to Instagram or Meta Platforms in any way. All trademarks belong to their respective owners."],
      ["Public content only", "Only publicly accessible posts can be processed. No attempt is made to access private accounts, and we will not add such a feature."],
      ["No storage", "We do not host, store or index any media. Files remain on Instagram's servers and are streamed to you on request."],
      ["Availability", "The service is offered as-is, with no guarantee of uptime. Instagram can change how its platform works at any time, which may interrupt the service without notice."],
      ["Limitation of liability", "We are not liable for how you use files obtained through this site, or for any loss arising from its use."],
      ["Acceptance", "Using this site means you accept these terms. If you do not accept them, please do not use it."],
    ],
  },
  dmca: {
    title: "DMCA & Copyright",
    desc: "How to report a copyright concern about content accessed through IGtoDownload.",
    body: [
      ["Our position", "IGtoDownload does not host, store or distribute any media. It reads publicly available links and streams the file from Instagram's own servers to the person who requested it. Because no copy exists on our infrastructure, there is nothing for us to take down in the usual sense."],
      ["Where content actually lives", "All media remains on Instagram's servers. If you believe your copyrighted work has been published without permission, the effective route is to report it directly to Instagram, who can remove it at the source."],
      ["Contact us anyway", "If you still wish to raise a concern with us, use the contact page. Please include the post link, a description of the work, a statement of your good-faith belief that the use is unauthorised, and your contact details."],
      ["Response", "Reports are reviewed and answered. Where we can act, we will — including blocking specific links from being processed."],
    ],
  },
  about: {
    title: "About",
    desc: "What IGtoDownload is, how it works, and why it exists.",
    body: [
      ["What this is", "A single-purpose tool: paste a public Instagram link, get the file. No account, no app, no upsell. It was built because the alternatives were slow, covered in pop-ups, or quietly re-encoded videos into something worse than the original."],
      ["How it works", "When you paste a link, the post's public metadata is read and the highest-quality media URL is picked. The file is then streamed through to your browser so it saves with a sensible filename instead of opening in a new tab."],
      ["Speed", "The site runs on a global edge network, so the server handling your request is usually in your own region. Repeated links are served from cache, which is why the second person to paste a popular reel gets it almost instantly."],
      ["What it will not do", "It will not touch private accounts, it will not ask for your password, and it will not store your downloads."],
    ],
  },
  contact: {
    title: "Contact",
    desc: "Get in touch with the IGtoDownload team about bugs, copyright or partnerships.",
    body: [
      ["Get in touch", "Questions, bug reports, copyright concerns and partnership enquiries are all welcome. The fastest way to get a useful answer is to include the link you were trying to download and what happened instead."],
      ["Reporting a broken link", "Instagram changes its platform often. If a link stops working, tell us the exact URL and roughly when you tried — that is usually enough to pin down the cause."],
      ["Response time", "Most messages are answered within a couple of days."],
    ],
  },
};

const BLOG = [
  {
    slug: "how-to-download-instagram-reels",
    title: "How to Download Instagram Reels on Any Device (2026 Guide)",
    desc: "A step-by-step guide to saving Instagram reels on Android, iPhone, Windows and Mac — in full quality and without a watermark.",
    date: "2026-11-21",
    body: [
      ["Why saving a reel is harder than it should be", "Instagram has no download button for other people's reels. The screen-record workaround costs you quality, picks up your notification sounds, and leaves the interface in frame. Copying the link and fetching the original file avoids all three problems, and takes about ten seconds."],
      ["Step 1: copy the reel link", "Open the reel in the Instagram app, tap the paper-plane share icon under it, and choose Copy link. On desktop, open the reel and copy the address from the browser bar. Either format works."],
      ["Step 2: paste it into the downloader", "Open the reels downloader, tap the input box and paste. If your browser supports it, the Paste button fills the field in one tap."],
      ["Step 3: pick a quality and save", "The result shows the resolution and file size before you commit. Tap the download button and the MP4 saves straight to your device."],
      ["Where the file ends up", "Android puts it in Downloads, and most galleries pick it up within a minute. iPhone saves to the Files app; open Files, find the MP4 in Downloads, share it, and choose Save Video to move it into Photos."],
      ["A note on using what you save", "Downloading for personal viewing is one thing; reposting someone's work as your own is another. Credit the creator, and ask first if you plan to publish it anywhere."],
    ],
  },
  {
    slug: "instagram-download-not-working",
    title: "Instagram Download Not Working? Here's How to Fix It",
    desc: "The common reasons an Instagram downloader fails — private accounts, expired links, deleted posts — and what actually fixes each one.",
    date: "2026-11-21",
    body: [
      ["The account is private", "This is the single most common cause. If the profile has a padlock, its posts are not publicly accessible and no tool can reach them. Checking takes a second: open the link in a browser where you are logged out. If you see a login wall, the post is private."],
      ["The post was deleted or archived", "A link keeps its shape after the post is gone. If the page shows a 'sorry, this page isn't available' message, the content no longer exists on Instagram's servers and cannot be recovered."],
      ["You copied the wrong link", "Copying a profile URL instead of a post URL is easy to do. A valid post link contains /reel/, /p/ or /tv/ followed by a short code. If yours does not, go back and use Share then Copy link rather than copying from the address bar."],
      ["The download link expired", "Media links generated for you are time-limited for security. If you leave the page open for hours and then press download, you will get an expiry message. Paste the link again to generate a fresh one."],
      ["The story already expired", "Stories are gone 24 hours after posting unless the creator saved them to a highlight. Once expired, there is nothing left to download."],
      ["Instagram changed something", "Occasionally Instagram changes how its platform responds, and every downloader breaks at once. These outages are usually short. If a link that worked yesterday fails today and none of the above applies, waiting an hour or two is often all it takes."],
    ],
  },
  {
    slug: "download-instagram-video-hd-quality",
    title: "How to Download Instagram Videos in Full HD Quality",
    desc: "Why most downloaders give you a compressed file, and how to make sure you get the original 1080p video instead.",
    date: "2026-11-21",
    body: [
      ["Quality is lost in two places", "First, Instagram compresses on upload — nothing can undo that. Second, and avoidable, many downloaders re-encode the video on their own servers to save bandwidth. That second pass is where the mush comes from, and it is entirely unnecessary."],
      ["What 'original quality' actually means", "Instagram stores several renditions of each video at different resolutions, and serves whichever suits the viewer's connection. A good downloader asks for the list and takes the largest one. For reels that is typically 1080×1920."],
      ["How to check what you got", "On Android, long-press the file and open Details. On iPhone, open it in Files and check Info. If a reel comes back at 640×1136 instead of 1080×1920, the tool downgraded it."],
      ["Screen recording is not a substitute", "A screen recording captures what your display showed, not the source file — so you inherit your screen's resolution, any dropped frames, and whatever was on screen at the time. It is always worse than the original."],
      ["What to look for in a downloader", "Show the resolution before downloading, list every quality available, state the file size, and never add a watermark. If a tool hides all of that, assume it has something to hide."],
    ],
  },
  {
    slug: "download-instagram-photos-carousel",
    title: "How to Download Instagram Photos and Carousel Posts in Full Resolution",
    desc: "Save single photos or every slide of an Instagram carousel at the original resolution — on Android, iPhone or a computer, with no app and no login.",
    kw: "download instagram photo, instagram carousel download, save instagram pictures, instagram photo downloader",
    date: "2026-11-21",
    md: `Instagram lets you save posts to a private collection, but that only bookmarks them inside the app. If the post is deleted, or you want the picture in your gallery, the bookmark is useless. Downloading the actual image file is the only way to really keep it.

## Why a screenshot is not good enough

A screenshot captures your screen, not the photo. You get the status bar, the like button and whatever crop your phone applied. On most phones the screenshot is also smaller than the original upload, so fine detail and text become soft. Instagram stores photos at up to 1080 pixels wide; a proper download gives you exactly that file.

## Step by step: one photo

1. Open the post in Instagram and tap the **paper-plane** share icon.
2. Choose **Copy link**.
3. Open the [Instagram photo downloader](/photo) and paste the link.
4. Tap **Download**. The preview shows the size before you save.

The picture saves as a JPG. On Android it lands in **Downloads**; on iPhone it goes to the **Files** app, where you can tap Share → **Save Image** to move it into Photos.

## Carousel posts: get every slide at once

A carousel is a single post with up to 20 photos or videos. Paste the post link exactly as you would for a single photo. Every slide appears in the result, each with its own download button, so you can pick only the ones you want. Videos inside the carousel are saved as MP4 and photos as JPG — mixed carousels work too.

> Tip: you do not need the link of a specific slide. The post link always brings back the whole carousel.

## Profile pictures and other cases

- **Profile pictures** are not posts, so they have no share link. This tool works with post links (/p/, /reel/, /tv/) and story links.
- **Private accounts** cannot be downloaded by anyone, and we will never ask for your password to get around that.
- **Archived or deleted posts** no longer exist publicly, so there is nothing to fetch.

## Is the quality really the original?

Yes. The file is passed from Instagram's own servers to your device without being re-compressed. What you get is the same file Instagram shows on a large screen. If the uploader posted a low-resolution image in the first place, no tool can add detail that was never there.

## Use pictures fairly

Downloading a photo to keep for yourself is very different from reposting it. If you share someone's picture, credit them clearly, and ask first if it is for anything commercial. Most photographers are happy to say yes when asked.

Ready to try it? Paste a link on the [photo downloader](/photo) — it takes about ten seconds.`,
  },
  {
    slug: "save-instagram-reels-iphone",
    title: "How to Save Instagram Reels to Your iPhone Camera Roll",
    desc: "The quickest way to save an Instagram reel to Photos on iPhone and iPad — no app to install, full quality, and no screen recording.",
    kw: "save instagram reels iphone, download reels iphone, instagram reel to camera roll, reels download ios",
    date: "2026-11-21",
    md: `iPhone users get the hardest time saving reels. Safari handles downloads differently from Android, and many guides stop right before the part that matters: getting the video out of Files and into the Photos app. Here is the full route, start to finish.

## What you need

- An iPhone or iPad on iOS 15 or later (anything from the last few years).
- Safari or Chrome.
- The link of a reel from a **public** account.

No app from the App Store is required. Apps that promise to "download reels" are often stuffed with ads or ask for your Instagram login — avoid giving your password to any of them.

## Step 1: copy the reel link

Open the reel in Instagram, tap the **paper-plane** icon, then **Copy link**. If you only see Share to…, scroll the row of options sideways until Copy link appears.

## Step 2: paste it on the downloader

Open Safari and go to the [reels downloader](/reels). Tap the box and choose **Paste**, then tap **Download**. After a moment you will see a preview with the video quality and file size.

## Step 3: save the file

Tap the download button. Safari asks whether you want to download the file — tap **Download**. A small blue arrow appears in the address bar; that is the download progress.

## Step 4: move it into Photos

This is the step most people miss:

1. Open the **Files** app and go to **Downloads** (or tap the arrow in Safari, then the file).
2. Tap the video to open it.
3. Tap the **Share** button (square with an arrow) and choose **Save Video**.

The reel is now in your Camera Roll, and you can delete the copy in Files to save space.

## Make it faster next time

Add the site to your Home Screen: in Safari tap Share → **Add to Home Screen**. It then opens full screen like an app, with your recent downloads remembered, so the whole process is copy, tap, paste, save.

## If something goes wrong

- **"Download" does nothing** — make sure you are not in Instagram's built-in browser. Tap the ⋯ menu and choose Open in Safari.
- **The video has no sound** — check that the silent switch on the side of your iPhone is off. The file itself keeps the original audio.
- **Error about a private post** — the account is private, and no tool can reach it.

For other problems, see our guide to [fixing downloads that do not work](/blog/instagram-download-not-working).`,
  },
  {
    slug: "download-instagram-stories-highlights",
    title: "How to Download Instagram Stories and Highlights",
    desc: "Save public Instagram stories and highlights as photos or videos before they disappear — what works, what does not, and why.",
    kw: "download instagram story, instagram highlights download, save instagram stories, story saver",
    date: "2026-11-21",
    md: `Stories vanish after 24 hours. That is the point of them — but it also means a recipe, a concert clip or a friend's announcement can be gone before you get back to it. Here is how to keep the ones that matter.

## Stories vs highlights

- **Stories** are temporary and disappear after 24 hours.
- **Highlights** are stories the owner pinned to their profile. They stay until the owner removes them.

Both can be saved the same way, as long as the account is public.

## How to save a story

1. Open the story in Instagram.
2. Tap the **⋯** (three dots) or the paper-plane icon, then **Copy link**. If there is no Copy link option, the account owner may have turned off sharing.
3. Paste the link into the [story downloader](/story) and tap **Download**.

Photos save as JPG and videos as MP4, in the quality Instagram stored them.

## How to save a highlight

Open the highlight on the person's profile, wait for the slide you want, then copy its link the same way. Each slide of a highlight is a separate item, so copy the link while the slide you need is on screen.

## Things that cannot be done

We are honest about the limits, because tools that promise more are usually not telling the truth:

- **Private accounts** are off-limits. No legitimate tool can access them.
- **Expired stories** that were not added to a highlight are deleted from Instagram's servers. They cannot be recovered.
- **Close Friends stories** are private by design and are not accessible.

## Will the person know I saved their story?

Saving a story from a link does not add you to the story's viewer list, because the tool does not watch the story on your behalf. That said, please be respectful — saving someone's personal story and sharing it elsewhere can hurt people, even if it was public.

## Quick tips

- Act within 24 hours; once a story expires, it is gone.
- If a link copied from a highlight brings back the wrong slide, open the highlight again and copy the link while the correct slide is playing.
- Install the app to your home screen so you can share links straight into it from Instagram.

Try it now on the [Instagram story downloader](/story).`,
  },
  {
    slug: "instagram-reels-without-watermark",
    title: "How to Save Instagram Reels Without a Watermark",
    desc: "Instagram's own save option adds a watermark and drops quality. Here is how to keep the clean, original reel instead.",
    kw: "instagram reels without watermark, download reels no watermark, remove watermark instagram reel, clean reel download",
    date: "2026-11-21",
    md: `Instagram now lets you download some reels directly, but there is a catch: the file comes with a moving Instagram logo and the creator's username stamped on top, and it is often compressed further. If you want the clean video, you need the original file.

## Where the watermark comes from

When you use Instagram's own **Download** button, the app creates a new copy of the reel with the watermark burned in. Burned in means it is part of the picture — it cannot be removed afterwards without blurring or cropping the video.

The original reel stored on Instagram's servers has **no** watermark. Fetching that file instead is the clean solution.

## How to get the original

1. In Instagram, tap the paper-plane icon under the reel and choose **Copy link**.
2. Paste the link into the [reels downloader](/reels).
3. Choose the highest quality in the list and tap **Download**.

What you save is the untouched MP4 — no logo, no username overlay, no extra compression.

## Why not just crop the watermark out?

Cropping cuts off part of the video, and the logo moves around the frame during playback, so you would lose a lot of picture. "Watermark remover" apps blur the area, which looks worse than the logo itself. Starting from the clean file avoids the problem entirely.

## Credit the creator anyway

A clean file is great for editing, keeping a personal copy, or watching offline. If you repost it, the watermark is no longer there to credit the creator, so do it yourself: tag them and mention their name. Many creators also allow reuse if you simply ask.

## Checklist for the best result

- Copy the **reel** link, not the profile link.
- Pick the largest resolution offered (usually 1080×1920 for reels).
- Avoid screen recording — it lowers quality and captures your notifications.

Want to understand quality in more depth? Read [how to download Instagram videos in full HD](/blog/download-instagram-video-hd-quality).`,
  },
  {
    slug: "download-instagram-videos-pc-mac",
    title: "How to Download Instagram Videos on PC and Mac",
    desc: "Save Instagram videos and reels on Windows, macOS, Linux or a Chromebook using only your web browser — no software or extensions.",
    kw: "download instagram video pc, instagram video download mac, save instagram video computer, instagram downloader windows",
    date: "2026-11-21",
    md: `On a computer you do not need an app or a browser extension to save Instagram videos. Extensions in particular are risky: they can read every page you visit. A website that does one job is the safer option.

## Step 1: copy the video address

Open instagram.com in your browser and click the video or reel so it opens on its own page. Then either:

- copy the address from the address bar, or
- click the **⋯** menu on the post and choose **Copy link**.

Both work. The link should contain /reel/, /p/ or /tv/.

## Step 2: paste and download

Open the [Instagram video downloader](/video) in a new tab, paste the link with **Ctrl + V** (Windows, Linux, Chromebook) or **Cmd + V** (Mac), and press **Enter**. You will see a preview with the resolution and file size. Click **Download**.

## Where the file goes

- **Windows**: the Downloads folder (press Ctrl + J in Chrome or Edge to see recent downloads).
- **Mac**: the Downloads folder in Finder, or the downloads arrow in Safari's toolbar.
- **Chromebook**: the Files app, under Downloads.

Files are standard MP4, so they play in VLC, QuickTime, Windows Media Player, Photos and every video editor.

## Install it like an app

In Chrome or Edge, look for the small **install** icon at the right end of the address bar and click it. The downloader then opens in its own window from your taskbar or Dock, which is handy if you save videos often.

## Tips for creators and editors

- If you are downloading your own reels to re-upload elsewhere, always take the highest quality option — each re-upload compresses the video again.
- Rename files right after downloading so you can find them later; the default name includes the post code.
- For photos and carousels, use the [photo downloader](/photo) instead.

## Troubleshooting

If a link fails, check that the account is public and the post still exists. Our [troubleshooting guide](/blog/instagram-download-not-working) covers every common error and how to fix it.`,
  },
  {
    slug: "is-it-legal-to-download-instagram-videos",
    title: "Is It Legal to Download Instagram Videos? What You Should Know",
    desc: "A plain-language look at copyright, Instagram's terms and fair use when saving reels, photos and stories — and how to stay on the right side of them.",
    kw: "is it legal to download instagram videos, instagram copyright, download reels legal, instagram terms download",
    date: "2026-11-21",
    md: `It is one of the most common questions we get, and the honest answer is: it depends on what you do with the file. This guide explains the general principles in plain language. It is not legal advice — if you have a specific situation, talk to a lawyer where you live.

## Who owns an Instagram video?

The person who created it. Posting on Instagram does not hand ownership to Instagram or to the people who watch it. The creator keeps the copyright, and gives Instagram a licence to show the content on its platform.

## Personal use vs reposting

Most of the risk comes from **what happens after** the download, not the download itself:

- **Keeping a copy for yourself** — to watch offline, save a recipe, or keep a memory — is the lowest-risk use and is how most people use downloaders.
- **Reposting someone's work** on your own account, especially without credit, can infringe their copyright and break Instagram's rules.
- **Using it commercially** — in ads, paid content, or products — almost always needs the creator's permission.

## What do Instagram's terms say?

Instagram's terms ask users not to collect content by automated means or to use other people's content in ways that infringe their rights. That is another reason to keep downloads for personal use and to ask permission before republishing.

## What about fair use?

Some countries allow limited use of copyrighted work for purposes such as commentary, criticism, news reporting or education. These rules differ from country to country and depend on the details of each case, so "fair use" is not a blanket permission. When in doubt, ask the creator.

## Simple rules that keep you safe

1. **Download your own content freely.** Backing up your own reels is always fine.
2. **Ask before reposting** anyone else's work, and credit them clearly.
3. **Never remove credits** to pass work off as yours.
4. **Do not sell or monetise** content you did not create without written permission.
5. **Respect private moments.** Just because a story was public does not mean the person wants it spread.

## How IGtoDownload approaches this

We only work with public posts, we do not store any media on our servers, and we never ask for Instagram logins. If you are a creator and have a concern about your content, see our [DMCA & copyright page](/dmca) or [contact us](/contact) — we answer every report.`,
  },
];

