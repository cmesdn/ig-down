/**
 * pages.js — public site: tool pages, policy pages, blog, sitemap, robots
 * Original design. No third-party logos, wordmarks or brand marks are used.
 */

import { getConfig, AD_SLOTS } from "./store.js";

/* ===================== content ===================== */

export const TOOLS = {
  "": {
    slug: "",
    title: "Instagram Video Downloader — Save Reels, Photos & IGTV in HD",
    desc: "Free Instagram downloader. Paste any public reel, video, photo or IGTV link and save it in original HD quality. No login, no watermark, no app.",
    h1: "Instagram Video Downloader",
    sub: "Save reels, videos, photos and IGTV in original quality — free, no login, no watermark.",
    kw: "instagram downloader, instagram video download, save instagram video",
    intro:
      "IGtoDownload turns any public Instagram link into a file you can keep. Paste the link, and the highest quality version available is pulled straight from Instagram's own servers — the same resolution the creator uploaded, with no re-encoding and no watermark stamped on top. Everything runs in the browser, so there is nothing to install on your phone or computer.",
    faq: [
      ["Is IGtoDownload free?", "Yes. Every download is free and there is no limit on how many links you can paste. No account, no email, no card."],
      ["Do I need to log in to Instagram?", "No. You never enter your Instagram username or password anywhere on this site. Only the public link is needed."],
      ["What quality do I get?", "The best version Instagram stores for that post, usually 1080×1920 for reels. The file is not re-compressed, so nothing is lost."],
      ["Does it work on iPhone and Android?", "Yes. The site works in any mobile or desktop browser. On iPhone, saved files land in the Files app, and you can move them to Photos from there."],
      ["Can I download from a private account?", "No. Only public posts can be downloaded. Private content stays private, and that is deliberate."],
      ["Are my downloads stored anywhere?", "No. Nothing is saved on our servers. The file streams from Instagram through to your device and is never written to disk."],
    ],
  },
  reels: {
    slug: "reels",
    title: "Instagram Reels Downloader — Save Reels in HD, No Watermark",
    desc: "Download Instagram Reels in full HD without a watermark. Paste the reel link and save the MP4 to your phone or computer in seconds. Free, no login.",
    h1: "Instagram Reels Downloader",
    sub: "Paste a reel link and save the MP4 in full HD, with no watermark.",
    kw: "instagram reels download, reels downloader, download instagram reel",
    intro:
      "Reels are the format people most want to keep, and also the one most tools handle badly — many hand back a shrunken, re-encoded copy with a logo burned into the corner. This downloader fetches the original MP4 that Instagram itself serves, so what you save is exactly what was uploaded: full resolution, original audio, nothing stamped on it.",
    faq: [
      ["How do I download a reel?", "Open the reel, tap Share, choose Copy link, then paste it in the box above and press Download."],
      ["Will the reel have a watermark?", "No. The file comes from Instagram's own servers before any watermark is applied, so it is clean."],
      ["Can I download reels with the sound?", "Yes. Audio is part of the MP4, exactly as it plays on Instagram."],
      ["What is the maximum reel length?", "Any length Instagram allows, up to 90 seconds for standard reels and longer for extended formats."],
      ["Where do saved reels go on my phone?", "On Android they appear in Downloads or your gallery. On iPhone they go to the Files app, and can be moved to Photos."],
    ],
  },
  video: {
    slug: "video",
    title: "Instagram Video Downloader — Download Any IG Video in MP4",
    desc: "Download Instagram videos in MP4 at the highest quality available. Works with feed videos, reels and carousel posts. Free and fast, no sign up.",
    h1: "Instagram Video Downloader",
    sub: "Save any public Instagram video as an MP4, in the quality it was uploaded.",
    kw: "instagram video download, download instagram video, ig video downloader",
    intro:
      "Feed videos, reels, carousel clips — if it plays on Instagram and the account is public, you can keep a copy. Paste the post link and every video in it is listed with its resolution and file size, so you know what you are getting before the download starts.",
    faq: [
      ["Which video types are supported?", "Feed videos, reels, IGTV and videos inside carousel posts. Each clip in a carousel is listed separately."],
      ["Is there a file size limit?", "No. Longer videos simply take a little longer to transfer."],
      ["Can I download several videos at once?", "Carousel posts list every item, so you can save them one after another from the same result."],
      ["Does downloading notify the creator?", "No. The account owner is not told, and nothing appears in their notifications."],
    ],
  },
  photo: {
    slug: "photo",
    title: "Instagram Photo Downloader — Save IG Photos in Full Resolution",
    desc: "Download Instagram photos and carousel images in full resolution. Paste the post link and save every picture as a JPG. Free, no watermark, no login.",
    h1: "Instagram Photo Downloader",
    sub: "Save photos and full carousels as JPG, at the resolution Instagram stores.",
    kw: "instagram photo download, download instagram picture, ig image downloader",
    intro:
      "Right-clicking an Instagram photo gives you a blurry thumbnail at best. This tool pulls the full-size JPG instead — the largest version Instagram holds for that post. Carousels are handled too: every image in the set is listed, so you can save the whole thing rather than hunting one picture at a time.",
    faq: [
      ["What resolution do photos come in?", "The largest version Instagram stores, typically 1080px on the long edge."],
      ["Can I download a whole carousel?", "Yes. Every image in the carousel appears as its own download button."],
      ["What format are photos saved in?", "JPG, exactly as Instagram stores them. There is no re-compression."],
      ["Can I download a profile picture?", "Profile pictures are not covered here — this tool works on posts."],
    ],
  },
  igtv: {
    slug: "igtv",
    title: "IGTV Downloader — Save Long Instagram Videos in HD",
    desc: "Download IGTV and long-form Instagram videos in HD. Paste the link and save the full MP4 to your device. Free, fast, no account needed.",
    h1: "IGTV Downloader",
    sub: "Save long-form Instagram videos in full quality, however long they run.",
    kw: "igtv download, igtv downloader, download igtv video",
    intro:
      "Long-form Instagram videos are the ones you actually want offline — tutorials, interviews, full performances. Paste the link and the complete MP4 is fetched at its original resolution, with no length cap and no quality drop partway through.",
    faq: [
      ["Is there a length limit?", "No. IGTV and long-form videos download in full, however long they run."],
      ["Does the quality drop on long videos?", "No. The original file is transferred as-is, so quality is identical from start to finish."],
      ["Can I pause and resume a download?", "Yes. Downloads support resuming, which helps on slower mobile connections."],
    ],
  },
  story: {
    slug: "story",
    title: "Instagram Story Downloader — Save Public Stories & Highlights",
    desc: "Save public Instagram stories and highlights to your device. Paste the story or highlight link and download the video or photo in original quality.",
    h1: "Instagram Story Downloader",
    sub: "Save public stories and highlights before they disappear.",
    kw: "instagram story download, story downloader, save instagram story",
    intro:
      "Stories vanish after 24 hours, which is exactly why people want to keep them. Paste a public story or highlight link and the original photo or video is pulled at full quality. Note that this works on public accounts only — if a profile is private, nothing is accessible here.",
    faq: [
      ["Can I download stories anonymously?", "This tool saves public story content from a link. It does not view stories on your behalf, so the account owner's viewer list is unaffected by anything you do here."],
      ["Can I download stories from private accounts?", "No. Only public accounts are supported."],
      ["Do highlights work?", "Yes. Highlight links are handled the same way as stories."],
      ["What if the story already expired?", "Expired stories are gone from Instagram's servers and cannot be recovered by any tool."],
    ],
  },
};

