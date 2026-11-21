/**
 * app.js — the installable-app layer of the public site.
 *
 * Design rule: nothing here may slow down or change what a normal browser
 * visitor (or Googlebot) sees. Everything app-only is gated on
 * display-mode: standalone; the banner is a fixed overlay (zero layout
 * shift) that only appears after a successful download or on a return
 * visit, never on first paint.
 */

/* ===================== manifest ===================== */

export function siteManifest(cfg, origin) {
  const name = cfg.brand.name;
  return JSON.stringify({
    id: "/",
    name: name + " — Instagram Downloader",
    short_name: name,
    description: "Save Instagram reels, videos and photos in HD. Share any reel to the app to download it in one tap.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    categories: ["utilities", "photo", "productivity"],
    icons: [
      { src: origin + "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: origin + "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: origin + "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Instagram -> Share -> this app -> download starts
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Download a reel", short_name: "Reels", url: "/reels?source=shortcut", icons: [{ src: origin + "/icon-192.png", sizes: "192x192" }] },
      { name: "Download a photo", short_name: "Photos", url: "/photo?source=shortcut", icons: [{ src: origin + "/icon-192.png", sizes: "192x192" }] },
    ],
  });
}

/* ===================== share target ===================== */

/** Pull the first Instagram link out of whatever the share sheet sent. */
export function handleShare(url, origin) {
  const bag = [url.searchParams.get("url"), url.searchParams.get("text"), url.searchParams.get("title")].filter(Boolean).join(" ");
  const m = bag.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i);
  const target = m ? origin + "/?url=" + encodeURIComponent(m[0]) + "&source=share" : origin + "/?source=share";
  return new Response(null, {
    status: 302,
    headers: { location: target, "x-robots-tag": "noindex", "cache-control": "no-store" },
  });
}

/* ===================== service worker ===================== */

/**
 * Network-first for pages (so nobody ever sees a stale page), with the last
 * good copy as an offline fallback. Downloads, API calls, ads and analytics
 * are never touched — the worker only steps in for top-level navigations.
 */
export const SITE_SW = `/* IGtoDownload app service worker */
var V = 'igto-app-v1';
var SHELL = ['/', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(V).then(function(c){ return c.addAll(SHELL); }).catch(function(){}));
  self.skipWaiting();
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf('igto-app-') === 0 && k !== V; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (/^\\/(admin|api|dl|stream|img|share)/.test(u.pathname)) return;
  e.respondWith(
    Promise.race([
      fetch(r).then(function(res){
        if (res && res.ok && u.pathname === '/') {
          var copy = res.clone();
          caches.open(V).then(function(c){ c.put('/', copy); });
        }
        return res;
      }),
      new Promise(function(_, rej){ setTimeout(rej, 6000); })
    ]).catch(function(){
      return caches.match(r).then(function(m){ return m || caches.match('/'); });
    })
  );
});

self.addEventListener('push', function(e){
  e.waitUntil((async function(){
    var b = null;
    try { var r = await fetch('/api/broadcast', { cache: 'no-store' }); if (r.ok) b = await r.json(); } catch (x) {}
    if (!b || !b.title) return;
    var opts = {
      body: b.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'igto-news-' + (b.id || 0),
      data: { url: b.url || '/', id: b.id || 0 },
      vibrate: [180, 90, 180]
    };
    if (b.image) opts.image = b.image;
    await self.registration.showNotification(b.title, opts);
  })());
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var d = e.notification.data || {};
  var url = d.url || '/';
  e.waitUntil(Promise.all([
    fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k: 'push_click', id: d.id || 0 }) }).catch(function(){}),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) { list[i].navigate(url); return list[i].focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  ]));
});
`;

/* ===================== head snippet ===================== */

/**
 * Runs before first paint. Only flags the document when running as an
 * installed app; in a normal browser it does nothing at all.
 */
