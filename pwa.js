/**
 * pwa.js — makes /admin installable as a phone app, and wakes it with push.
 *
 * Push here is payload-free: the Worker pokes the phone, the service worker
 * then fetches the live status and builds the notification itself. That means
 * the alert text is always current, never a stale cached message.
 */

export function manifest(brand, origin) {
  return JSON.stringify({
    name: brand + " Admin",
    short_name: brand.replace(/\s+/g, "").slice(0, 12),
    description: "Live control panel: cookies, ads, alerts and diagnostics.",
    start_url: "/admin?tab=monitor",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b11",
    theme_color: "#0b0b11",
    categories: ["utilities", "productivity"],
    icons: [
      { src: origin + "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: origin + "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: origin + "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}

export const SW = `/* IGtoDownload admin service worker */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

function lineFor(st){
  var bn = (st.alerts && st.alerts.lang) === 'bn';
  if(st.level === 'down')
    return bn ? ['🚨 সাইট ডাউনলোড করতে পারছে না','কোনো কুকি কাজ করছে না। এখনই নতুন sessionid দিন।']
              : ['🚨 Downloads are failing','No cookie is working. Add a fresh sessionid now.'];
  if(st.level === 'warn')
    return bn ? ['⚠️ সতর্কতা','মাত্র একটা কুকি বাকি, বা সফলতার হার কমে গেছে।']
              : ['⚠️ Needs attention','Only one cookie left, or the success rate has dropped.'];
  return bn ? ['✅ আবার ঠিক হয়েছে','সাইট স্বাভাবিকভাবে চলছে।']
            : ['✅ Back to normal','The site is running normally.'];
}

function patternFrom(a){
  if(!a || a.vibrate === false) return undefined;
  var on = Math.max(200, Math.round((a.vibrateSeconds || 2) * 1000));
  var gap = Math.max(100, a.vibrateGapMs || 400);
  var times = Math.min(10, Math.max(1, a.vibrateRepeat || 3));
  var p = [];
  for (var i = 0; i < times; i++) { p.push(on); if (i < times - 1) p.push(gap); }
  return p;
}

self.addEventListener('push', function(event){
  event.waitUntil((async function(){
    var st = null;
    try {
      var r = await fetch('/admin?api=pubstatus', { credentials: 'include', cache: 'no-store' });
      if (r.ok) st = await r.json();
    } catch (e) {}
    if (!st) st = { level: 'warn', alerts: {} };
    var txt = lineFor(st);
    var opts = {
      body: txt[1],
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'igto-status',
      renotify: true,
      requireInteraction: st.level === 'down',
      silent: false,
      data: { url: '/admin?tab=monitor' }
    };
    var p = patternFrom(st.alerts);
    if (p) opts.vibrate = p;
    await self.registration.showNotification(txt[0], opts);
  })());
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/admin';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('/admin') !== -1 && 'focus' in list[i]) return list[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
`;