const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    desc: "How IGtoDownload handles your data: what we collect, what we do not, cookies, analytics and advertising.",
    body: [
      ["What we collect", "We do not ask for an account, an email address or any Instagram credentials. The link you paste is used to fetch the media and is not tied to you. We keep aggregate counts — how many requests succeeded, which country they came from — so we can tell whether the service is working. Those counts contain no personal identifiers."],
      ["Files and storage", "Downloaded media is never written to our servers. When you press download, the file streams from Instagram's content servers through this site to your device, and nothing is retained afterwards."],
      ["Cookies", "The site stores one small preference locally: whether you chose the dark or light theme. That value stays in your browser and is never sent to us."],
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
];

/* ===================== router ===================== */

export function route(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return { kind: "tool", data: TOOLS[""] };
  const seg = p.slice(1);
  if (TOOLS[seg]) return { kind: "tool", data: TOOLS[seg] };
  if (LEGAL[seg]) return { kind: "legal", data: LEGAL[seg], slug: seg };
  if (seg === "blog") return { kind: "bloglist" };
  if (seg.startsWith("blog/")) {
    const post = BLOG.find((b) => b.slug === seg.slice(5));
    if (post) return { kind: "post", data: post };
  }
  return null;
}

export async function render(match, env, origin) {
  const cfg = await getConfig(env);
  if (match.kind === "tool") return shell(toolBody(match.data, cfg), match.data, cfg, origin, match.data.slug);
  if (match.kind === "legal") return shell(legalBody(match.data), { title: match.data.title + " — " + cfg.brand.name, desc: match.data.desc, h1: match.data.title }, cfg, origin, match.slug);
  if (match.kind === "bloglist") return shell(blogListBody(), { title: "Blog — Instagram tips and guides", desc: "Guides on downloading Instagram reels, videos and photos, and fixing the problems that come up.", h1: "Blog" }, cfg, origin, "blog");
  if (match.kind === "post") return shell(postBody(match.data), { title: match.data.title, desc: match.data.desc, h1: match.data.title }, cfg, origin, "blog/" + match.data.slug);
  return null;
}