export const APP_HEAD = `<script>(function(){try{var s=window.matchMedia&&matchMedia('(display-mode: standalone)').matches||navigator.standalone;if(!s)return;var d=document.documentElement;d.classList.add('app');if(sessionStorage.getItem('igto_run'))return;sessionStorage.setItem('igto_run','1');var k='igto_launch';var n=+(localStorage.getItem(k)||0);d.classList.add('splash-on',n?'again':'first');localStorage.setItem(k,String(n+1))}catch(e){}})()</script>`;

/* ===================== splash markup ===================== */

export const SPLASH = `<div class="splash" aria-hidden="true">
  <div class="sp-mark">
    <svg viewBox="0 0 32 32" fill="none"><defs><linearGradient id="spg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".5" stop-color="#f9377d"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs>
      <rect width="32" height="32" fill="url(#spg)"/>
      <g class="sp-arrow"><path d="M16 8v10m0 0l-4-4m4 4l4-4" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>
      <path class="sp-base" d="M9.5 23.5h13" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    </svg>
    <span class="sp-sheen"></span>
  </div>
  <div class="sp-word"><b>IGto</b>Download</div>
</div>`;

/* ===================== styles ===================== */

export const APP_CSS = `
/* ---- launch animation: installed app, cold start only ----
   Android shows its own splash (icon on the background colour) before the
   page exists. This one starts from that exact frame — same background,
   icon at the same centre — and carries on, so the two read as one. */
.splash{display:none}
html.splash-on .splash{display:block;position:fixed;inset:0;z-index:9999;background:var(--bg);pointer-events:none;
  animation:spOut .34s cubic-bezier(.22,1,.36,1) forwards;animation-delay:.5s}
html.splash-on.first .splash{animation-delay:1.15s}
@keyframes spOut{to{opacity:0;visibility:hidden}}
.sp-mark{position:absolute;left:50%;top:50%;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:34%;overflow:hidden;
  box-shadow:0 16px 46px rgba(249,55,125,.32)}
.sp-mark svg{width:100%;height:100%;display:block}
.sp-arrow{animation:spDrop .5s cubic-bezier(.22,1,.36,1) .05s both}
@keyframes spDrop{0%{transform:translateY(-3px)}45%{transform:translateY(2px)}100%{transform:none}}
.sp-sheen{position:absolute;top:0;left:-70%;width:45%;height:100%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-18deg);
  animation:spSheen .6s ease .12s forwards}
@keyframes spSheen{to{left:130%}}
.sp-word{position:absolute;left:0;right:0;top:50%;margin-top:78px;text-align:center;font-weight:700;font-size:19px;letter-spacing:-.5px;
  color:var(--fg);opacity:0;animation:spWord .45s ease .35s forwards}
.sp-word b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
@keyframes spWord{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
html.splash-on.again .sp-word{display:none}
@media(prefers-reduced-motion:reduce){html.splash-on .splash{display:none}}

/* ---- install / open-in-chrome banner: fixed, never shifts layout ---- */
.appbar{position:fixed;left:12px;right:12px;bottom:12px;z-index:80;max-width:520px;margin:0 auto;
  background:var(--card);border:1px solid var(--line);border-radius:18px;padding:13px 13px 13px 14px;
  display:flex;align-items:center;gap:12px;box-shadow:0 18px 50px rgba(0,0,0,.45);
  transform:translateY(130%);opacity:0;transition:transform .5s cubic-bezier(.22,1,.36,1),opacity .4s ease}
.appbar.show{transform:none;opacity:1}
.appbar .ab-ic{width:44px;height:44px;border-radius:12px;flex:none;box-shadow:0 6px 16px rgba(249,55,125,.3)}
.appbar .ab-tx{flex:1;min-width:0}
.appbar .ab-tx b{display:block;font-size:14.5px;font-weight:700;letter-spacing:-.2px;line-height:1.3}
.appbar .ab-tx span{display:block;color:var(--mut);font-size:12.5px;line-height:1.45;margin-top:2px}
.appbar .ab-go{background:var(--grad);color:#fff;border:0;border-radius:11px;padding:10px 15px;font-weight:700;font-size:13.5px;
  font-family:inherit;cursor:pointer;white-space:nowrap;box-shadow:0 6px 16px rgba(249,55,125,.3);text-decoration:none}
.appbar .ab-x{background:none;border:0;color:var(--mut);font-size:20px;line-height:1;padding:4px 2px 4px 4px;cursor:pointer;font-family:inherit}
body.has-sticky .appbar{bottom:86px}

/* ---- history sheet ---- */
.histbtn{background:var(--card);border:1px solid var(--line);color:var(--mut);width:36px;height:36px;border-radius:11px;cursor:pointer;flex:none;display:grid;place-items:center;transition:transform .2s cubic-bezier(.22,1,.36,1)}
.histbtn:active{transform:scale(.92)}
.bellbtn{display:none}
html.app .bellbtn{display:grid}
.bellbtn.on{color:var(--acc,#e1306c)}
.appsec{margin:34px 0 8px;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:var(--card);display:grid;grid-template-columns:1.1fr 1fr;align-items:center}
.appsec img{width:100%;height:auto;display:block;aspect-ratio:1200/630;object-fit:cover}
.aps-tx{padding:22px 24px}
.aps-tx h2{margin:0 0 10px;font-size:22px;line-height:1.25}
.aps-tx ul{margin:0 0 16px;padding:0;list-style:none;display:grid;gap:8px}
.aps-tx li{padding-left:24px;position:relative;color:var(--mut);font-size:14.5px;line-height:1.45}
.aps-tx li:before{content:"";position:absolute;left:3px;top:4px;width:11px;height:6px;border:solid #2bd97c;border-width:0 0 2.4px 2.4px;transform:rotate(-45deg)}
.aps-go{display:inline-flex;align-items:center;gap:9px;border:0;cursor:pointer;color:#fff;font:inherit;font-weight:700;font-size:15.5px;padding:13px 22px;border-radius:14px;background:linear-gradient(90deg,#f58529,#dd2a7b 50%,#8134af);box-shadow:0 8px 24px rgba(221,42,123,.3);transition:transform .2s cubic-bezier(.22,1,.36,1)}
.aps-go:active{transform:scale(.96)}
.aps-help{margin:12px 0 0;font-size:13.5px;line-height:1.5;color:var(--mut);background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:10px 12px}
@media(max-width:720px){.appsec{grid-template-columns:1fr}.aps-tx{padding:18px}.aps-go{width:100%;justify-content:center}}
html.app .appsec{display:none}
.histbtn svg{width:17px;height:17px}
.sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90;opacity:0;pointer-events:none;transition:opacity .3s ease}
.sheet-bg.show{opacity:1;pointer-events:auto}
.sheet{position:fixed;left:0;right:0;bottom:0;z-index:91;max-width:620px;margin:0 auto;background:var(--card);
  border-radius:22px 22px 0 0;border:1px solid var(--line);border-bottom:0;max-height:78vh;display:flex;flex-direction:column;
  transform:translateY(105%);transition:transform .45s cubic-bezier(.22,1,.36,1)}
.sheet.show{transform:none}
.sheet .sh-grab{width:38px;height:4px;border-radius:4px;background:var(--line);margin:10px auto 4px}
.sheet .sh-head{display:flex;align-items:center;padding:8px 18px 10px}
.sheet .sh-head b{font-size:16px;font-weight:700}
.sheet .sh-head button{margin-left:auto;background:none;border:0;color:var(--mut);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.sheet .sh-list{overflow:auto;padding:0 12px 18px}
.hrow{display:flex;align-items:center;gap:12px;padding:11px 8px;border-radius:13px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.hrow:active{background:var(--bg2)}
.hrow .hi{width:40px;height:40px;border-radius:11px;background:var(--bg2);border:1px solid var(--line);display:grid;place-items:center;flex:none;color:var(--mut)}
.hrow .hi svg{width:18px;height:18px}
.hrow .ht{flex:1;min-width:0}
.hrow .ht b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hrow .ht span{display:block;color:var(--mut);font-size:12px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hrow .hgo{color:var(--a2);font-size:12.5px;font-weight:700}
.hempty{text-align:center;color:var(--mut);font-size:14px;padding:30px 10px 36px}

/* ---- notify-me chip inside the result ---- */
.notifyme{display:flex;align-items:center;gap:10px;margin-top:12px;padding:12px 13px;border-radius:13px;
  background:var(--bg2);border:1px dashed var(--line);font-size:13px;color:var(--mut)}
.notifyme b{color:var(--fg);font-weight:600}
.notifyme button{margin-left:auto;background:none;border:1px solid var(--line);color:var(--fg);border-radius:10px;padding:7px 11px;font-weight:600;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap}
.pasted{animation:pastedFlash .9s ease}
@keyframes pastedFlash{0%{box-shadow:0 0 0 0 rgba(249,55,125,.5)}100%{box-shadow:0 0 0 12px rgba(249,55,125,0)}}
`;

