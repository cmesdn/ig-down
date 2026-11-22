/**
 * pages.js — public site: tool pages, policy pages, blog, sitemap, robots
 * Original design. No third-party logos, wordmarks or brand marks are used.
 */

import { getConfig, AD_SLOTS } from "./store.js";
import { APP_HEAD, SPLASH, APP_CSS, APP_JS } from "./app.js";
import { md, headings, plain, listPosts, getPost, getPage, getToolText, PAGE_KEYS } from "./content.js";

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

/* ===================== router ===================== */

export async function route(pathname, env) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const seg = p === "/" ? "" : p.slice(1);
  if (seg in TOOLS) {
    const ov = (await getToolText(env))[TOOLS[seg].slug];
    if (!ov) return { kind: "tool", data: TOOLS[seg] };
    const d = Object.assign({}, TOOLS[seg]);
    for (const k of ["title", "desc", "h1", "intro"]) if (ov[k]) d[k] = ov[k];
    if (ov.faq && ov.faq.length) d.faq = ov.faq;
    return { kind: "tool", data: d };
  }
  if (PAGE_KEYS.includes(seg)) return { kind: "legal", data: await getPage(env, seg), slug: seg };
  if (seg === "blog") return { kind: "bloglist", data: await listPosts(env) };
  if (seg.startsWith("blog/")) {
    const post = await getPost(env, seg.slice(5));
    if (post) return { kind: "post", data: post, more: (await listPosts(env)).filter((x) => x.slug !== post.slug).slice(0, 3) };
  }
  return null;
}

export async function render(match, env, origin) {
  const cfg = await getConfig(env);
  if (match.kind === "tool") return shell(toolBody(match.data, cfg), match.data, cfg, origin, match.data.slug);
  if (match.kind === "legal") return shell(legalBody(match.data, cfg, match.slug), { title: match.data.title + " — " + cfg.brand.name, desc: match.data.desc, h1: match.data.title }, cfg, origin, match.slug);
  if (match.kind === "bloglist") return shell(blogListBody(match.data), { title: "Blog — Instagram tips and guides", desc: "Guides on downloading Instagram reels, videos and photos, and fixing the problems that come up.", h1: "Blog" }, cfg, origin, "blog");
  if (match.kind === "post") {
    const d = match.data;
    return shell(postBody(d, match.more, origin, cfg), { title: d.title, desc: d.desc, kw: d.kw, h1: d.title, image: d.cover ? abs(origin, d.cover) : "", article: true }, cfg, origin, "blog/" + d.slug);
  }
  return null;
}

const abs = (origin, u) => (/^https?:/.test(u) ? u : origin + u);

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
<link rel="image_src" href="${esc(meta.image || origin + "/og.jpg?v=3")}">
${gsc}
<meta property="og:type" content="${meta.article ? "article" : "website"}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(brand)}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${esc(meta.image || origin + "/og.jpg?v=3")}">
<meta property="og:image:secure_url" content="${esc(meta.image || origin + "/og.jpg?v=3")}">
<meta property="og:image:type" content="image/jpeg">
${meta.image ? "" : `<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">`}
<meta property="og:image:alt" content="${esc(brand)} — Instagram video, reels, photo and IGTV downloader">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.desc)}">
<meta name="twitter:image" content="${esc(meta.image || origin + "/og.jpg?v=3")}">
<meta name="theme-color" content="#0a0a0f" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#fbfbfd" media="(prefers-color-scheme: light)">
<meta name="apple-mobile-web-app-title" content="${esc(brand)}">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="apple-touch-icon" href="${origin}/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
${APP_HEAD}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>${CSS}${APP_CSS}</style>
${ga}${adsense}
</head>
<body>
${SPLASH}
${adSlot(cfg, "sticky_top")}
<header class="nav">
  <a class="brand" href="/">${I.mark}<span><b>IGto</b>Download</span></a>
  <nav class="links">
    <a href="/reels">Reels</a><a href="/video">Video</a><a href="/photo">Photo</a><a href="/story">Story</a><a href="/blog">Blog</a>
  </nav>
  <div class="nact">
  <button class="histbtn bellbtn" id="bellbtn" aria-label="Notifications" title="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></button>
  <button class="histbtn" id="histbtn" aria-label="Recent downloads" title="Recent downloads">${I.hist}</button>
  <button class="themebtn" id="themebtn" aria-label="Toggle light or dark mode" title="Light / dark"><span class="ti ti-moon">${I.moon}</span><span class="ti ti-sun">${I.sun}</span></button>
  </div>
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
<script>window.__APP=${appConfig(cfg)};</script>
<script>${APP_JS}</script>
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
    <button type="button" id="paste" class="pastebtn" aria-label="Paste link" title="Paste">${I.paste}</button>
    <button type="submit" id="go">Download</button>
  </form>
  <p class="trust">Free · No login · No watermark · Original quality</p>
</section>
${adSlot(cfg, "under_input")}
${lateSlot(cfg, "above_result")}<div id="out"></div>${lateSlot(cfg, "below_result")}
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
<section class="appsec" id="appsec">
  <img src="/og.jpg" width="1200" height="630" loading="lazy" decoding="async" alt="IGtoDownload app on a phone">
  <div class="aps-tx">
    <h2>Get the free IGtoDownload app</h2>
    <ul>
      <li>Share any reel from Instagram straight to the app</li>
      <li>Opens instantly from your home screen, full screen</li>
      <li>Tiny install, no account, no Play Store needed</li>
    </ul>
    <button type="button" class="aps-go" id="appGet"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>Install the app</span></button>
    <p class="aps-help" id="appHelp" hidden></p>
  </div>