/* ===================== shell ===================== */

function shell(body, meta, cfg, origin, slug) {
  const brand = cfg.brand.name;
  const canonical = origin + "/" + (slug || "");
  const ga = cfg.analytics.ga4
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.analytics.ga4)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.analytics.ga4)}');</script>`
    : "";
  const adsense = cfg.analytics.adsenseClient
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.analytics.adsenseClient)}" crossorigin="anonymous"></script>`
    : "";
  const gsc = cfg.analytics.gscTag ? `<meta name="google-site-verification" content="${esc(cfg.analytics.gscTag)}">` : "";

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.desc)}">
${meta.kw ? `<meta name="keywords" content="${esc(meta.kw)}">` : ""}
<link rel="canonical" href="${esc(canonical)}">
${gsc}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(brand)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0a0a0f">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%23ff8a3d"/><stop offset="0.5" stop-color="%23f9377d"/><stop offset="1" stop-color="%238a3ffc"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(%23g)"/><path d="M16 8v11m0 0l-4.5-4.5M16 19l4.5-4.5M9 23h14" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>')}">
<style>${CSS}</style>
${ga}${adsense}
</head>
<body>
${adSlot(cfg, "sticky_top")}
<header class="nav">
  <a class="brand" href="/"><span class="mark"></span><b>IGto</b>Download</a>
  <nav class="links">
    <a href="/reels">Reels</a><a href="/video">Video</a><a href="/photo">Photo</a><a href="/story">Story</a><a href="/blog">Blog</a>
  </nav>
  <button class="themebtn" id="themebtn" aria-label="Toggle theme">◐</button>
</header>
${adSlot(cfg, "header")}
<main>${body}</main>
${adSlot(cfg, "footer")}
<footer>
  <div class="fcols">
    <div><h4>Tools</h4><a href="/reels">Reels downloader</a><a href="/video">Video downloader</a><a href="/photo">Photo downloader</a><a href="/igtv">IGTV downloader</a><a href="/story">Story downloader</a></div>
    <div><h4>Site</h4><a href="/about">About</a><a href="/blog">Blog</a><a href="/contact">Contact</a></div>
    <div><h4>Legal</h4><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/dmca">DMCA</a></div>
  </div>
  <p class="fine">© ${new Date().getFullYear()} ${esc(brand)}. Not affiliated with, endorsed by or connected to Instagram or Meta Platforms. Download only content you created or have permission to save.</p>
</footer>
${adSlot(cfg, "sticky_bottom", "sticky-bottom")}
<script>${JS}</script>
</body></html>`;
}

/* ===================== bodies ===================== */

function toolBody(t, cfg) {
  const steps = [
    ["Copy the link", "Open the post in Instagram, tap Share, then Copy link."],
    ["Paste it above", "Drop the link into the box and press Download."],
    ["Save the file", "Pick the quality you want — the file saves straight to your device."],
  ];
  return `
<section class="hero">
  <h1>${esc(t.h1)}</h1>
  <p class="sub">${esc(t.sub)}</p>
  <form id="f" class="searchbar">
    <input id="u" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Paste Instagram link here..." required>
    <button type="button" id="paste" class="pastebtn" aria-label="Paste">Paste</button>
    <button type="submit" id="go">Download</button>
  </form>
  <p class="trust">Free · No login · No watermark · Original quality</p>