/* ===================== client script ===================== */

export const APP_JS = `
(function(){
var C = window.__APP || {};
var B = C.banner || {};
var ua = navigator.userAgent || '';
var isAndroid = /Android/i.test(ua);
var inApp = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Line\\/|Twitter|TikTok|musical_ly|Snapchat|Pinterest/i.test(ua);
var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
var deferred = null;
var LS = { get:function(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
           set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}} };

function ev(k, extra){
  try {
    var body = JSON.stringify(Object.assign({ k: k }, extra || {}));
    if (navigator.sendBeacon) navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
    else fetch('/api/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
  } catch (e) {}
  if (window.gtag) gtag('event', k);
}

/* ---------- visits and live presence ----------
   One anonymous id per browser session (sessionStorage, gone when the tab
   closes). One beacon on load, then a light heartbeat every two minutes
   while the page is visible, for at most half an hour. */
var SID = (function(){ try { var s = sessionStorage.getItem('igto_sid'); if (!s) { s = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); sessionStorage.setItem('igto_sid', s); } return s; } catch (e) { return ''; } })();
function presence(t){
  if (!SID) return;
  try {
    var body = JSON.stringify({ t: t, s: SID, p: location.pathname, r: t === 'view' ? document.referrer : '', a: standalone ? 1 : 0 });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/p', new Blob([body], { type: 'application/json' }));
    else fetch('/api/p', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
  } catch (e) {}
}
presence('view');
var beats = 0;
setInterval(function(){ if (!document.hidden && beats < 15) { beats++; presence('beat'); } }, 120000);
document.addEventListener('visibilitychange', function(){ if (!document.hidden) { beats = 0; presence('beat'); } });

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator && !inApp) {
  window.addEventListener('load', function(){ navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(function(){}); });
}

/* ---------- app usage (once per day per device) ---------- */
if (standalone) {
  var today = new Date().toISOString().slice(0, 10);
  if (LS.get('igto_open_day', '') !== today) { LS.set('igto_open_day', today); ev('app_open'); }
  var src = new URLSearchParams(location.search).get('source');
  if (src === 'share') ev('share_in');
}

/* ---------- install banner ---------- */
window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; maybeBanner('ready'); });
window.addEventListener('appinstalled', function(){ ev('install'); hideBanner(); LS.set('igto_installed', 1); });

var visits = LS.get('igto_visits', 0) + 1; LS.set('igto_visits', visits);
if (document.querySelector('.sticky-bottom')) document.body.classList.add('has-sticky');

function snoozed(){ var t = LS.get('igto_banner_x', 0); return t && Date.now() - t < (B.snoozeDays || 5) * 864e5; }

function maybeBanner(reason){
  if (!B.enabled || standalone || !isAndroid || snoozed() || LS.get('igto_installed', 0)) return;
  if (document.getElementById('appbar')) return;
  if (inApp) { if (reason === 'load') setTimeout(function(){ showBanner(true); }, (B.delaySec || 4) * 1000); return; }
  if (!deferred) return;                              // not installable here -> say nothing
  if (reason === 'resolved' || (reason === 'ready' && visits > 1)) setTimeout(function(){ showBanner(false); }, reason === 'resolved' ? 1400 : (B.delaySec || 4) * 1000);
}

function showBanner(escape){
  if (document.getElementById('appbar')) return;
  var el = document.createElement('div');
  el.className = 'appbar'; el.id = 'appbar'; el.setAttribute('role', 'dialog');
  var title = escape ? (B.escTitle || 'Open in Chrome for the app') : (B.title || 'Get the IGtoDownload app');
  var sub = escape ? (B.escSub || 'Instagram\\'s browser cannot install apps. One tap opens this page in Chrome.') : (B.sub || 'Faster and smoother. Share any reel straight to the app to save it.');
  var btn = escape ? (B.escButton || 'Open') : (B.button || 'Install');
  var href = escape ? 'intent://' + location.host + location.pathname + location.search + '#Intent;scheme=https;package=com.android.chrome;end' : '';
  el.innerHTML = '<img class="ab-ic" src="/icon-192.png" alt="">' +
    '<div class="ab-tx"><b></b><span></span></div>' +
    (escape ? '<a class="ab-go" href="' + href + '"></a>' : '<button class="ab-go" type="button"></button>') +
    '<button class="ab-x" type="button" aria-label="Close">\\u00d7</button>';
  el.querySelector('b').textContent = title;
  el.querySelector('span').textContent = sub;
  el.querySelector('.ab-go').textContent = btn;
  document.body.appendChild(el);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('show'); }); });
  ev(escape ? 'banner_escape_shown' : 'banner_shown');

  el.querySelector('.ab-x').onclick = function(){ LS.set('igto_banner_x', Date.now()); hideBanner(); ev('banner_dismiss'); };
  var go = el.querySelector('.ab-go');
  if (!escape) go.onclick = async function(){
    if (!deferred) { hideBanner(); return; }
    deferred.prompt();
    var r = await deferred.userChoice; deferred = null;
    ev(r && r.outcome === 'accepted' ? 'banner_accept' : 'banner_decline');
    if (!r || r.outcome !== 'accepted') LS.set('igto_banner_x', Date.now());
    hideBanner();
  };
  else go.addEventListener('click', function(){ ev('banner_escape_tap'); });
}
function hideBanner(){ var el = document.getElementById('appbar'); if (!el) return; el.classList.remove('show'); setTimeout(function(){ el.remove(); }, 500); }

window.addEventListener('load', function(){ maybeBanner('load'); });

/* ---------- history ---------- */
var HKEY = 'igto_history';
function hist(){ return LS.get(HKEY, []); }
function saveHist(d){
  if (!d || !d.shortcode) return;
  var list = hist().filter(function(x){ return x.c !== d.shortcode; });
  var it = d.items && d.items[0] || {};
  list.unshift({ c: d.shortcode, u: d.username || '', t: (d.caption || '').slice(0, 70), k: it.type || 'video', q: it.quality || '', n: d.items ? d.items.length : 1, d: Date.now() });
  LS.set(HKEY, list.slice(0, 40));
}
function ago(t){ var m = Math.floor((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; if (m < 1440) return Math.floor(m / 60) + 'h ago'; return Math.floor(m / 1440) + 'd ago'; }

var sheetBg, sheet;
function openHistory(){
  if (!sheet) {
    sheetBg = document.createElement('div'); sheetBg.className = 'sheet-bg';
    sheet = document.createElement('div'); sheet.className = 'sheet'; sheet.setAttribute('role', 'dialog');
    sheet.innerHTML = '<div class="sh-grab"></div><div class="sh-head"><b>Recent downloads</b><button type="button" id="hclear">Clear</button></div><div class="sh-list" id="hlist"></div>';
    document.body.appendChild(sheetBg); document.body.appendChild(sheet);
    sheetBg.onclick = closeHistory;
    sheet.querySelector('#hclear').onclick = function(){ LS.set(HKEY, []); renderHistory(); };
  }
  renderHistory();
  requestAnimationFrame(function(){ sheetBg.classList.add('show'); sheet.classList.add('show'); });
}
function closeHistory(){ if (!sheet) return; sheetBg.classList.remove('show'); sheet.classList.remove('show'); }
function renderHistory(){
  var box = document.getElementById('hlist'); var list = hist();
  if (!list.length) { box.innerHTML = '<div class="hempty">Nothing yet. Your downloads will appear here, saved only on this device.</div>'; return; }
  box.innerHTML = '';
  list.forEach(function(x){
    var row = document.createElement('div'); row.className = 'hrow';
    row.innerHTML = '<span class="hi">' + (x.k === 'image' ? (C.icPhoto || '') : (C.icPlay || '')) + '</span>' +
      '<div class="ht"><b></b><span></span></div><span class="hgo">Get</span>';
    row.querySelector('b').textContent = x.u ? '@' + x.u : 'Instagram post';
    row.querySelector('.ht span').textContent = (x.t ? x.t + ' \\u00b7 ' : '') + ago(x.d);
    row.onclick = function(){ closeHistory(); var u = document.getElementById('u'); var f = document.getElementById('f');
      if (u && f) { u.value = 'https://www.instagram.com/p/' + x.c + '/'; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); }
      else location.href = '/?url=' + encodeURIComponent('https://www.instagram.com/p/' + x.c + '/'); };
    box.appendChild(row);
  });
}
var hb = document.getElementById('histbtn'); if (hb) hb.onclick = openHistory;

/* ---------- auto-paste (installed app, only when already permitted) ---------- */
function looksIG(t){ return /instagram\\.com\\/(?:[\\w.\\-]+\\/)?(?:reels?|p|tv|share)\\//i.test(t || ''); }
async function autoPaste(){
  if (!standalone || !navigator.clipboard || !navigator.clipboard.readText || !navigator.permissions) return;
  var u = document.getElementById('u'), f = document.getElementById('f');
  if (!u || !f || u.value) return;
  try {
    var p = await navigator.permissions.query({ name: 'clipboard-read' });
    if (p.state !== 'granted') return;                 // never trigger a permission popup by surprise
    var t = ((await navigator.clipboard.readText()) || '').trim();
    if (!looksIG(t) || LS.get('igto_lastpaste', '') === t) return;
    LS.set('igto_lastpaste', t);
    u.value = t; var bar = u.closest('.searchbar'); if (bar) { bar.classList.remove('pasted'); void bar.offsetWidth; bar.classList.add('pasted'); }
    f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true }));
  } catch (e) {}
}
if (standalone && !new URLSearchParams(location.search).get('url')) setTimeout(autoPaste, 600);
document.addEventListener('visibilitychange', function(){ if (!document.hidden) setTimeout(autoPaste, 250); });

/* ---------- notify-me (offered only after a successful download) ---------- */
function b64u8(b){ var p = '='.repeat((4 - b.length % 4) % 4); var r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); var o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
function offerNotify(){
  var P = C.push || {};
  if (!P.enabled || inApp || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'default') return;
  var asked = LS.get('igto_notify_asked', 0); if (asked && Date.now() - asked < 14 * 864e5) return;
  if (LS.get('igto_ok_downloads', 0) < (P.after || 1)) return;
  var res = document.querySelector('#out .rbody'); if (!res || res.querySelector('.notifyme')) return;
  var box = document.createElement('div'); box.className = 'notifyme';
  box.innerHTML = '<span><b></b> <span></span></span><button type="button"></button>';
  box.querySelector('b').textContent = P.title || 'Get new features first';
  box.querySelector('span span').textContent = P.sub || 'Rare updates, no spam.';
  box.querySelector('button').textContent = P.button || 'Notify me';
  res.appendChild(box);
  box.querySelector('button').onclick = async function(){
    LS.set('igto_notify_asked', Date.now());
    var r = await subscribePush();
    if (r === 'ok') { box.innerHTML = '<span><b>You are in.</b> We will only ping you when it matters.</span>'; ev('notify_accept'); }
    else { box.remove(); if (r === 'denied') ev('notify_decline'); }
  };
}

async function subscribePush(){
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    var reg = await navigator.serviceWorker.register('/app-sw.js', { scope: '/' }); await navigator.serviceWorker.ready;
    var perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    var k = await (await fetch('/api/push/key')).json();
    var key = b64u8(k.key), sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey) {          // key changed on the server -> renew
      var a1 = new Uint8Array(sub.options.applicationServerKey);
      if (a1.length !== key.length || a1.some(function(v, i){ return v !== key[i]; })) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    var r = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON ? sub.toJSON() : sub) });
    if (!r.ok) return 'error';
    LS.set('igto_sub_day', new Date().toISOString().slice(0, 10));
    return 'ok';
  } catch (e) { return 'error'; }
}

/* ---------- bell (installed app): subscribe any time, and keep the subscription fresh ---------- */
(function(){
  var bell = document.getElementById('bellbtn'); if (!bell) return;
  var P = C.push || {};
  function paint(){ var on = ('Notification' in window) && Notification.permission === 'granted' && LS.get('igto_sub_day', ''); bell.classList.toggle('on', !!on); }
  paint();
  if (standalone && P.enabled && ('Notification' in window) && Notification.permission === 'granted'
      && LS.get('igto_sub_day', '') !== new Date().toISOString().slice(0, 10)) subscribePush().then(paint);
  bell.onclick = async function(){
    if (!('Notification' in window) || !('PushManager' in window)) { alert('Notifications are not supported on this device.'); return; }
    if (Notification.permission === 'denied') { alert('Notifications are blocked. Open your phone Settings > Apps > IGtoDownload (or Chrome) > Notifications and allow them, then tap the bell again.'); return; }
    var r = await subscribePush(); paint();
    if (r === 'ok') { ev('notify_accept'); alert('Notifications are on. We only send the important stuff.'); }
    else if (r === 'denied') ev('notify_decline');
    else alert('Could not turn on notifications right now. Please try again.');
  };
})();

/* ---------- app section above the FAQ ---------- */
(function(){
  var go = document.getElementById('appGet'), help = document.getElementById('appHelp'); if (!go) return;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function say(t){ help.textContent = t; help.hidden = false; }
  go.onclick = async function(){
    ev('appsec_tap');
    if (standalone || LS.get('igto_installed', 0)) { say('The app is already installed. Open IGtoDownload from your home screen.'); return; }
    if (deferred) {
      deferred.prompt();
      try { var c = await deferred.userChoice; ev(c && c.outcome === 'accepted' ? 'appsec_accept' : 'appsec_decline'); } catch (e) {}
      deferred = null; return;
    }
    if (inApp && isAndroid) { location.href = 'intent://' + location.host + location.pathname + '#Intent;scheme=https;package=com.android.chrome;end'; return; }
    if (inApp) { say('Instagram\\'s browser cannot install apps. Tap the \u22EF menu at the top and choose "Open in browser", then tap this button again.'); return; }
    if (isIOS) { say('On iPhone: tap the Share button (square with an arrow) in Safari, then choose "Add to Home Screen".'); return; }
    if (isAndroid) { say('Tap the \u22EE menu at the top right of Chrome, then choose "Install app" or "Add to Home screen".'); return; }
    say('In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose "Install IGtoDownload".');
  };
})();

/* ---------- hook into the downloader ---------- */
document.addEventListener('igto:resolved', function(e){
  var d = e.detail; saveHist(d);
  LS.set('igto_ok_downloads', LS.get('igto_ok_downloads', 0) + 1);
  maybeBanner('resolved');
  setTimeout(offerNotify, 900);
});
})();
`;