</section>
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

function legalBody(d, cfg, slug) {
  const mail = (cfg.settings && cfg.settings.contactEmail) || "";
  const form = slug !== "contact" ? "" : `
  <form class="cform" id="cform" novalidate>
    <div class="cgrid">
      <label>Your name<input name="name" maxlength="80" autocomplete="name" required></label>
      <label>Email<input name="email" type="email" maxlength="120" autocomplete="email" required></label>
    </div>
    <label>Topic<select name="topic">
      <option>General question</option><option>Bug report</option><option>Business / advertising</option><option>Copyright (DMCA)</option><option>Feature request</option>
    </select></label>
    <label>Message<textarea name="msg" rows="6" maxlength="4000" required placeholder="If something did not download, include the link you used."></textarea></label>
    <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="t" value="${Date.now()}">
    <button class="cbtn" type="submit">Send message</button>
    <p class="cnote" id="cnote" role="status"></p>
  </form>
  ${mail ? `<p class="cmail">Prefer email? Write to <a href="mailto:${esc(mail)}">${esc(mail)}</a></p>` : ""}`;
  return `<section class="prose doc">
  <h1>${esc(d.title)}</h1>
  ${slug === "contact" ? "" : `<p class="updated">Last updated ${fmtDate(d.updated || "2026-11-21")}</p>`}
  <div class="mdx">${md(d.md)}</div>
  ${form}
</section>`;
}

function fmtDate(s) {
  const d = new Date(String(s) + "T00:00:00Z");
  return isNaN(d) ? esc(s) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function blogListBody(list) {
  return `<section class="prose doc">
  <h1>Blog</h1>
  <p class="lead">Guides on saving Instagram content, and fixes for the problems that come up along the way.</p>
  <div class="postlist">
  ${list.map((b) => `<a class="postcard${b.cover ? " hasimg" : ""}" href="/blog/${b.slug}">${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" decoding="async">` : ""}<div><h3>${esc(b.title)}</h3><p>${esc(b.desc)}</p><span>${fmtDate(b.date)} · ${Math.max(1, Math.round((b.words || 0) / 200))} min read</span></div></a>`).join("") || "<p>No posts yet.</p>"}
  </div>
</section>`;
}

const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

function midAd(html, cfg) {
  const ad = adSlot(cfg, "in_content");
  if (!ad) return html;
  const parts = html.split(/(?=<h2)/);
  if (parts.length < 4) return html + ad;
  parts.splice(2, 0, ad);
  return parts.join("");
}

function postBody(p, more, origin, cfg) {
  const toc = headings(p.md);
  const mins = Math.max(1, Math.round(plain(p.md).split(" ").length / 200));
  const url = origin + "/blog/" + p.slug;
  return `<article class="prose doc post">
  <nav class="crumbs"><a href="/">Home</a> › <a href="/blog">Blog</a></nav>
  <h1>${esc(p.title)}</h1>
  <p class="updated">${fmtDate(p.date)}${p.updated && p.updated !== p.date ? " · Updated " + fmtDate(p.updated) : ""} · ${mins} min read</p>
  ${p.cover ? `<img class="pcover" src="${esc(p.cover)}" alt="${esc(p.title)}" decoding="async">` : ""}
  ${toc.length >= 3 ? `<details class="toc" open><summary>In this guide</summary><ol>${toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ol></details>` : ""}
  <div class="mdx">${midAd(md(p.md), cfg)}</div>
  ${adSlot(cfg, "sidebar", "", "only-desktop")}
  <div class="cta"><h3>Try it now</h3><p>Paste a link on the <a href="/">downloader</a> and save the file in a few seconds.</p></div>
  ${more && more.length ? `<h2 class="morehd">Keep reading</h2><div class="postlist">${more.map((b) => `<a class="postcard" href="/blog/${b.slug}"><div><h3>${esc(b.title)}</h3><p>${esc(b.desc)}</p></div></a>`).join("")}</div>` : ""}
</article>
${ld({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.desc,
    datePublished: p.date,
    dateModified: p.updated || p.date,
    mainEntityOfPage: url,
    image: p.cover ? abs(origin, p.cover) : origin + "/og.jpg",
    author: { "@type": "Organization", name: cfg.brand.name, url: origin },
    publisher: { "@type": "Organization", name: cfg.brand.name, logo: { "@type": "ImageObject", url: origin + "/icon-512.png" } },
  })}
${ld({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin + "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: origin + "/blog" },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ],
  })}`;
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

/* ===================== app config for the client ===================== */

function appConfig(cfg) {
  const a = cfg.app || {};
  const b = a.banner || {};
  const p = a.push || {};
  const out = {
    banner: {
      enabled: !!b.enabled, title: b.title || "", sub: b.sub || "", button: b.button || "",
      escTitle: b.escTitle || "", escSub: b.escSub || "", escButton: b.escButton || "",
      delaySec: b.delaySec || 4, snoozeDays: b.snoozeDays || 5,
    },
    push: { enabled: !!p.enabled, after: p.after || 1, title: p.title || "", sub: p.sub || "", button: p.button || "" },
    icPhoto: I.photo,
    icPlay: I.playo,
  };
  // inline <script> safety: no closing tags or line separators can break out
  return JSON.stringify(out).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/* ===================== ads ===================== */

/** Slots that only make sense after a download: sent as an inert <template>,
 *  turned into a live ad (scripts and all) when the first result appears. */
function lateSlot(cfg, id) {
  const html = adSlot(cfg, id);
  return html ? `<template class="adlate" data-slot="${id}">${html}</template>` : "";
}

function adSlot(cfg, id, cls = "", wrapCls = "") {
  if (!cfg.settings.adsEnabled) return "";
  const a = cfg.ads[id];
  if (!a || !a.enabled || !a.code.trim()) return "";
  const dev = a.device === "mobile" ? " only-mobile" : a.device === "desktop" ? " only-desktop" : "";
  return `<div class="adzone ${cls}${dev} ${wrapCls}" data-slot="${id}"><span class="adlabel">Advertisement</span>${a.code}</div>`;
}

/* ===================== sitemap / robots ===================== */

export async function sitemap(origin, env) {
  const posts = await listPosts(env);
  const urls = [
    ...Object.values(TOOLS).map((t) => ({ loc: origin + "/" + t.slug, p: t.slug ? "0.9" : "1.0" })),
    { loc: origin + "/blog", p: "0.7", m: posts[0] && posts[0].updated },
    ...posts.map((b) => ({ loc: origin + "/blog/" + b.slug, p: "0.6", m: b.updated || b.date })),
    ...PAGE_KEYS.map((k) => ({ loc: origin + "/" + k, p: "0.3" })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc.replace(/\/$/, "") || origin}</loc><lastmod>${u.m || today}</lastmod><changefreq>weekly</changefreq><priority>${u.p}</priority></url>`).join("\n")}
</urlset>`;
}

export function robots(origin) {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /dl
Disallow: /stream
Disallow: /img
Disallow: /share

Sitemap: ${origin}/sitemap.xml`;
}