</section>
${adSlot(cfg, "under_input")}
<div id="out"></div>
${adSlot(cfg, "above_result", "", "slot-above-result")}
<section class="prose">
  <p class="lead">${esc(t.intro)}</p>
</section>
<section class="steps">
  <h2>How to download in three steps</h2>
  <div class="stepgrid">
    ${steps.map((s, i) => `<div class="step"><span class="num">${i + 1}</span><h3>${esc(s[0])}</h3><p>${esc(s[1])}</p></div>`).join("")}
  </div>
</section>
${adSlot(cfg, "in_content")}
<section class="feats">
  <h2>Why use ${esc(cfg.brand.name)}</h2>
  <div class="fgrid">
    <div class="feat"><h3>Original quality</h3><p>The file is taken straight from Instagram and passed through untouched — no re-encoding, no quality loss.</p></div>
    <div class="feat"><h3>No watermark</h3><p>Nothing is stamped onto your video. What you save looks exactly like what you watched.</p></div>
    <div class="feat"><h3>No login, ever</h3><p>You are never asked for an Instagram password. Only the public link is needed.</p></div>
    <div class="feat"><h3>Works everywhere</h3><p>Android, iPhone, Windows, Mac, tablets. Any browser, nothing to install.</p></div>
    <div class="feat"><h3>Fast everywhere</h3><p>Runs on a global edge network, so requests are handled close to where you are.</p></div>
    <div class="feat"><h3>Nothing stored</h3><p>Files stream through to your device. We never keep a copy of what you download.</p></div>
  </div>
</section>
<section class="faq">
  <h2>Frequently asked questions</h2>
  ${t.faq.map((f) => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join("")}
</section>
${adSlot(cfg, "native")}
${schema(t)}`;
}

function legalBody(d) {
  return `<section class="prose doc">
  <h1>${esc(d.title)}</h1>
  <p class="updated">Last updated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
  ${d.body.map((b) => `<h2>${esc(b[0])}</h2><p>${esc(b[1])}</p>`).join("")}
</section>`;
}

function blogListBody() {
  return `<section class="prose doc">
  <h1>Blog</h1>
  <p class="lead">Guides on saving Instagram content, and fixes for the problems that come up along the way.</p>
  <div class="postlist">
  ${BLOG.map((b) => `<a class="postcard" href="/blog/${b.slug}"><h3>${esc(b.title)}</h3><p>${esc(b.desc)}</p><span>${esc(b.date)}</span></a>`).join("")}
  </div>
</section>`;
}

function postBody(p) {
  return `<article class="prose doc">
  <h1>${esc(p.title)}</h1>
  <p class="updated">${esc(p.date)}</p>
  ${p.body.map((b) => `<h2>${esc(b[0])}</h2><p>${esc(b[1])}</p>`).join("")}
  <div class="cta"><h3>Try it now</h3><p>Paste a link on the <a href="/">downloader</a> and save the file in a few seconds.</p></div>
</article>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.desc,
    datePublished: p.date,
    dateModified: p.date,
  })}</script>`;
}

function schema(t) {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map((f) => ({ "@type": "Question", name: f[0], acceptedAnswer: { "@type": "Answer", text: f[1] } })),
  };
  const app = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: t.h1,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  const how = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to download from Instagram",
    step: [
      { "@type": "HowToStep", name: "Copy the link", text: "Open the post in Instagram, tap Share, then Copy link." },
      { "@type": "HowToStep", name: "Paste it", text: "Paste the link into the box and press Download." },
      { "@type": "HowToStep", name: "Save", text: "Choose a quality and the file saves to your device." },
    ],
  };
  return [faq, app, how].map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("");
}

/* ===================== ads ===================== */

function adSlot(cfg, id, cls = "", wrapCls = "") {
  if (!cfg.settings.adsEnabled) return "";
  const a = cfg.ads[id];
  if (!a || !a.enabled || !a.code.trim()) return "";
  const dev = a.device === "mobile" ? " only-mobile" : a.device === "desktop" ? " only-desktop" : "";
  return `<div class="adzone ${cls}${dev} ${wrapCls}" data-slot="${id}"><span class="adlabel">Advertisement</span>${a.code}</div>`;
}

/* ===================== sitemap / robots ===================== */

export function sitemap(origin) {
  const urls = [
    ...Object.values(TOOLS).map((t) => ({ loc: origin + "/" + t.slug, p: t.slug ? "0.9" : "1.0" })),
    { loc: origin + "/blog", p: "0.7" },
    ...BLOG.map((b) => ({ loc: origin + "/blog/" + b.slug, p: "0.6" })),
    ...Object.keys(LEGAL).map((k) => ({ loc: origin + "/" + k, p: "0.3" })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc.replace(/\/$/, "") || origin}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u.p}</priority></url>`).join("\n")}
