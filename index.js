/**
 * index.js — router + cron
 * IGtoDownload (igtodownload.com)
 */

import { getConfig, prune } from "./store.js";
import { resolveMedia, handleDownload, handleStream, handleImage, healthCheck, shortcode } from "./resolve.js";
import { handleAdmin } from "./admin.js";
import { route, render, sitemap, robots, esc } from "./pages.js";
import { ogImage, appIcon, icon192, icon512, iconMaskable } from "./assets.js";
import { manifest, SW } from "./pwa.js";
import { siteStatus } from "./monitor.js";
import { pushIfChanged, getVapid } from "./push.js";
import { siteManifest, SITE_SW, handleShare } from "./app.js";
import { subscribeUser, unsubscribeUser, latestBroadcast, countClick } from "./broadcast.js";
import { logEvent } from "./store.js";

const HITS = new Map(); // in-isolate rate limit: ip -> {n, reset}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      // --- public installable app
      if (path === "/manifest.webmanifest") {
        const cfg = await getConfig(env);
        return new Response(siteManifest(cfg, origin), {
          headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" },
        });
      }
      if (path === "/app-sw.js") {
        return new Response(SITE_SW, {
          headers: { "content-type": "application/javascript; charset=utf-8", "service-worker-allowed": "/", "cache-control": "no-cache" },
        });
      }
      if (path === "/share") return handleShare(url, origin);

      // --- public app api
      if (path === "/api/broadcast") {
        const b = await latestBroadcast(env);
        return cors(json(b || {}));
      }
      if (path === "/api/push/key") {
        const v = await getVapid(env);
        return cors(json({ key: v.publicKey }));
      }
      if (path === "/api/push/subscribe" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        return cors(json(await subscribeUser(env, body, request.headers.get("CF-IPCountry") || "")));
      }
      if (path === "/api/push/unsubscribe" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        return cors(json(await unsubscribeUser(env, body && body.endpoint)));
      }
      if (path === "/api/event" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const k = String((body && body.k) || "");
        const KEEP = ["install", "app_open", "share_in", "push_click", "banner_shown", "banner_accept", "notify_accept"];
        if (KEEP.includes(k)) {
          if (k === "push_click") ctx.waitUntil(countClick(env, body.id));
          ctx.waitUntil(logEvent(env, { kind: k, ok: true, country: request.headers.get("CF-IPCountry") || "" }));
        }
        return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
      }

      // --- app shell for the admin PWA (must come before the admin handler)
      if (path === "/admin/manifest.webmanifest") {
        const cfg = await getConfig(env);
        return new Response(manifest(cfg.brand.name, origin), {
          headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" },
        });
      }
      if (path === "/sw.js") {
        return new Response(SW, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "service-worker-allowed": "/",
            "cache-control": "no-cache",
          },
        });
      }

      // --- admin
      if (path === "/admin" || path.startsWith("/admin/")) return await handleAdmin(request, url, env, ctx);

      // --- machine files
      if (path === "/sitemap.xml")
        return new Response(sitemap(origin), { headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" } });
      if (path === "/robots.txt")
        return new Response(robots(origin), { headers: { "content-type": "text/plain", "cache-control": "public, max-age=3600" } });

      // --- static assets
      if (path === "/og.jpg" || path === "/og.png") return ogImage();
      if (path === "/apple-touch-icon.png" || path === "/apple-touch-icon-precomposed.png") return appIcon();
      if (path === "/icon-192.png") return icon192();
      if (path === "/icon-512.png") return icon512();
      if (path === "/icon-maskable.png") return iconMaskable();

      // --- media proxies
      if (path === "/dl") return await handleDownload(request, url, env);
      if (path === "/stream") return await handleStream(request, url, env);
      if (path === "/img") return await handleImage(url, env);

      // --- api
      if (path === "/api/resolve") {
        const cfg = await getConfig(env);
        if (cfg.settings.maintenance)
          return cors(json({ ok: false, title: "Back shortly", error: "The site is under maintenance. Please try again in a few minutes." }, 503));

        const limited = rateLimit(request, cfg.settings.rateLimitPerHour);
        if (limited) return cors(limited);

        const code = shortcode(url.searchParams.get("url") || "");
        if (!code)
          return cors(json({ ok: false, title: "That link does not look right", error: "Open the post in Instagram, tap Share, then Copy link, and paste that here." }, 400));

        try {
          const data = await resolveMedia(code, env, ctx, { country: request.headers.get("CF-IPCountry") || "" });
          return cors(json(data));
        } catch (e) {
          return cors(
            json(
              {
                ok: false,
                title: e.blocked ? "Temporarily unavailable" : "Could not get that post",
                error: e.message || "Unknown error",
              },
              502
            )
          );
        }
      }

      if (path === "/health") {
        const cfg = await getConfig(env);
        return cors(json({ ok: true, version: 3, maintenance: cfg.settings.maintenance }));
      }

      // --- address-bar shortcut:  yoursite.com/https://instagram.com/reel/xxx
      const direct = path.slice(1);
      if (/^https?:\/\/(www\.)?instagram\.com/i.test(direct) || /^(www\.)?instagram\.com\//i.test(direct)) {
        return Response.redirect(origin + "/?url=" + encodeURIComponent(direct + url.search), 302);
      }

      // --- pages
      const match = route(path);
      if (match) {
        const html = await render(match, env, origin);
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
      }

      return new Response(notFound(origin), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (e) {
      return new Response("Server error: " + esc(String((e && e.message) || e)), { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await healthCheck(env);
        await prune(env);
        // decide whether the phone needs to buzz
        try {
          const cfg = await getConfig(env);
          const st = await siteStatus(env);
          const alerts = cfg.alerts || {};
          const level = st.level === "warn" && !alerts.notifyWarn ? "ok" : st.level;
          await pushIfChanged(env, level, "", alerts.repeatMinutes);
        } catch (_) {}
      })()
    );
  },
};

/* ===================== helpers ===================== */

function rateLimit(request, perHour) {
  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const now = Date.now();
  let e = HITS.get(ip);
  if (!e || e.reset < now) {
    e = { n: 0, reset: now + 3600_000 };
    HITS.set(ip, e);
  }
  e.n++;
  if (HITS.size > 6000) HITS.clear();
  if (e.n > perHour)
    return json(
      { ok: false, title: "Slow down a moment", error: "Too many downloads from this connection. Please wait a little and try again." },
      429
    );
  return null;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

function notFound(origin) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — IGtoDownload</title>
<style>body{background:#0a0a0f;color:#f2f2f5;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
h1{font-size:54px;background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0}
p{color:#8e8e9c;margin:10px 0 22px}a{display:inline-block;background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px}</style>
</head><body><div><h1>404</h1><p>That page does not exist.</p><a href="${origin}/">Back to the downloader</a></div></body></html>`;
}