/* ===================== assets ===================== */

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".5" stop-color="#f9377d"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><path d="M16 8v10m0 0l-4-4m4 4l4-4M9.5 23.5h13" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
  );

/* Minimal line icons, drawn here rather than loaded — no icon-font request,
   and they inherit the text colour so they work in both themes. */
const sv = (b, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${b}</svg>`;

const I = {
  mark:
    '<svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".5" stop-color="#f9377d"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#bm)"/><path d="M16 8v10m0 0l-4-4m4 4l4-4M9.5 23.5h13" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: sv('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>'),
  moon: sv('<path d="M20 14.5A8.2 8.2 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z"/>'),
  paste: sv('<rect x="8" y="3.5" width="8" height="4" rx="1.4"/><path d="M16 5.5h2a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h2"/>'),
  play: '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8.4 5.2a1 1 0 0 1 1.52-.86l9 6.8a1 1 0 0 1 0 1.72l-9 6.8A1 1 0 0 1 8.4 18.8z"/></svg>',
  download: sv('<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/>'),
  heart: sv('<path d="M12 20s-7-4.5-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-1.2c0 4.7-7 13.2-7 13.2Z"/>'),
  comment: sv('<path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4.5 20l1.3-4.4A7.5 7.5 0 1 1 20 12Z"/>'),
  eye: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  clock: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  hist: sv('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 8v4.2l2.8 1.8"/>'),
  playo: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M10.2 9.4v5.2l4.4-2.6z" fill="currentColor" stroke="none"/>'),
  photo: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.2a2 2 0 0 1 2.7 0L20 19.5"/>'),
};

const CSS = `
:root{--bg:#0a0a0f;--bg2:#101017;--card:#15151d;--line:#26262f;--fg:#f2f2f5;--mut:#8e8e9c;
--a1:#ff8a3d;--a2:#f9377d;--a3:#8a3ffc;--ok:#2bd97c;--grad:linear-gradient(100deg,var(--a1),var(--a2) 48%,var(--a3));--sh:0 10px 30px rgba(0,0,0,.4);
--ease:cubic-bezier(.22,1,.36,1)}
[data-theme=light]{--bg:#fbfbfd;--bg2:#f2f2f6;--card:#fff;--line:#e7e7ee;--fg:#14141a;--mut:#6c6c7a;--sh:0 8px 26px rgba(20,20,40,.09)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--fg);
font-family:"Google Sans","Google Sans Text","Product Sans",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
font-size:16px;line-height:1.65;font-weight:400;letter-spacing:-.011em;
-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow-x:hidden}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}
body::before{content:"";position:fixed;inset:0 0 auto;height:60vh;pointer-events:none;z-index:-1;
background:radial-gradient(70vw 50vh at 50% -15%,rgba(249,55,125,.18),transparent 70%),radial-gradient(50vw 40vh at 88% 0,rgba(138,63,252,.16),transparent 70%)}
[data-theme=light] body::before{background:radial-gradient(70vw 50vh at 50% -18%,rgba(249,55,125,.1),transparent 70%),radial-gradient(50vw 40vh at 88% 0,rgba(138,63,252,.09),transparent 70%)}
main{max-width:860px;margin:0 auto;padding:0 18px 70px}
a{color:inherit}
/* nav */
.nav{max-width:860px;margin:0 auto;padding:16px 18px;display:flex;align-items:center;gap:14px}
.brand{font-size:19px;font-weight:700;letter-spacing:-.5px;text-decoration:none;display:flex;align-items:center;gap:9px}
.brand b{font-weight:700;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.mark{width:28px;height:28px;flex:none;display:block;filter:drop-shadow(0 3px 9px rgba(249,55,125,.3))}
.links{display:flex;gap:18px;margin-left:auto;font-size:14px;font-weight:500}
.links a{color:var(--mut);text-decoration:none;transition:color .2s var(--ease)}
.links a:hover{color:var(--fg)}
.themebtn{background:var(--card);border:1px solid var(--line);color:var(--mut);width:36px;height:36px;border-radius:11px;cursor:pointer;flex:none;display:grid;place-items:center;transition:border-color .2s,transform .2s var(--ease)}
.themebtn:active{transform:scale(.92)}
.themebtn svg{width:17px;height:17px}
.nact{display:flex;align-items:center;gap:8px;margin-left:14px;flex:none}
@media(max-width:620px){.nact{margin-left:auto}}
.themebtn{position:relative;overflow:hidden}
.themebtn .ti{position:absolute;inset:0;display:grid;place-items:center;transition:transform .55s cubic-bezier(.34,1.56,.64,1),opacity .35s ease}
[data-theme=dark] .ti-sun,[data-theme=light] .ti-moon{opacity:0;transform:rotate(-120deg) scale(.3)}
[data-theme=dark] .ti-moon,[data-theme=light] .ti-sun{opacity:1;transform:none}
.ti-sun{color:#f5a524}
.themebtn.tb-pop{animation:tbpop .55s cubic-bezier(.34,1.56,.64,1)}
@keyframes tbpop{0%{transform:scale(1)}35%{transform:scale(.82)}100%{transform:scale(1)}}
html.theme-fade,html.theme-fade *,html.theme-fade *::before{transition:background-color .45s ease,color .45s ease,border-color .45s ease,box-shadow .45s ease!important}
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
::view-transition-new(root){animation:igReveal .6s cubic-bezier(.65,0,.35,1)}
@keyframes igReveal{from{clip-path:circle(0 at var(--tx,100%) var(--ty,0))}to{clip-path:circle(var(--tr,150vmax) at var(--tx,100%) var(--ty,0))}}
@media (prefers-reduced-motion:reduce){::view-transition-new(root){animation:none}.themebtn .ti{transition:none}}
@media(max-width:620px){.links{display:none}}
/* hero */
.hero{text-align:center;padding:34px 0 8px}
h1{font-size:36px;line-height:1.12;letter-spacing:-1.3px;font-weight:700}
@media(max-width:620px){h1{font-size:28px;letter-spacing:-1px}}
.sub{color:var(--mut);margin-top:13px;font-size:15.5px;font-weight:400;max-width:520px;margin-inline:auto}
.searchbar{display:flex;gap:8px;margin-top:26px;background:var(--card);border:1px solid var(--line);border-radius:17px;padding:8px;box-shadow:var(--sh);
transition:border-color .25s var(--ease),box-shadow .25s var(--ease)}
.searchbar:focus-within{border-color:rgba(249,55,125,.55);box-shadow:0 0 0 4px rgba(249,55,125,.09),var(--sh)}
.searchbar input{flex:1;min-width:0;background:transparent;border:0;color:var(--fg);font-size:15px;font-weight:500;padding:12px 10px;outline:none;font-family:inherit}
.searchbar input::placeholder{color:var(--mut);font-weight:400}
.pastebtn{background:var(--bg2);border:1px solid var(--line);color:var(--mut);border-radius:11px;padding:0 12px;cursor:pointer;font-family:inherit;display:grid;place-items:center;transition:color .2s,transform .18s var(--ease)}
.pastebtn:active{transform:scale(.93)}
.pastebtn svg{width:17px;height:17px}
.searchbar button[type=submit]{position:relative;overflow:hidden;background:var(--grad);border:0;color:#fff;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px;cursor:pointer;font-family:inherit;min-width:122px;
box-shadow:0 6px 18px rgba(249,55,125,.3);transition:transform .18s var(--ease),box-shadow .25s var(--ease)}
.searchbar button[type=submit]::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;
background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);animation:sheen 3.6s var(--ease) infinite}
@keyframes sheen{0%{left:-60%}38%{left:130%}100%{left:130%}}
.searchbar button[type=submit]:active{transform:scale(.97)}
.searchbar button:disabled{opacity:.65}
.searchbar button:disabled::after{animation:none}
.trust{color:var(--mut);font-size:12.5px;margin-top:13px;font-weight:500}
/* result */
#out{margin-top:22px}
.result{background:var(--card);border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:var(--sh);animation:rise .5s var(--ease) both}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
.preview{position:relative;background:#06060a;display:flex;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.preview img,.preview video{width:100%;max-width:400px;max-height:66vh;object-fit:cover;display:block;transition:transform .6s var(--ease)}
.preview video{background:#000}
.preview:not(.playing):active img{transform:scale(.985)}
.preview.playing img{display:none}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.26),transparent 32%,transparent 60%,rgba(0,0,0,.48));pointer-events:none;transition:opacity .4s var(--ease)}
.preview.playing .shade{opacity:0}
.playpill{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:66px;height:66px;border-radius:50%;
background:rgba(14,14,20,.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:grid;place-items:center;
border:1.5px solid rgba(255,255,255,.3);box-shadow:0 8px 30px rgba(0,0,0,.42);transition:transform .35s var(--ease),opacity .3s var(--ease)}
.playpill svg{width:24px;height:24px;margin-left:3px}
.playpill::before{content:"";position:absolute;inset:-9px;border-radius:50%;border:1.5px solid rgba(255,255,255,.22);animation:pulse 2.6s var(--ease) infinite}
@keyframes pulse{0%{transform:scale(.9);opacity:.75}70%{transform:scale(1.22);opacity:0}100%{opacity:0}}
.preview:active .playpill{transform:translate(-50%,-50%) scale(.9)}
.preview.playing .playpill{opacity:0;pointer-events:none;transform:translate(-50%,-50%) scale(1.5)}
.taphint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(14,14,20,.55);backdrop-filter:blur(8px);
color:#fff;font-size:11.5px;font-weight:600;padding:5px 13px;border-radius:20px;white-space:nowrap;border:1px solid rgba(255,255,255,.14);transition:opacity .3s var(--ease)}
.preview.playing .taphint{opacity:0}
.dur{position:absolute;right:12px;top:12px;background:rgba(14,14,20,.6);backdrop-filter:blur(8px);color:#fff;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.12)}
.rbody{padding:17px}
.who{display:flex;align-items:center;gap:11px}
.who .av{width:42px;height:42px;border-radius:50%;flex:none;padding:2px;background:var(--grad)}
.who .av img{width:100%;height:100%;border-radius:50%;object-fit:cover;background:var(--bg2);display:block;border:2px solid var(--card)}
.who .nm{font-weight:700;font-size:15px;letter-spacing:-.3px}
.who .fn{color:var(--mut);font-size:12.5px;font-weight:400}
.cap{margin-top:13px;font-size:14px;line-height:1.6;color:var(--fg);opacity:.9;white-space:pre-wrap;word-break:break-word;max-height:76px;overflow:hidden;transition:max-height .45s var(--ease)}
.cap.open{max-height:620px}
.capmore{color:var(--a2);font-size:13px;font-weight:600;background:none;border:0;cursor:pointer;padding:5px 0;font-family:inherit}
.stats{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:6px 11px;font-size:12.5px;color:var(--mut);font-weight:500}
.chip svg{width:13px;height:13px;opacity:.75}
.chip b{color:var(--fg);font-weight:700}
.dls{margin-top:15px;display:grid;gap:9px}
.gal{position:relative;background:#06060a}
.gtrack{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.gtrack::-webkit-scrollbar{display:none}
.gslide{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;flex-direction:column}
.gslide .preview{flex:1}
.gslide .preview img,.gslide .preview video{width:100%;max-width:none;height:auto;aspect-ratio:1/var(--gr,1.25);max-height:62vh;object-fit:contain;background:#06060a}
.gslide .preview .nothumb{aspect-ratio:1/var(--gr,1.25);height:auto;max-height:62vh}
.gdl{padding:10px 12px 0}
.gdl .dl{padding:13px 15px}
.gnum{position:absolute;left:12px;top:12px;display:flex;align-items:center;gap:5px;background:rgba(14,14,20,.62);backdrop-filter:blur(8px);color:#fff;font-size:12px;font-weight:700;padding:5px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.14)}
.gnum svg{width:13px;height:13px}
.garr{position:absolute;top:var(--gy,40%);transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(14,14,20,.55);backdrop-filter:blur(8px);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:grid;place-items:center;padding-bottom:3px;z-index:3;transition:opacity .2s}
.garr:disabled{opacity:0;pointer-events:none}
.gprev{left:10px}.gnext{right:10px}
@media(hover:none){.garr{width:34px;height:34px;font-size:22px}}
.gdots{display:flex;justify-content:center;gap:6px;padding:12px 0 4px;flex-wrap:wrap}
.gdots button{width:7px;height:7px;border-radius:5px;border:0;padding:0;background:rgba(140,140,156,.45);cursor:pointer;transition:width .3s var(--ease),background .3s}
.gdots button.on{width:22px;background:var(--a2)}
.gsum{text-align:center;font-size:12.5px;color:var(--mut);padding:2px 12px 12px}
.nothumb{width:100%;height:240px;display:grid;place-items:center;color:var(--mut)}.nothumb svg{width:34px;height:34px}
.dlall{border:0;cursor:pointer;font:inherit;font-weight:700;width:100%}
.dlall.pulse{animation:dlp 1.4s ease-in-out 3}
@keyframes dlp{50%{transform:scale(1.03);box-shadow:0 0 0 6px rgba(249,55,125,.25)}}
.dlall[disabled]{opacity:.85;cursor:wait}
.glist{display:grid;gap:7px}
.gli{display:grid;grid-template-columns:48px 1fr auto;gap:11px;align-items:center;text-decoration:none;color:var(--fg);background:var(--bg2);border:1px solid var(--line);border-radius:13px;padding:7px 13px 7px 7px;transition:border-color .2s,transform .15s}
.gli:active{transform:scale(.98)}
.gli:hover{border-color:var(--a2)}
.gth{position:relative;width:48px;height:48px;border-radius:9px;overflow:hidden;background:#06060a;display:block}
.gth img{width:100%;height:100%;object-fit:cover;display:block}
.gth b{position:absolute;left:3px;bottom:3px;background:rgba(0,0,0,.65);color:#fff;font-size:10.5px;padding:1px 5px;border-radius:5px}
.gtx{font-weight:650;font-size:14.5px;display:grid}.gtx small{color:var(--mut);font-weight:500;font-size:12px;margin-top:2px}
.gli svg{width:19px;height:19px;color:var(--mut)}
.dl{text-decoration:none;display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--grad);color:#fff;border-radius:14px;padding:15px 17px;font-weight:700;font-size:14.5px;letter-spacing:-.2px;
box-shadow:0 6px 20px rgba(249,55,125,.26);transition:transform .18s var(--ease)}
.dl:active{transform:scale(.985)}
.dl .lbl{display:flex;align-items:center;gap:9px}
.dl .lbl svg{width:17px;height:17px}
.dl.alt{background:var(--bg2);border:1px solid var(--line);color:var(--fg);box-shadow:none}
.dl i{font-style:normal;font-weight:600;opacity:.82;font-size:12.5px}
.err{background:rgba(249,55,125,.08);border:1px solid rgba(249,55,125,.3);color:var(--fg);padding:16px 18px;border-radius:16px;font-size:14.5px;line-height:1.6;animation:rise .4s var(--ease) both}
.err b{display:block;margin-bottom:5px;font-weight:700}
.skel{background:var(--card);border:1px solid var(--line);border-radius:22px;height:260px;position:relative;overflow:hidden}
.skel::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent,rgba(255,255,255,.05),transparent);animation:shim 1.3s linear infinite}
@keyframes shim{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
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
.postcard.hasimg{display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:center;padding:12px}
.postcard.hasimg img{width:120px;height:80px;object-fit:cover;border-radius:11px;display:block}
@media(max-width:520px){.postcard.hasimg{grid-template-columns:1fr}.postcard.hasimg img{width:100%;height:auto;aspect-ratio:16/9}}
.crumbs{font-size:13px;color:var(--mut);margin-bottom:12px}.crumbs a{color:var(--mut);text-decoration:none}.crumbs a:hover{color:var(--fg)}
.pcover{width:100%;height:auto;border-radius:16px;margin:6px 0 20px;display:block;border:1px solid var(--line)}
.toc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 16px;margin:4px 0 20px}
.toc summary{font-weight:700;cursor:pointer;font-size:14.5px}
.toc ol{margin:10px 0 2px 18px;display:grid;gap:5px}.toc a{color:var(--mut);font-size:14px;text-decoration:none}.toc a:hover{color:var(--fg)}
.mdx h2{scroll-margin-top:80px}
.mdx h3{font-size:17px;margin:20px 0 6px}
.mdx p,.mdx li{color:var(--mut);font-size:15.5px;line-height:1.75}
.mdx p{margin:0 0 14px}
.mdx ul,.mdx ol{margin:0 0 16px 22px;display:grid;gap:6px}
.mdx strong{color:var(--fg)}
.mdx a{color:var(--a2);font-weight:600}
.mdx blockquote{border-left:3px solid var(--a2);background:var(--card);border-radius:0 12px 12px 0;padding:12px 16px;margin:0 0 16px}
.mdx blockquote p{margin:0}
.mdx figure{margin:6px 0 18px}.mdx img{max-width:100%;height:auto;border-radius:14px;display:block}
.mdx figcaption{font-size:13px;color:var(--mut);text-align:center;margin-top:7px}
.mdx code{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:.9em}
.mdx hr{border:0;border-top:1px solid var(--line);margin:22px 0}
.morehd{margin-top:36px}
.cform{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:grid;gap:12px}
.cform label{display:grid;gap:6px;font-size:13.5px;font-weight:600}
.cform input,.cform select,.cform textarea{width:100%;font:inherit;font-size:15px;font-weight:400;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px 13px;outline:none;transition:border-color .2s}
.cform input:focus,.cform select:focus,.cform textarea:focus{border-color:var(--a2)}
.cform textarea{resize:vertical;min-height:130px}
.cgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.cgrid{grid-template-columns:1fr}}
.cform .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.cbtn{border:0;cursor:pointer;color:#fff;font:inherit;font-weight:700;font-size:15.5px;padding:13px 22px;border-radius:13px;background:var(--grad);justify-self:start}
.cbtn[disabled]{opacity:.6;cursor:wait}
.cnote{font-size:14px;margin:0;min-height:1em}.cnote.ok{color:#2bd97c}.cnote.bad{color:#f9377d}
.cmail{margin-top:14px;font-size:14.5px}.cmail a{color:var(--a2);font-weight:600}
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
var ICON={
 play: '${I.play}',
 dl: '${I.download}',
 heart: '${I.heart}',
 cmt: '${I.comment}',
 eye: '${I.eye}',
 clock: '${I.clock}',
 photo: '${I.photo}'
};
var T=localStorage.getItem('th');if(T)document.documentElement.dataset.theme=T;
function paintBar(t){document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.setAttribute('content',t==='light'?'#fbfbfd':'#0a0a0f')})}
paintBar(document.documentElement.dataset.theme);
var tb=document.getElementById('themebtn');
if(tb)tb.onclick=function(){
  var d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark';
  function apply(){d.dataset.theme=n;paintBar(n);try{localStorage.setItem('th',n)}catch(e){}}
  tb.classList.remove('tb-pop');void tb.offsetWidth;tb.classList.add('tb-pop');
  var r=tb.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(document.startViewTransition&&!reduce){
    d.style.setProperty('--tx',x+'px');d.style.setProperty('--ty',y+'px');
    d.style.setProperty('--tr',Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+'px');
    document.startViewTransition(apply);
  }else{
    d.classList.add('theme-fade');apply();setTimeout(function(){d.classList.remove('theme-fade')},500);
  }
};

function lateAds(){
  var ts=document.querySelectorAll('template.adlate');
  for(var i=0;i<ts.length;i++){(function(t){
    var frag=t.content.cloneNode(true), box=document.createElement('div');
    box.appendChild(frag);
    var ss=box.querySelectorAll('script');
    for(var k=0;k<ss.length;k++){var o=ss[k],n=document.createElement('script');for(var a=0;a<o.attributes.length;a++)n.setAttribute(o.attributes[a].name,o.attributes[a].value);n.text=o.text;o.parentNode.replaceChild(n,o)}
    while(box.firstChild)t.parentNode.insertBefore(box.firstChild,t);
    t.remove();
  })(ts[i])}
}
var cf=document.getElementById('cform');
if(cf)cf.onsubmit=function(e){
  e.preventDefault();var n=document.getElementById('cnote'),b=cf.querySelector('.cbtn'),fd=new FormData(cf),o={};
  fd.forEach(function(v,k){o[k]=v});
  if(!o.name.trim()||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email)||o.msg.trim().length<10){n.className='cnote bad';n.textContent='Please fill in your name, a valid email and a message of at least 10 characters.';return}
  b.disabled=true;n.className='cnote';n.textContent='Sending...';
  fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)}).then(function(r){return r.json()}).then(function(d){
    if(d.ok){cf.reset();n.className='cnote ok';n.textContent='Thanks! Your message has been sent. We usually reply within a couple of days.'}
    else{n.className='cnote bad';n.textContent=d.error||'Could not send right now. Please try again.'}
  }).catch(function(){n.className='cnote bad';n.textContent='Could not send right now. Please check your connection.'}).then(function(){b.disabled=false});
};
var f=document.getElementById('f');if(!f)return;
var u=document.getElementById('u'),go=document.getElementById('go'),out=document.getElementById('out');
var goLabel=go.textContent;
var pb=document.getElementById('paste');
if(pb)pb.onclick=function(){
  if(navigator.clipboard&&navigator.clipboard.readText){
    navigator.clipboard.readText().then(function(t){u.value=(t||'').trim();u.focus()}).catch(function(){u.focus()})
  } else u.focus();
};

