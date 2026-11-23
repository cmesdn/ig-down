/**
 * video.js — the explainer video on the site.
 * Files live in public/media (served by Workers static assets).
 */

const FULL = "/media/igtodownload-how-to.mp4";
const POSTER = "/media/igtodownload-how-to.jpg";
const LOOP = "/media/igtodownload-share-loop.mp4";
const LOOP_POSTER = "/media/igtodownload-share-loop.jpg";

const PLAY = `<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`;

/* Click-to-play player: only a poster image loads until the visitor taps. */
export function howVideo(title = "Watch how it works — 1 minute") {
  return `<figure class="hvid">
  <button type="button" class="hv-btn" data-vsrc="${FULL}" aria-label="Play video: how to download from Instagram">
    <img src="${POSTER}" width="720" height="1280" loading="lazy" decoding="async" alt="IGtoDownload how-to video">
    <span class="hv-play">${PLAY}</span>
    <span class="hv-len">1:04</span>
  </button>
  <figcaption>${title}</figcaption>
</figure>`;
}

/* Silent looping clip for the app section; the file loads only when it scrolls into view. */
export function loopVideo() {
  return `<div class="apvid"><div class="apv-ph"><video class="apv" data-lsrc="${LOOP}" poster="${LOOP_POSTER}" muted loop playsinline preload="none" aria-label="Share a reel from Instagram to the IGtoDownload app"></video></div></div>`;
}

export function videoSchema(origin) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "How to download Instagram reels, videos and photos with IGtoDownload",
    description:
      "Copy the link, paste it and download — or share a reel straight to the IGtoDownload app for an instant download. Free, no login, no watermark.",
    thumbnailUrl: [origin + POSTER],
    uploadDate: "2026-11-23",
    duration: "PT1M4S",
    contentUrl: origin + FULL,
    embedUrl: origin + "/",
  };
}

export const VIDEO_CSS = `
.hvid{margin:22px auto 4px;max-width:300px;text-align:center}
.hv-btn{position:relative;display:block;width:100%;aspect-ratio:9/16;padding:0;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:#000;cursor:pointer;box-shadow:0 18px 40px rgba(0,0,0,.28)}
.hv-btn img,.hv-btn video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.hv-btn video{object-fit:contain;background:#000}
.hv-play{position:absolute;left:50%;top:71%;transform:translate(-50%,-50%);width:68px;height:68px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#f5367a,#8b3dff);box-shadow:0 8px 28px rgba(245,54,122,.45);transition:transform .2s}
.hv-play svg{margin-left:4px}
.hv-btn:hover .hv-play{transform:translate(-50%,-50%) scale(1.07)}
.hv-len{position:absolute;right:10px;bottom:10px;font-size:12px;font-weight:700;color:#fff;background:rgba(0,0,0,.6);padding:3px 8px;border-radius:8px}
.hv-btn.on{cursor:default}.hv-btn.on .hv-play,.hv-btn.on .hv-len,.hv-btn.on img{display:none}
.hvid figcaption{font-size:13px;color:var(--mut);margin-top:10px}
.mdx-vid .hvid{margin:6px auto 22px}
.apvid{display:grid;place-items:center;padding:22px 16px;background:radial-gradient(120% 90% at 50% 0%,rgba(245,54,122,.18),transparent 60%),radial-gradient(90% 80% at 50% 100%,rgba(139,61,255,.18),transparent 60%)}
.apv-ph{width:min(220px,62vw);aspect-ratio:9/16;border-radius:24px;overflow:hidden;border:1px solid var(--line);background:#000;box-shadow:0 16px 36px rgba(0,0,0,.3)}
.apv{width:100%;height:100%;object-fit:cover;display:block}
`;

export const VIDEO_JS = `
(function(){
 document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('.hv-btn');
  if(!b||b.classList.contains('on'))return;
  var v=document.createElement('video');
  v.src=b.getAttribute('data-vsrc');v.controls=true;v.autoplay=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';
  b.classList.add('on');b.appendChild(v);
  var p=v.play();if(p&&p.catch)p.catch(function(){});
  if(window.gtag)gtag('event','howto_video_play',{page:location.pathname});
 });
 var ls=document.querySelectorAll('video[data-lsrc]');
 if(!ls.length)return;
 function start(v){if(!v.src){v.src=v.getAttribute('data-lsrc')}var p=v.play();if(p&&p.catch)p.catch(function(){})}
 if(!('IntersectionObserver' in window)){Array.prototype.forEach.call(ls,start);return}
 var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting)start(en.target);else if(en.target.src)en.target.pause()})},{rootMargin:'120px'});
 Array.prototype.forEach.call(ls,function(v){io.observe(v)});
})();
`;

/* Blog posts that are phone how-to guides get the video. */
export const VIDEO_POSTS = new Set([
  "how-to-download-instagram-reels",
  "save-instagram-reels-iphone",
  "instagram-download-not-working",
  "download-instagram-video-hd-quality",
  "instagram-reels-without-watermark",
  "download-instagram-photos-carousel",
]);