</urlset>`;
}

export function robots(origin) {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /dl
Disallow: /img

Sitemap: ${origin}/sitemap.xml`;
}

/* ===================== assets ===================== */

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const CSS = `
:root{--bg:#0a0a0f;--bg2:#101017;--card:#15151d;--line:#26262f;--fg:#f2f2f5;--mut:#8e8e9c;
--a1:#ff8a3d;--a2:#f9377d;--a3:#8a3ffc;--ok:#2bd97c;--grad:linear-gradient(100deg,var(--a1),var(--a2) 48%,var(--a3));--sh:0 10px 30px rgba(0,0,0,.4)}
[data-theme=light]{--bg:#fbfbfd;--bg2:#f2f2f6;--card:#fff;--line:#e7e7ee;--fg:#14141a;--mut:#6c6c7a;--sh:0 8px 26px rgba(20,20,40,.08)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0 0 auto;height:60vh;pointer-events:none;z-index:-1;
background:radial-gradient(70vw 50vh at 50% -15%,rgba(249,55,125,.18),transparent 70%),radial-gradient(50vw 40vh at 88% 0,rgba(138,63,252,.16),transparent 70%)}
[data-theme=light] body::before{background:radial-gradient(70vw 50vh at 50% -18%,rgba(249,55,125,.1),transparent 70%),radial-gradient(50vw 40vh at 88% 0,rgba(138,63,252,.09),transparent 70%)}
main{max-width:860px;margin:0 auto;padding:0 18px 70px}
a{color:inherit}
/* nav */
.nav{max-width:860px;margin:0 auto;padding:16px 18px;display:flex;align-items:center;gap:14px}
.brand{font-size:19px;font-weight:800;letter-spacing:-.4px;text-decoration:none;display:flex;align-items:center;gap:9px}
.brand b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.mark{width:26px;height:26px;border-radius:8px;background:var(--grad);flex:none;position:relative}
.mark::after{content:"";position:absolute;inset:7px;border:2.2px solid #fff;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-2px);border-radius:1px}
.links{display:flex;gap:16px;margin-left:auto;font-size:14px}
.links a{color:var(--mut);text-decoration:none}
.links a:hover{color:var(--fg)}
.themebtn{background:var(--card);border:1px solid var(--line);color:var(--mut);width:34px;height:34px;border-radius:10px;font-size:15px;cursor:pointer;flex:none}
@media(max-width:620px){.links{display:none}}
/* hero */
.hero{text-align:center;padding:34px 0 8px}
h1{font-size:34px;line-height:1.15;letter-spacing:-1px;font-weight:800}
@media(max-width:620px){h1{font-size:27px}}
.sub{color:var(--mut);margin-top:12px;font-size:15.5px;max-width:520px;margin-inline:auto}
.searchbar{display:flex;gap:8px;margin-top:24px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px;box-shadow:var(--sh)}
.searchbar input{flex:1;min-width:0;background:transparent;border:0;color:var(--fg);font-size:15px;padding:12px 10px;outline:none;font-family:inherit}
.searchbar input::placeholder{color:var(--mut)}
.pastebtn{background:var(--bg2);border:1px solid var(--line);color:var(--mut);border-radius:11px;padding:0 13px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.searchbar button[type=submit]{background:var(--grad);border:0;color:#fff;font-weight:700;font-size:15px;padding:12px 22px;border-radius:11px;cursor:pointer;font-family:inherit;min-width:118px}
.searchbar button:disabled{opacity:.6}
.trust{color:var(--mut);font-size:12.5px;margin-top:12px}
/* result */
#out{margin-top:22px}
.result{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:var(--sh)}
.preview{position:relative;background:#000;display:flex;justify-content:center}
.preview img{width:100%;max-width:420px;max-height:70vh;object-fit:cover;display:block}
.playpill{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:62px;height:62px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);display:grid;place-items:center;border:1.5px solid rgba(255,255,255,.35)}
.playpill::after{content:"";border-left:17px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent;margin-left:4px}
.dur{position:absolute;right:12px;bottom:12px;background:rgba(0,0,0,.65);color:#fff;font-size:12px;font-weight:600;padding:3px 8px;border-radius:7px}
.rbody{padding:16px}
.who{display:flex;align-items:center;gap:10px}
.who img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--bg2);flex:none}
.who .nm{font-weight:700;font-size:15px}
.who .fn{color:var(--mut);font-size:12.5px}
.cap{margin-top:12px;font-size:14px;color:var(--fg);opacity:.92;white-space:pre-wrap;max-height:84px;overflow:hidden;position:relative}
.cap.open{max-height:none}
.capmore{color:var(--a2);font-size:13px;font-weight:600;background:none;border:0;cursor:pointer;padding:4px 0;font-family:inherit}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:6px 11px;font-size:12.5px;color:var(--mut);font-weight:600}
.chip b{color:var(--fg)}
.dls{margin-top:14px;display:grid;gap:9px}
.dl{text-decoration:none;display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--grad);color:#fff;border-radius:13px;padding:15px 17px;font-weight:700;font-size:14.5px}
.dl.alt{background:var(--bg2);border:1px solid var(--line);color:var(--fg)}
.dl i{font-style:normal;font-weight:600;opacity:.85;font-size:13px}
.err{background:rgba(249,55,125,.09);border:1px solid rgba(249,55,125,.3);color:var(--fg);padding:15px 17px;border-radius:14px;font-size:14.5px}
.err b{display:block;margin-bottom:4px}
.spin{width:18px;height:18px;border:2.2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;display:inline-block;vertical-align:-4px}
@keyframes sp{to{transform:rotate(360deg)}}
/* content */
section{margin-top:46px}
h2{font-size:23px;letter-spacing:-.5px;margin-bottom:16px;font-weight:800}
h3{font-size:16px;font-weight:700}
.prose p{color:var(--mut);font-size:15.5px}
.lead{font-size:16.5px}
.stepgrid,.fgrid{display:grid;gap:13px}
.stepgrid{grid-template-columns:repeat(3,1fr)}
.fgrid{grid-template-columns:repeat(2,1fr)}
@media(max-width:700px){.stepgrid,.fgrid{grid-template-columns:1fr}}
.step,.feat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.step .num{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--grad);color:#fff;font-weight:800;font-size:14px;margin-bottom:11px}
.step p,.feat p{color:var(--mut);font-size:14px;margin-top:7px}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 17px;margin-bottom:9px}
.faq summary{font-weight:650;cursor:pointer;font-size:15px;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";float:right;color:var(--mut);font-weight:400;font-size:19px;line-height:1}
.faq details[open] summary::after{content:"−"}
.faq p{color:var(--mut);font-size:14.5px;margin-top:10px}
.doc h1{font-size:28px;margin-bottom:8px}
.doc h2{font-size:19px;margin-top:26px;margin-bottom:8px}
.updated{color:var(--mut);font-size:13px;margin-bottom:18px}
.postlist{display:grid;gap:12px;margin-top:20px}
.postcard{display:block;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;text-decoration:none}
.postcard p{margin-top:7px;font-size:14px}
.postcard span{color:var(--mut);font-size:12.5px;display:block;margin-top:10px}
.cta{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-top:30px}
.cta p{margin-top:7px}
.cta a{color:var(--a2);font-weight:650}
/* ads */
.adzone{margin:22px auto;text-align:center;min-height:50px;max-width:100%;overflow:hidden}
.adlabel{display:block;color:var(--mut);font-size:10px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:6px;opacity:.6}
.sticky-bottom{position:fixed;left:0;right:0;bottom:0;margin:0;background:var(--card);border-top:1px solid var(--line);padding:5px 0;z-index:50}
.only-mobile{display:none}
@media(max-width:700px){.only-mobile{display:block}.only-desktop{display:none}}
.slot-above-result:empty{display:none}
/* footer */
footer{border-top:1px solid var(--line);margin-top:50px;padding:34px 18px 42px;background:var(--bg2)}
.fcols{max-width:860px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
@media(max-width:620px){.fcols{grid-template-columns:1fr 1fr}}
.fcols h4{font-size:12px;text-transform:uppercase;letter-spacing:1.1px;color:var(--mut);margin-bottom:11px}
.fcols a{display:block;color:var(--fg);opacity:.78;text-decoration:none;font-size:14px;padding:4px 0}
.fine{max-width:860px;margin:26px auto 0;color:var(--mut);font-size:12px;line-height:1.75}
`;