var q=new URLSearchParams(location.search).get('url');
var SHARED=/[?&]source=share/.test(location.search), autoDl=SHARED;
if(q){u.value=q;setTimeout(function(){f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event('submit',{cancelable:true}))},SHARED?0:180)}

f.onsubmit=function(e){
 e.preventDefault();
 var link=(u.value||'').trim(); if(!link) return;
 go.disabled=true; go.innerHTML='<span class="spin"></span>';
 out.innerHTML='<div class="skel"></div>';
 fetch('/api/resolve?url='+encodeURIComponent(link),{headers:{'x-me':window.__ME||'','x-app':(matchMedia('(display-mode: standalone)').matches?'1':'0')}})
  .then(function(r){return r.json()})
  .then(function(d){
    if(!d.ok){out.innerHTML='<div class="err"><b>'+esc(d.title||'Could not get that one')+'</b>'+esc(d.error||'')+'</div>';return}
    draw(d);
    try{document.dispatchEvent(new CustomEvent('igto:resolved',{detail:d}))}catch(x){}
    lateAds();
    if(window.gtag)gtag('event','download_resolved',{method:d.via});
  })
  .catch(function(){out.innerHTML='<div class="err"><b>Network problem</b>Check your connection and try again.</div>'})
  .then(function(){go.disabled=false;go.textContent=goLabel});
};

function slideHtml(x,i,total,multi){
 var h='<div class="preview'+(multi?' gp':'')+'"'+(x.play?' data-src="'+x.play+'"':'')+'>';
 if(x.thumb)h+='<img src="'+x.thumb+'" alt="" '+(i<2?'loading="eager"':'loading="lazy"')+' decoding="async">';
 else h+='<div class="nothumb">'+(x.type==='image'?ICON.photo:ICON.play)+'</div>';
 h+='<span class="shade"></span>';
 if(x.type==='video'){h+='<span class="playpill">'+ICON.play+'</span><span class="taphint">Tap to preview</span>';}
 if(x.duration)h+='<span class="dur">'+fmtDur(x.duration)+'</span>';
 if(multi)h+='<span class="gnum">'+(x.type==='image'?ICON.photo:ICON.play)+(i+1)+' / '+total+'</span>';
 h+='</div>';
 return h;
}
function dlBtn(x,i,total,alt){
 var label=(x.type==='image'?'Download photo':'Download video')+(total>1?' '+(i+1):'');
 return '<a class="dl'+(alt?' alt':'')+'" href="'+x.url+'" download>'+
   '<span class="lbl">'+(x.type==='image'?ICON.photo:ICON.dl)+esc(label)+'</span><i>'+esc(x.quality)+'</i></a>';
}