const JS = `
(function(){
var T=localStorage.getItem('th');if(T)document.documentElement.dataset.theme=T;
var tb=document.getElementById('themebtn');
if(tb)tb.onclick=function(){var d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;try{localStorage.setItem('th',n)}catch(e){}};
var f=document.getElementById('f');if(!f)return;
var u=document.getElementById('u'),go=document.getElementById('go'),out=document.getElementById('out');
var pb=document.getElementById('paste');
if(pb)pb.onclick=function(){if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(t){u.value=(t||'').trim();u.focus()}).catch(function(){u.focus()})}else u.focus()};
var q=new URLSearchParams(location.search).get('url');if(q){u.value=q;setTimeout(function(){f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{cancelable:true}))},200)}
f.onsubmit=function(e){
 e.preventDefault();var link=(u.value||'').trim();if(!link)return;
 go.disabled=true;go.innerHTML='<span class="spin"></span>';out.innerHTML='';
 fetch('/api/resolve?url='+encodeURIComponent(link)).then(function(r){return r.json()}).then(function(d){
   if(!d.ok){out.innerHTML='<div class="err"><b>'+esc(d.title||'Could not get that one')+'</b>'+esc(d.error||'')+'</div>';return}
   draw(d);
   if(window.gtag)gtag('event','download_resolved',{method:d.via});
 }).catch(function(){out.innerHTML='<div class="err"><b>Network problem</b>Check your connection and try again.</div>'})
 .then(function(){go.disabled=false;go.textContent='Download'});
};
function draw(d){
 var it=d.items[0];
 var h='<div class="result">';
 if(it.thumb){h+='<div class="preview"><img src="'+it.thumb+'" alt="" loading="eager">';
   if(it.type==='video')h+='<span class="playpill"></span>';
   if(it.duration)h+='<span class="dur">'+fmtDur(it.duration)+'</span>';
   h+='</div>'}
 h+='<div class="rbody">';
 h+='<div class="who">'+(d.avatar?'<img src="'+d.avatar+'" alt="">':'')+'<div><div class="nm">@'+esc(d.username||'instagram')+'</div>'+(d.fullName?'<div class="fn">'+esc(d.fullName)+'</div>':'')+'</div></div>';
 if(d.caption){h+='<div class="cap" id="cap">'+esc(d.caption)+'</div>';if(d.caption.length>170)h+='<button class="capmore" onclick="document.getElementById(\\'cap\\').classList.toggle(\\'open\\');this.textContent=this.textContent===\\'Show more\\'?\\'Show less\\':\\'Show more\\'">Show more</button>'}
 var c=[];
 if(d.likes!=null)c.push('<span class="chip">♥ <b>'+n(d.likes)+'</b> likes</span>');
 if(d.comments!=null)c.push('<span class="chip">💬 <b>'+n(d.comments)+'</b> comments</span>');
 if(d.views!=null)c.push('<span class="chip">▶ <b>'+n(d.views)+'</b> views</span>');
 if(d.takenAt)c.push('<span class="chip">'+new Date(d.takenAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'</span>');
 if(c.length)h+='<div class="stats">'+c.join('')+'</div>';
 h+='<div class="dls">';
 for(var i=0;i<d.items.length;i++){var x=d.items[i];
   h+='<a class="dl'+(i?' alt':'')+'" href="'+x.url+'" download onclick="if(window.gtag)gtag(\\'event\\',\\'download_click\\')">'+
      '<span>'+(x.type==='image'?'Download photo':'Download video')+(d.items.length>1?' '+(i+1):'')+'</span>'+
      '<i>'+esc(x.quality)+'</i></a>'}
 h+='</div></div></div>';
 out.innerHTML=h;
 out.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function n(v){return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':String(v)}
function fmtDur(s){s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
})();
`;