function draw(d){
 var N=d.items.length, multi=N>1;
 var h='<div class="result">';
 if(!multi){
   if(d.items[0].thumb)h+=slideHtml(d.items[0],0,1,false);
 }else{
   var nv=0,np=0;d.items.forEach(function(x){x.type==='image'?np++:nv++});
   var gr=0;d.items.forEach(function(x){if(x.width&&x.height)gr=Math.max(gr,x.height/x.width)});gr=Math.min(1.8,Math.max(.56,gr||1.25));
   h+='<div class="gal" id="gal" style="--gr:'+gr.toFixed(3)+'"><div class="gtrack" id="gtrack">';
   for(var i=0;i<N;i++)h+='<div class="gslide" data-i="'+i+'">'+slideHtml(d.items[i],i,N,true)+'<div class="gdl">'+dlBtn(d.items[i],i,N,false)+'</div></div>';
   h+='</div><button class="garr gprev" aria-label="Previous">&#8249;</button><button class="garr gnext" aria-label="Next">&#8250;</button>';
   h+='<div class="gdots">';for(var j=0;j<N;j++)h+='<button data-g="'+j+'" aria-label="Item '+(j+1)+'"'+(j?'':' class="on"')+'></button>';h+='</div>';
   h+='<div class="gsum">'+N+' items in this post'+(nv&&np?' · '+nv+' video'+(nv>1?'s':'')+', '+np+' photo'+(np>1?'s':''):'')+' — swipe to see each one</div></div>';
 }

 h+='<div class="rbody">';
 h+='<div class="who">'+(d.avatar?'<span class="av"><img src="'+d.avatar+'" alt=""></span>':'')+
    '<div><div class="nm">@'+esc(d.username||'instagram')+'</div>'+
    (d.fullName?'<div class="fn">'+esc(d.fullName)+'</div>':'')+'</div></div>';
 if(d.caption){
   h+='<div class="cap" id="cap">'+esc(d.caption)+'</div>';
   if(d.caption.length>150)h+='<button class="capmore" id="capmore">Show more</button>';
 }
 var c=[];
 if(d.likes!=null)c.push(chip(ICON.heart,n(d.likes),'likes'));
 if(d.comments!=null)c.push(chip(ICON.cmt,n(d.comments),'comments'));
 if(d.views!=null)c.push(chip(ICON.eye,n(d.views),'views'));
 if(d.takenAt)c.push('<span class="chip">'+ICON.clock+new Date(d.takenAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'</span>');
 if(c.length)h+='<div class="stats">'+c.join('')+'</div>';

 h+='<div class="dls">';
 if(multi){
   h+='<button type="button" class="dl dlall" id="dlall"><span class="lbl">'+ICON.dl+'Download all '+N+'</span><i>one by one</i></button>';
   h+='<div class="glist">';
   for(var k=0;k<N;k++){var x=d.items[k];
     h+='<a class="gli" href="'+x.url+'" download data-k="'+k+'"><span class="gth">'+(x.thumb?'<img src="'+x.thumb+'" alt="" loading="lazy">':'')+'<b>'+(k+1)+'</b></span><span class="gtx">'+(x.type==='image'?'Photo':'Video')+' '+(k+1)+'<small>'+esc(x.quality)+(x.duration?' · '+fmtDur(x.duration):'')+'</small></span>'+ICON.dl+'</a>';}
   h+='</div>';
 }else h+=dlBtn(d.items[0],0,1,false);
 h+='</div></div></div>';

 out.innerHTML=h;
 wire(d);
 /* opened by sharing from Instagram: start the download straight away (once) */
 if(autoDl){autoDl=false;
   if(!multi){var a1=out.querySelector('a.dl');if(a1){a1.click();var lb=a1.querySelector('.lbl');if(lb){var o=lb.innerHTML;lb.innerHTML='<span class="spin"></span> Downloading…';setTimeout(function(){lb.innerHTML=o},3500)}}}
   else{var all=document.getElementById('dlall');if(all)all.classList.add('pulse')}
 }
 out.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function wire(d){
 var pvs=out.querySelectorAll('.preview[data-src]');
 Array.prototype.forEach.call(pvs,function(pv){
   pv.addEventListener('click',function(){
     if(pv.classList.contains('playing'))return;
     Array.prototype.forEach.call(out.querySelectorAll('.preview.playing video'),function(v){v.pause()});
     var v=document.createElement('video');
     v.src=pv.dataset.src; v.controls=true; v.autoplay=true; v.playsInline=true;
     v.setAttribute('playsinline',''); v.preload='auto';
     pv.appendChild(v);
     pv.classList.add('playing');
     var p=v.play(); if(p&&p.catch)p.catch(function(){});
     if(window.gtag)gtag('event','preview_play');
   });
 });
 var cm=document.getElementById('capmore');
 if(cm)cm.onclick=function(){
   var cap=document.getElementById('cap');
   var open=cap.classList.toggle('open');
   cm.textContent=open?'Show less':'Show more';
 };
 var links=out.querySelectorAll('a.dl,a.gli');
 for(var i=0;i<links.length;i++)links[i].addEventListener('click',function(){if(window.gtag)gtag('event','download_click')});

 var tr=document.getElementById('gtrack'); if(!tr) return;
 var dots=out.querySelectorAll('.gdots button'), N=dots.length, cur=0;
 function place(){var pv=tr.querySelector('.preview');if(pv)document.getElementById('gal').style.setProperty('--gy',(pv.offsetHeight/2)+'px')}
 place();window.addEventListener('resize',place);
 Array.prototype.forEach.call(tr.querySelectorAll('.preview img'),function(im){im.addEventListener('load',place,{once:true})});
 function go(i){i=Math.max(0,Math.min(N-1,i));tr.scrollTo({left:i*tr.clientWidth,behavior:'smooth'})}
 function mark(){
   var i=Math.round(tr.scrollLeft/Math.max(1,tr.clientWidth)); if(i===cur)return; cur=i;
   for(var k=0;k<N;k++)dots[k].classList.toggle('on',k===i);
   out.querySelector('.gprev').disabled=i===0; out.querySelector('.gnext').disabled=i===N-1;
   Array.prototype.forEach.call(tr.querySelectorAll('video'),function(v){v.pause()});
 }
 var t;tr.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(mark,60)},{passive:true});
 out.querySelector('.gprev').onclick=function(){go(cur-1)};
 out.querySelector('.gnext').onclick=function(){go(cur+1)};
 out.querySelector('.gprev').disabled=true;
 Array.prototype.forEach.call(dots,function(b){b.onclick=function(){go(+b.dataset.g)}});
 Array.prototype.forEach.call(out.querySelectorAll('a.gli'),function(a){a.addEventListener('mouseenter',function(){},{passive:true})});
 var all=document.getElementById('dlall');
 if(all)all.onclick=function(){
   if(all.disabled)return; all.disabled=true;
   var lb=all.querySelector('.lbl'), base=lb.innerHTML, k=0;
   (function next(){
     if(k>=d.items.length){lb.innerHTML=ICON.dl+'All '+d.items.length+' started ✓';setTimeout(function(){lb.innerHTML=base;all.disabled=false},4000);return}
     lb.innerHTML='<span class="spin"></span> Saving '+(k+1)+' of '+d.items.length;
     var a=document.createElement('a');a.href=d.items[k].url;a.setAttribute('download','');a.style.display='none';document.body.appendChild(a);a.click();a.remove();
     k++;setTimeout(next,1400);
   })();
   if(window.gtag)gtag('event','download_all',{count:d.items.length});
 };
}

function chip(icon,val,word){return '<span class="chip">'+icon+'<b>'+val+'</b> '+word+'</span>'}
function n(v){return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':String(v)}
function fmtDur(s){s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
})();
`;
