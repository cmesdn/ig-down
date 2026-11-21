/**
 * admin.js — /admin control panel (Bangla + English)
 * Every option carries a click-to-open guide, so nothing needs to be memorised.
 */

import { getConfig, saveConfig, getCookies, saveCookies, getStats, AD_SLOTS, normalizeCookie, flushCookieCache } from "./store.js";
import { diagnose, testCookie, healthCheck, shortcode } from "./resolve.js";
import { esc } from "./pages.js";

const SESSION_HOURS = 24;
const TRIES = new Map();

/* ===================== strings ===================== */

const L = {
  bn: {
    admin: "এডমিন", signout: "সাইন আউট", signin: "সাইন ইন", password: "পাসওয়ার্ড",
    wrongpw: "ভুল পাসওয়ার্ড।", toomany: "অনেকবার ভুল হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।",
    guide: "📖 গাইড দেখুন", save: "সেভ করুন",
    tabs: { home: "ড্যাশবোর্ড", cookies: "কুকি", ads: "অ্যাড", seo: "SEO", settings: "সেটিংস", diag: "ডায়াগনস্টিক", help: "সাহায্য" },

    a_nocookie: "এখনো কোনো সেশন কুকি নেই। কুকি ট্যাবে গিয়ে একটা যোগ করুন, নইলে কোনো ডাউনলোড হবে না।",
    a_alldead: "সব কুকি মৃত। সাইট এখন কিছুই ডাউনলোড করতে পারছে না। কুকি ট্যাবে নতুন sessionid যোগ করুন।",
    a_one: "মাত্র একটা কুকি কাজ করছে। আরেকটা যোগ করুন — এটা মরে গেলেও সাইট চালু থাকবে।",
    a_maint: "মেইনটেন্যান্স মোড চালু আছে — ভিজিটররা ডাউনলোড করতে পারছে না।",

    s_today: "আজকের ডাউনলোড", s_week: "৭ দিনে", s_month: "৩০ দিনে", s_rate: "সফলতার হার", s_cookies: "সচল কুকি",
    last30: "গত ৩০ দিন", nodata: "এখনো কোনো ডেটা নেই। ইউজার আসা শুরু করলে এখানে দেখাবে।",
    whichmethod: "কোন মেথড কাজ করছে", method: "মেথড", tries: "চেষ্টা", ok: "সফল",
    topcountry: "শীর্ষ দেশ (৭ দিন)", country: "দেশ", requests: "রিকোয়েস্ট",
    comerr: "সবচেয়ে বেশি যে সমস্যা (৭ দিন)", error: "সমস্যা", count: "সংখ্যা",
    quick: "দ্রুত কাজ", clearcache: "ক্যাশ পরিষ্কার", runhealth: "কুকি হেলথ চেক চালান", opensite: "সাইট খুলুন",

    g_rate: "এটা দেখায় শেষ ৭ দিনে কত শতাংশ লিংক সফলভাবে ডাউনলোড হয়েছে।\n\n• ৮০%-এর উপরে — সব ঠিক আছে\n• ৫০–৮০% — কোনো একটা কুকি দুর্বল হয়ে পড়ছে, নতুন একটা যোগ করুন\n• ৫০%-এর নিচে — কুকি মরে যাচ্ছে, এখনই কুকি ট্যাবে যান\n\nমনে রাখবেন: কিছু লিংক স্বাভাবিকভাবেই ফেল করে (প্রাইভেট বা ডিলিট করা পোস্ট), তাই ১০০% কখনো হবে না।",
    g_method: "সাইট ৪টা আলাদা উপায়ে Instagram থেকে ভিডিও আনার চেষ্টা করে।\n\n• mobile-api — সবচেয়ে ভালো, সর্বোচ্চ কোয়ালিটি আর সব তথ্য (লাইক, কমেন্ট) দেয়\n• graphql — দ্বিতীয় পছন্দ\n• embed / og — শেষ ভরসা, শুধু ভিডিও দেয়\n\nmobile-api শূন্যে নেমে গেলে বুঝবেন কুকি সমস্যা করছে। বাকিগুলো তখনও সাইট চালু রাখে, কিন্তু তথ্য কম আসে।",
    g_cache: "ক্যাশ মানে — একই রিল আগে কেউ চাইলে ফলাফলটা জমা থাকে, পরেরবার Instagram-এ না গিয়ে সেখান থেকেই দেওয়া হয়।\n\nপরিষ্কার করলে সব জমানো ফলাফল মুছে যায়, পরের বার প্রত্যেকটা লিংক নতুন করে আনা হবে।\n\nকখন দরকার:\n• কোড আপডেট করার পর\n• ইউজার বলছে লিংক কাজ করছে না কিন্তু ডায়াগনস্টিকে ঠিক দেখাচ্ছে\n\nঅযথা করবেন না — ক্যাশ আপনার কুকি বাঁচায়।",

    c_title: "সেশন কুকি", c_name: "নাম", c_status: "অবস্থা", c_uses: "ব্যবহার", c_lastok: "শেষ সফল",
    c_working: "কাজ করছে", c_unstable: "অস্থির", c_dead: "মৃত",
    c_test: "টেস্ট", c_delete: "মুছুন", c_reenable: "সব আবার চালু", c_healthnow: "এখনই হেলথ চেক",
    c_none: "কোনো কুকি নেই।", c_add: "কুকি যোগ করুন",
    c_labelfield: "নাম", c_labelhint: "(শুধু আপনার চেনার জন্য — যেমন \"অ্যাকাউন্ট ২\")",
    c_valuefield: "sessionid মান", c_addbtn: "যোগ করুন",
    c_howto: "sessionid কীভাবে বের করবেন",
    c_intro: "সাইট এই কুকিগুলো ঘুরিয়ে ফিরিয়ে ব্যবহার করে। একটা ফেল করলে নিজে নিজেই পরেরটা ধরে, তাই ভিজিটর কোনো সমস্যা টের পায় না। ২-৩টা রাখুন, তাহলে সাইট কখনো বন্ধ হবে না।",
    g_cookie: "কুকি আসলে কী?\n\nInstagram এখন লগইন ছাড়া সার্ভার থেকে ভিডিও দেখতে দেয় না। তাই সাইটকে একটা Instagram অ্যাকাউন্টের \"পরিচয়পত্র\" (sessionid) দিতে হয়।\n\n⚠️ কখনো নিজের মূল অ্যাকাউন্ট ব্যবহার করবেন না — অটোমেটেড রিকোয়েস্টের কারণে অ্যাকাউন্ট বন্ধ হয়ে যেতে পারে। সবসময় আলাদা, নতুন খোলা অ্যাকাউন্ট ব্যবহার করুন।\n\nকুকি কয়েক সপ্তাহ থেকে কয়েক মাস টেকে। মাসে একবার নতুন একটা যোগ করে পুরনোটা মুছে দিন।\n\nকেন একাধিক?\nএকটা কুকি মরলে সাইট বন্ধ হয়ে যাবে। তিনটা থাকলে একটা মরলেও বাকি দুটো কাজ চালিয়ে যাবে — আপনি নিশ্চিন্তে ঠিক করতে পারবেন।",

    ad_title: "অ্যাড স্লট", ad_global: "পুরো সাইটে অ্যাড চালু",
    ad_globalhint: "AdSense রিভিউয়ের সময় বন্ধ রাখুন, বা যখনই পরিষ্কার সাইট দরকার। প্রতিটা স্লটের কোড জমা থাকবে।",
    ad_all: "সব ডিভাইস", ad_mob: "শুধু মোবাইল", ad_desk: "শুধু ডেস্কটপ",
    ad_ph: "এখানে অ্যাড নেটওয়ার্কের কোড পেস্ট করুন (AdSense, Adsterra, Ezoic...)",
    ad_savebtn: "অ্যাড সেটিংস সেভ করুন", ad_notes: "পরামর্শ",
    g_ads: "কীভাবে কাজ করে:\n\n১. অ্যাড নেটওয়ার্কে (AdSense / Adsterra / Ezoic) অ্যাকাউন্ট খুলুন\n২. ওখানে একটা ad unit বানান\n৩. যে কোড দেবে সেটা কপি করে নিচের যেকোনো বক্সে পেস্ট করুন\n৪. পাশের টিক চিহ্ন দিন আর সেভ করুন — এক মিনিটের মধ্যে লাইভ\n\n💡 শুরুতে মাত্র ২টা স্লট চালু করুন: \"সার্চ বক্সের নিচে\" আর \"রেজাল্টের নিচে\"। টুল সাইটে আয়ের বেশিরভাগ ওখান থেকেই আসে।\n\n⚠️ দশটা একসাথে চালু করবেন না। বেশি অ্যাড মানে ধীর সাইট, খারাপ র‍্যাঙ্কিং, আর AdSense রিজেক্ট।",

    seo_brand: "ব্র্যান্ড ও ট্র্যাকিং", seo_brandname: "ব্র্যান্ড নাম", seo_brandhint: "(লোগো আর ফুটারে দেখাবে)",
    seo_ga: "Google Analytics 4 আইডি", seo_gsc: "Search Console ভেরিফিকেশন কোড", seo_ads: "AdSense পাবলিশার আইডি",
    seo_done: "যা ইতিমধ্যে করা আছে", seo_next: "এরপর যা করবেন, ক্রম অনুযায়ী",
    g_ga: "Google Analytics দেখায় কতজন এলো, কোথা থেকে এলো, কোন পেজে গেল।\n\nকীভাবে পাবেন:\n১. analytics.google.com-এ যান\n২. Admin → Create property → সাইটের নাম দিন\n৩. Web ডেটা স্ট্রিম বানান, সাইটের ঠিকানা দিন\n৪. \"Measurement ID\" দেখাবে — G- দিয়ে শুরু\n৫. সেটা এখানে পেস্ট করে সেভ করুন\n\nএরপর থেকে ডাউনলোড বাটনে ক্লিকও আলাদাভাবে গোনা হবে।",
    g_gsc: "Search Console দেখায় Google-এ কোন keyword-এ আপনার সাইট কত নম্বরে আছে। SEO করতে চাইলে এটা ছাড়া চলবে না।\n\nকীভাবে:\n১. search.google.com/search-console\n২. Add property → URL prefix → সাইটের ঠিকানা\n৩. HTML tag পদ্ধতি বেছে নিন\n৪. যে ট্যাগ দেবে তার ভেতরের content=\"...\" অংশটুকু কপি করুন\n৫. এখানে পেস্ট → সেভ → Search Console-এ ফিরে Verify চাপুন\n৬. এরপর Sitemaps-এ গিয়ে sitemap.xml জমা দিন\n\n⚠️ workers.dev সাবডোমেইনে ভেরিফাই হবে না। নিজের ডোমেইন লাগবে।",
    g_adsense: "AdSense অনুমোদন পেলে পাবলিশার আইডি দেবে, দেখতে এমন: ca-pub-1234567890123456।\n\nএখানে বসালে AdSense-এর মূল স্ক্রিপ্ট সব পেজে যোগ হবে — এটা ছাড়া অ্যাড দেখাবে না।\n\nAdSense না পেলে এটা খালি রাখুন, আর Adsterra/Ezoic-এর কোড সরাসরি অ্যাড ট্যাবে বসান।",

    set_behav: "আচরণ", set_cache: "ক্যাশ সময় (সেকেন্ড)", set_rate: "রেট লিমিট (প্রতি IP, প্রতি ঘণ্টা)",
    set_maint: "মেইনটেন্যান্স মোড", set_mainthint: "(ভিজিটররা টুলের বদলে একটা ছোট নোটিশ দেখবে)",
    set_tg: "টেলিগ্রাম অ্যালার্ট", set_optional: "(ঐচ্ছিক)", set_token: "বট টোকেন", set_chat: "চ্যাট আইডি",
    set_savebtn: "সেটিংস সেভ করুন", set_pw: "এডমিন পাসওয়ার্ড বদলান", set_new: "নতুন পাসওয়ার্ড", set_again: "আবার লিখুন", set_pwbtn: "পাসওয়ার্ড বদলান",
    g_cachettl: "একটা লিংকের ফলাফল কতক্ষণ জমা থাকবে।\n\nবেশি রাখলে:\n✅ Instagram-এ কম যেতে হয় → কুকি বেশিদিন টেকে\n✅ সাইট দ্রুত হয়\n✅ ফ্রি প্ল্যানে বেশিদিন চলে\n\n❌ কিন্তু Instagram-এর ভিডিও লিংক কয়েক ঘণ্টা পর নিজেই মেয়াদোত্তীর্ণ হয়, তাই খুব বেশি রাখলে পুরনো লিংক কাজ করবে না।\n\n৩৬০০ (১ ঘণ্টা) সবচেয়ে ভালো ভারসাম্য। ২১৬০০ (৬ ঘণ্টা) সর্বোচ্চ।",
    g_rl: "একজন ব্যক্তি এক ঘণ্টায় সর্বোচ্চ কতবার ডাউনলোড করতে পারবে।\n\nকেন দরকার: কেউ স্ক্রিপ্ট চালিয়ে হাজার হাজার রিকোয়েস্ট পাঠালে আপনার পুরো দিনের কোটা শেষ হয়ে যাবে, আর কুকিও পুড়বে।\n\n৪০ একজন সাধারণ ইউজারের জন্য যথেষ্ট বেশি, আবার অপব্যবহার ঠেকায়। ট্রাফিক বাড়লে ২০-এ নামিয়ে আনতে পারেন।",
    g_tg: "কুকি মরে গেলে সাথে সাথে ফোনে খবর পাবেন — ট্রাফিক পড়ে যাওয়ার পর টের পাওয়ার চেয়ে অনেক ভালো।\n\nকীভাবে:\n১. টেলিগ্রামে @BotFather খুঁজুন → /newbot → নাম দিন\n২. যে টোকেন দেবে কপি করে উপরে বসান\n৩. @userinfobot-কে মেসেজ দিন → আপনার আইডি দেখাবে\n৪. সেই নম্বর চ্যাট আইডি ঘরে বসান\n৫. নিজের বটকে একবার /start পাঠান (নইলে বট মেসেজ পাঠাতে পারবে না)",

    d_test: "একটা লিংক টেস্ট করুন", d_run: "টেস্ট চালান", d_read: "ফলাফল কীভাবে পড়বেন",
    d_intro: "প্রতিটা কুকি দিয়ে প্রতিটা মেথড চালিয়ে দেখায় কোনটা কী বলছে। কিছু ভেঙে গেলে সবার আগে এখানে দেখুন।",
    d_what: "যা দেখবেন", d_means: "মানে", d_fix: "করণীয়",

    h_broke: "কিছু ভেঙে গেলে — ক্রম অনুযায়ী যা করবেন",
    h_routine: "নিয়মিত রক্ষণাবেক্ষণ", h_growth: "বৃদ্ধির চেকলিস্ট", h_scale: "ফ্রি প্ল্যান ছাড়িয়ে গেলে",
  },

  en: {
    admin: "admin", signout: "Sign out", signin: "Sign in", password: "Password",
    wrongpw: "Wrong password.", toomany: "Too many attempts. Try again in a few minutes.",
    guide: "📖 Show guide", save: "Save",
    tabs: { home: "Dashboard", cookies: "Cookies", ads: "Ads", seo: "SEO", settings: "Settings", diag: "Diagnostics", help: "Help" },

    a_nocookie: "No session cookies yet. Downloads will fail until you add one in the Cookies tab.",
    a_alldead: "Every cookie is dead. The site cannot download anything right now. Add a fresh sessionid in the Cookies tab.",
    a_one: "Only one working cookie. Add a second so the site keeps running when this one expires.",
    a_maint: "Maintenance mode is ON — visitors cannot download.",

    s_today: "Downloads today", s_week: "Last 7 days", s_month: "Last 30 days", s_rate: "Success rate", s_cookies: "Working cookies",
    last30: "Last 30 days", nodata: "No data yet. This fills in as people use the site.",
    whichmethod: "Which method is working", method: "Method", tries: "Tries", ok: "OK",
    topcountry: "Top countries (7 days)", country: "Country", requests: "Requests",
    comerr: "Most common errors (7 days)", error: "Error", count: "Count",
    quick: "Quick actions", clearcache: "Clear cache", runhealth: "Run cookie health check", opensite: "Open site",

    g_rate: "The share of links that downloaded successfully over the last 7 days.\n\n• Above 80% — healthy\n• 50–80% — a cookie is weakening, add a fresh one\n• Below 50% — cookies are dying, go to the Cookies tab now\n\nNote: some links fail naturally (private or deleted posts), so it will never read 100%.",
    g_method: "The site tries four different routes to reach Instagram.\n\n• mobile-api — best one: highest quality plus likes, comments and views\n• graphql — second choice\n• embed / og — last resort, video only\n\nIf mobile-api drops to zero, your cookies are the problem. The others keep the site alive meanwhile, but with less information.",
    g_cache: "Caching means a resolved link is stored for a while, so the next person asking for the same reel is served instantly without touching Instagram.\n\nClearing it throws all of that away — every link will be fetched fresh next time.\n\nWhen you need it:\n• After updating the code\n• When users report failures but Diagnostics looks fine\n\nDon't do it without reason — the cache is what protects your cookies.",

    c_title: "Session cookies", c_name: "Name", c_status: "Status", c_uses: "Uses", c_lastok: "Last OK",
    c_working: "Working", c_unstable: "Unstable", c_dead: "Dead",
    c_test: "Test", c_delete: "Delete", c_reenable: "Re-enable all", c_healthnow: "Health check now",
    c_none: "No cookies yet.", c_add: "Add a cookie",
    c_labelfield: "Name", c_labelhint: "(just for you — e.g. \"account 2\")",
    c_valuefield: "sessionid value", c_addbtn: "Add cookie",
    c_howto: "How to get a sessionid",
    c_intro: "The site rotates through these. If one fails it is skipped automatically and the next is used, so visitors never see an error. Keep two or three and the site never goes down.",
    g_cookie: "What is a cookie here?\n\nInstagram no longer serves media to servers that are not logged in. So the site has to present an Instagram account's identity token (sessionid).\n\n⚠️ Never use your main account — automated requests can get it suspended. Always use a separate, freshly made throwaway account.\n\nCookies last weeks to months. Add a fresh one roughly once a month and delete the oldest.\n\nWhy more than one?\nWith a single cookie, the site dies the moment it expires. With three, one can fail and the other two carry on while you fix it at your leisure.",

    ad_title: "Ad slots", ad_global: "Ads enabled site-wide",
    ad_globalhint: "Turn off during an AdSense review, or whenever you want a clean site. Each slot keeps its code.",
    ad_all: "All devices", ad_mob: "Mobile only", ad_desk: "Desktop only",
    ad_ph: "Paste the ad network code here (AdSense, Adsterra, Ezoic...)",
    ad_savebtn: "Save ad settings", ad_notes: "Notes",
    g_ads: "How this works:\n\n1. Open an account with an ad network (AdSense / Adsterra / Ezoic)\n2. Create an ad unit there\n3. Copy the code it gives you and paste it into any box below\n4. Tick the box beside it and save — live within a minute\n\n💡 Start with just two slots: \"Under search box\" and \"Below result\". On a tool site those two earn most of the money.\n\n⚠️ Do not switch on all ten. Too many ads mean a slow site, worse rankings, and AdSense rejection.",

    seo_brand: "Brand & tracking", seo_brandname: "Brand name", seo_brandhint: "(shown in the logo and footer)",
    seo_ga: "Google Analytics 4 ID", seo_gsc: "Search Console verification code", seo_ads: "AdSense publisher ID",
    seo_done: "Already handled for you", seo_next: "What to do next, in order",
    g_ga: "Analytics shows how many people arrive, where from, and which pages they use.\n\nHow to get the ID:\n1. Go to analytics.google.com\n2. Admin → Create property → name your site\n3. Create a Web data stream with your site address\n4. A \"Measurement ID\" appears, starting with G-\n5. Paste it here and save\n\nDownload button clicks are then tracked as their own event.",
    g_gsc: "Search Console shows which keywords you rank for and at what position. SEO without it is guesswork.\n\nHow:\n1. search.google.com/search-console\n2. Add property → URL prefix → your site address\n3. Choose the HTML tag method\n4. Copy only the content=\"...\" value from the tag it shows\n5. Paste here → save → go back and press Verify\n6. Then submit sitemap.xml under Sitemaps\n\n⚠️ A workers.dev subdomain cannot be verified. You need your own domain.",
    g_adsense: "Once AdSense approves you, it gives a publisher ID that looks like ca-pub-1234567890123456.\n\nPutting it here adds the main AdSense script to every page — without it, the ad units will not render.\n\nIf you are not on AdSense, leave this blank and paste Adsterra or Ezoic code directly into the Ads tab.",

    set_behav: "Behaviour", set_cache: "Cache duration (seconds)", set_rate: "Rate limit (per IP, per hour)",
    set_maint: "Maintenance mode", set_mainthint: "(visitors see a short notice instead of the tool)",
    set_tg: "Telegram alerts", set_optional: "(optional)", set_token: "Bot token", set_chat: "Chat ID",
    set_savebtn: "Save settings", set_pw: "Change admin password", set_new: "New password", set_again: "Repeat it", set_pwbtn: "Change password",
    g_cachettl: "How long one link's result is reused.\n\nHigher means:\n✅ Fewer trips to Instagram → cookies last longer\n✅ Faster site\n✅ More headroom on the free plan\n\n❌ But Instagram's media URLs expire after a few hours, so a very high value leaves stale links that fail.\n\n3600 (one hour) is the sweet spot. 21600 (six hours) is the maximum.",
    g_rl: "The most downloads one person can make per hour.\n\nWhy it matters: someone running a script could burn your entire daily quota and your cookies with it.\n\n40 is generous for a real visitor while still stopping abuse. Drop it to 20 if traffic grows.",
    g_tg: "Get a message on your phone the moment cookies die, rather than discovering it from a traffic drop.\n\nHow:\n1. Message @BotFather on Telegram → /newbot → give it a name\n2. Copy the token it returns into the field above\n3. Message @userinfobot → it replies with your ID\n4. Put that number in the Chat ID field\n5. Send /start to your own bot once, or it cannot message you",

    d_test: "Test a link", d_run: "Run test", d_read: "Reading the results",
    d_intro: "Runs every method against every cookie and shows exactly what each returns. This is the first place to look when something breaks.",
    d_what: "What you see", d_means: "What it means", d_fix: "Fix",

    h_broke: "Something broke — what to do, in order",
    h_routine: "Routine upkeep", h_growth: "Growth checklist", h_scale: "Scaling past the free plan",
  },
};

const SLOT_BN = {
  header: ["হেডার ব্যানার", "প্রতি পেজের একদম উপরে, মেনুর নিচে"],
  under_input: ["সার্চ বক্সের নিচে", "সবচেয়ে বেশি ক্লিক পাওয়া জায়গা"],
  above_result: ["রেজাল্টের উপরে", "ভিডিও পাওয়া গেলে দেখা যায়"],
  below_result: ["রেজাল্টের নিচে", "ডাউনলোড বাটনের ঠিক নিচে"],
  in_content: ["কনটেন্টের মাঝে", "লেখার দুই অংশের মাঝখানে"],
  sidebar: ["সাইডবার", "শুধু ডেস্কটপ, স্টিকি"],
  sticky_bottom: ["স্টিকি নিচে", "নিচে আটকে থাকে, মোবাইলে ভালো কাজ করে"],
  sticky_top: ["স্টিকি উপরে", "উপরে আটকে থাকে"],
  footer: ["ফুটার", "ফুটার লিংকের ঠিক উপরে"],
  native: ["নেটিভ / ইন-ফিড", "FAQ তালিকার সাথে মিশে যায়"],
};

/* ===================== entry ===================== */

export async function handleAdmin(request, url, env, ctx) {
  const ip = request.headers.get("CF-Connecting-IP") || "0";
  let lang = langOf(request);

  // language switch
  const want = url.searchParams.get("lang");
  if (want === "bn" || want === "en") {
    const back = url.searchParams.get("tab") || "home";
    return new Response(null, {
      status: 302,
      headers: { location: "/admin?tab=" + back, "set-cookie": `iglang=${want}; Path=/admin; Max-Age=31536000; Secure; SameSite=Lax` },
    });
  }

  if (url.searchParams.get("logout") === "1")
    return new Response(null, { status: 302, headers: { location: "/admin", "set-cookie": "igadm=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax" } });

  const t = L[lang];

  if (request.method === "POST" && url.searchParams.get("do") === "login") {
    const tr = TRIES.get(ip);
    if (tr && tr.until > Date.now()) return page(loginForm(t.toomany, t, lang), true);
    const form = await request.formData();
    if (await checkPassword(String(form.get("pw") || ""), env)) {
      TRIES.delete(ip);
      return new Response(null, {
        status: 302,
        headers: { location: "/admin", "set-cookie": `igadm=${await mkSession(env)}; Path=/admin; Max-Age=${SESSION_HOURS * 3600}; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    const n = ((tr && tr.n) || 0) + 1;
    TRIES.set(ip, { n, until: n >= 5 ? Date.now() + 9e5 : 0 });
    return page(loginForm(t.wrongpw, t, lang), true);
  }

  if (!(await validSession(request, env))) return page(loginForm("", t, lang), true);

  if (request.method === "POST") {
    const form = await request.formData();
    const msg = await runAction(url.searchParams.get("do"), form, env, lang);
    return new Response(null, { status: 302, headers: { location: "/admin?tab=" + String(form.get("tab") || "home") + "&m=" + encodeURIComponent(msg) } });
  }

  if (url.searchParams.get("api") === "diag") {
    const code = shortcode(url.searchParams.get("url") || "");
    if (!code) return json({ error: lang === "bn" ? "এটা valid Instagram লিংক না।" : "Not a valid Instagram link." });
    return json({ code, rows: await diagnose(code, env) });
  }
  if (url.searchParams.get("api") === "health") return json(await healthCheck(env));

  return page(await body(url.searchParams.get("tab") || "home", env, url.searchParams.get("m") || "", lang), false);
}

/* ===================== actions ===================== */

const M = {
  bn: {
    ads: "অ্যাড সেটিংস সেভ হয়েছে। এখনই লাইভ।",
    seo: "SEO ও অ্যানালিটিক্স সেভ হয়েছে।",
    settings: "সেটিংস সেভ হয়েছে।",
    pwshort: "পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।",
    pwmatch: "দুটো পাসওয়ার্ড মিলছে না।",
    pwok: "পাসওয়ার্ড বদলে গেছে। পরেরবার নতুনটা দিয়ে ঢুকবেন।",
    needval: "আগে sessionid মান পেস্ট করুন।",
    addok: "কুকি যোগ হয়েছে এবং টেস্টে কাজ করেছে ✅",
    addfail: "কুকি যোগ হয়েছে, কিন্তু টেস্ট ফেল করেছে: ",
    del: "কুকি মুছে ফেলা হয়েছে।",
    notfound: "কুকি পাওয়া যায়নি।",
    revive: "সব কুকি আবার চালু। কোনটা সত্যিই কাজ করে দেখতে হেলথ চেক চালান।",
    cache: "ক্যাশ পরিষ্কার হয়েছে। পরের বার প্রতিটা লিংক নতুন করে আনা হবে।",
    nothing: "কিছু করার নেই।",
  },
  en: {
    ads: "Ad settings saved. Live immediately.",
    seo: "SEO and analytics saved.",
    settings: "Settings saved.",
    pwshort: "Password must be at least 8 characters.",
    pwmatch: "The two passwords do not match.",
    pwok: "Password changed. Use the new one next time you sign in.",
    needval: "Paste a sessionid value first.",
    addok: "Cookie added and tested — it works ✅",
    addfail: "Cookie added, but the test failed: ",
    del: "Cookie removed.",
    notfound: "Cookie not found.",
    revive: "All cookies re-enabled. Run a health check to see which really work.",
    cache: "Cache cleared. Every link will be fetched fresh next time.",
    nothing: "Nothing to do.",
  },
};

async function runAction(action, form, env, lang) {
  const m = M[lang];
  const cfg = await getConfig(env);

  if (action === "ads") {
    for (const s of AD_SLOTS)
      cfg.ads[s.id] = { code: String(form.get("code_" + s.id) || ""), enabled: form.get("on_" + s.id) === "1", device: String(form.get("dev_" + s.id) || "both") };
    cfg.settings.adsEnabled = form.get("adsEnabled") === "1";
    await saveConfig(env, cfg);
    return m.ads;
  }
  if (action === "seo") {
    cfg.brand.name = String(form.get("brandName") || cfg.brand.name);
    cfg.analytics.ga4 = String(form.get("ga4") || "").trim();
    cfg.analytics.gscTag = String(form.get("gscTag") || "").trim();
    cfg.analytics.adsenseClient = String(form.get("adsenseClient") || "").trim();
    await saveConfig(env, cfg);
    return m.seo;
  }
  if (action === "settings") {
    cfg.settings.cacheTtl = Math.max(60, Math.min(21600, +form.get("cacheTtl") || 3600));
    cfg.settings.rateLimitPerHour = Math.max(5, Math.min(500, +form.get("rateLimit") || 40));
    cfg.settings.maintenance = form.get("maintenance") === "1";
    cfg.settings.telegramToken = String(form.get("tgToken") || "").trim();
    cfg.settings.telegramChat = String(form.get("tgChat") || "").trim();
    await saveConfig(env, cfg);
    return m.settings;
  }
  if (action === "password") {
    const a = String(form.get("pw1") || ""), b = String(form.get("pw2") || "");
    if (a.length < 8) return m.pwshort;
    if (a !== b) return m.pwmatch;
    await env.CONFIG.put("adminpw", await sha256(a));
    return m.pwok;
  }
  if (action === "cookie_add") {
    const list = await getCookies(env);
    const value = normalizeCookie(String(form.get("value") || ""));
    if (!value) return m.needval;
    const check = await testCookie(value);
    list.push({
      id: "c" + Date.now().toString(36),
      label: String(form.get("label") || "cookie " + (list.length + 1)).slice(0, 40),
      value, status: check.ok ? "ok" : "warn", fails: check.ok ? 0 : 1, uses: 0,
      lastOk: check.ok ? Date.now() : 0, lastError: check.error || "",
    });
    await saveCookies(env, list);
    return check.ok ? m.addok : m.addfail + (check.error || "?");
  }
  if (action === "cookie_del") {
    await saveCookies(env, (await getCookies(env)).filter((c) => c.id !== String(form.get("id") || "")));
    return m.del;
  }
  if (action === "cookie_test") {
    const list = await getCookies(env);
    const c = list.find((x) => x.id === String(form.get("id") || ""));
    if (!c) return m.notfound;
    const r = await testCookie(c.value);
    c.status = r.ok ? "ok" : "dead";
    c.fails = r.ok ? 0 : 3;
    if (r.ok) c.lastOk = Date.now();
    c.lastError = r.error || "";
    await saveCookies(env, list);
    return r.ok ? `"${c.label}" ✅ (${r.ms} ms)` : `"${c.label}" ❌ ${r.error || "?"}`;
  }
  if (action === "cookie_revive") {
    const list = await getCookies(env);
    for (const c of list) { c.status = "ok"; c.fails = 0; }
    await saveCookies(env, list);
    return m.revive;
  }
  if (action === "cache_clear") {
    cfg.settings.cacheSalt = Date.now();
    await saveConfig(env, cfg);
    flushCookieCache();
    return m.cache;
  }
  return m.nothing;
}

/* ===================== body ===================== */

async function body(tab, env, msg, lang) {
  const t = L[lang];
  const cfg = await getConfig(env);
  const cookies = await getCookies(env);
  const live = cookies.filter((c) => c.status !== "dead").length;
  const order = ["home", "cookies", "ads", "seo", "settings", "diag", "help"];

  let alert = "";
  if (!cookies.length) alert = bad(t.a_nocookie);
  else if (!live) alert = bad(t.a_alldead);
  else if (live < 2) alert = mid(t.a_one);
  if (cfg.settings.maintenance) alert += bad(t.a_maint);

  const panes = {
    home: () => homeTab(env, cookies, t),
    cookies: () => cookiesTab(cookies, t),
    ads: () => adsTab(cfg, t, lang),
    seo: () => seoTab(cfg, t, lang),
    settings: () => settingsTab(cfg, t),
    diag: () => diagTab(t, lang),
    help: () => helpTab(lang),
  };

  return `
<div class="top">
  <div class="logo"><span class="mk"></span>${esc(cfg.brand.name)} <em>${t.admin}</em></div>
  <div class="lang">
    <a href="/admin?lang=bn&tab=${tab}" class="${lang === "bn" ? "on" : ""}">বাংলা</a>
    <a href="/admin?lang=en&tab=${tab}" class="${lang === "en" ? "on" : ""}">EN</a>
  </div>
  <a class="out" href="/admin?logout=1">${t.signout}</a>
</div>
<div class="tabs">${order.map((k) => `<a href="/admin?tab=${k}" class="${k === tab ? "on" : ""}">${t.tabs[k]}</a>`).join("")}</div>
${msg ? `<div class="msg">${esc(msg)}</div>` : ""}
${alert}
${await panes[tab in panes ? tab : "home"]()}`;
}

/* ---------- dashboard ---------- */

async function homeTab(env, cookies, t) {
  const s = await getStats(env);
  const live = cookies.filter((c) => c.status !== "dead").length;
  const max = Math.max(1, ...s.days.map((d) => d.n));
  const bars = s.days.slice(-30).map((d) => `<div class="bar" title="${d.day}: ${d.ok}/${d.n}"><span style="height:${Math.round((d.n / max) * 100)}%"></span></div>`).join("");

  return `
<div class="cards">
  ${stat(t.s_today, s.today)}
  ${stat(t.s_week, s.week)}
  ${stat(t.s_month, s.month)}
  ${stat(t.s_rate, s.rate + "%", s.rate >= 80 ? "good" : s.rate >= 50 ? "mid" : "bad")}
  ${stat(t.s_cookies, live + " / " + cookies.length, live ? "good" : "bad")}
</div>
${guide(t.guide, t.g_rate)}

<div class="box">
  <h3>${t.last30}</h3>
  ${s.days.length ? `<div class="chart">${bars}</div>` : `<p class="dim">${t.nodata}</p>`}
</div>

<div class="two">
  <div class="box">
    <h3>${t.whichmethod}</h3>
    ${s.methods.length
      ? `<table><tr><th>${t.method}</th><th>${t.tries}</th><th>${t.ok}</th></tr>${s.methods.map((m) => `<tr><td>${esc(m.method || "—")}</td><td>${m.n}</td><td>${m.ok}</td></tr>`).join("")}</table>`
      : `<p class="dim">${t.nodata}</p>`}
    ${guide(t.guide, t.g_method)}
  </div>
  <div class="box">
    <h3>${t.topcountry}</h3>
    ${s.countries.length
      ? `<table><tr><th>${t.country}</th><th>${t.requests}</th></tr>${s.countries.map((c) => `<tr><td>${esc(c.country)}</td><td>${c.n}</td></tr>`).join("")}</table>`
      : `<p class="dim">${t.nodata}</p>`}
  </div>
</div>

${s.errors.length ? `<div class="box"><h3>${t.comerr}</h3><table><tr><th>${t.error}</th><th>${t.count}</th></tr>${s.errors.map((e) => `<tr><td>${esc(e.err)}</td><td>${e.n}</td></tr>`).join("")}</table></div>` : ""}

<div class="box">
  <h3>${t.quick}</h3>
  <div class="row">
    ${postBtn("cache_clear", "home", t.clearcache, "ghost")}
    <button class="btn ghost" onclick="runHealth()">${t.runhealth}</button>
    <a class="btn ghost" href="/" target="_blank">${t.opensite}</a>
  </div>
  ${guide(t.guide, t.g_cache)}
  <pre id="healthout" class="out hide"></pre>
</div>`;
}

/* ---------- cookies ---------- */

function cookiesTab(list, t) {
  const rows = list.length
    ? list.map((c) => `<tr>
  <td><span class="dot ${c.status}"></span> ${esc(c.label)}</td>
  <td>${c.status === "ok" ? t.c_working : c.status === "warn" ? t.c_unstable : t.c_dead}</td>
  <td>${c.uses || 0}</td>
  <td>${c.lastOk ? ago(c.lastOk) : "—"}</td>
  <td class="nowrap">
    <form method="post" action="/admin?do=cookie_test" style="display:inline"><input type="hidden" name="tab" value="cookies"><input type="hidden" name="id" value="${esc(c.id)}"><button class="mini">${t.c_test}</button></form>
    <form method="post" action="/admin?do=cookie_del" style="display:inline" onsubmit="return confirm('?')"><input type="hidden" name="tab" value="cookies"><input type="hidden" name="id" value="${esc(c.id)}"><button class="mini danger">${t.c_delete}</button></form>
  </td>
</tr>${c.lastError ? `<tr class="sub"><td colspan="5">${esc(c.lastError)}</td></tr>` : ""}`).join("")
    : `<tr><td colspan="5" class="dim">${t.c_none}</td></tr>`;

  return `
<div class="box">
  <h3>${t.c_title}</h3>
  <p class="dim">${t.c_intro}</p>
  ${guide(t.guide, t.g_cookie)}
  <table class="wide"><tr><th>${t.c_name}</th><th>${t.c_status}</th><th>${t.c_uses}</th><th>${t.c_lastok}</th><th></th></tr>${rows}</table>
  <div class="row" style="margin-top:12px">
    ${postBtn("cookie_revive", "cookies", t.c_reenable, "ghost")}
    <button class="btn ghost" onclick="runHealth()">${t.c_healthnow}</button>
  </div>
  <pre id="healthout" class="out hide"></pre>
</div>

<div class="box">
  <h3>${t.c_add}</h3>
  <form method="post" action="/admin?do=cookie_add">
    <input type="hidden" name="tab" value="cookies">
    <label>${t.c_labelfield} <span class="dim">${t.c_labelhint}</span></label>
    <input name="label" placeholder="account 2">
    <label>${t.c_valuefield}</label>
    <textarea name="value" rows="3" placeholder="sessionid=71234567%3AAbCd..."></textarea>
    <button class="btn">${t.c_addbtn}</button>
  </form>
</div>

<div class="box">
  <h3>${t.c_howto}</h3>
  <ol class="steps">${HOWTO_COOKIE[t === L.bn ? "bn" : "en"].map((s) => `<li>${s}</li>`).join("")}</ol>
</div>`;
}

const HOWTO_COOKIE = {
  bn: [
    "<b>একটা throwaway Instagram অ্যাকাউন্ট বানান।</b> কখনো নিজের মূল অ্যাকাউন্ট না — অটোমেটেড ট্রাফিকের কারণে বন্ধ হয়ে যেতে পারে।",
    "<b>Firefox ইনস্টল করুন</b> ফোনে (Android-এর Chrome-এ extension চলে না)।",
    "<b>Cookie-Editor যোগ করুন:</b> Firefox মেনু → Add-ons → \"Cookie-Editor\" সার্চ → Add।",
    "<b>লগইন করুন</b> instagram.com-এ, throwaway অ্যাকাউন্ট দিয়ে।",
    "<b>Cookie-Editor খুলুন</b> instagram.com-এ থাকা অবস্থায়, Firefox মেনু → Extensions থেকে।",
    "<b><code>sessionid</code> খুঁজুন</b> তালিকায়, চাপুন, পুরো Value কপি করুন।",
    "<b>উপরে পেস্ট করে</b> যোগ করুন বাটনে চাপুন। সাথে সাথে টেস্ট হয়ে যাবে।",
    "কম্পিউটারে আরও দ্রুত: instagram.com-এ F12 → Application → Cookies → instagram.com → sessionid।",
  ],
  en: [
    "<b>Make a throwaway Instagram account.</b> Never your main one — automated traffic can get an account suspended.",
    "<b>Install Firefox</b> on your phone (Chrome on Android cannot run extensions).",
    "<b>Add the Cookie-Editor extension:</b> Firefox menu → Add-ons → search \"Cookie-Editor\" → Add.",
    "<b>Log in</b> to instagram.com in Firefox with the throwaway account.",
    "<b>Open Cookie-Editor</b> from the Firefox menu while on instagram.com.",
    "<b>Find <code>sessionid</code></b> in the list, tap it, and copy the whole Value.",
    "<b>Paste it above</b> and press Add cookie. It is tested straight away.",
    "On a computer it is quicker: F12 on instagram.com → Application → Cookies → instagram.com → sessionid.",
  ],
};

/* ---------- ads ---------- */

function adsTab(cfg, t, lang) {
  return `
<div class="box">
  <h3>${t.ad_title}</h3>
  ${guide(t.guide, t.g_ads)}
  <form method="post" action="/admin?do=ads">
    <input type="hidden" name="tab" value="ads">
    <label class="check"><input type="checkbox" name="adsEnabled" value="1" ${cfg.settings.adsEnabled ? "checked" : ""}> <b>${t.ad_global}</b></label>
    <p class="dim">${t.ad_globalhint}</p>
    ${AD_SLOTS.map((s) => {
      const a = cfg.ads[s.id] || { code: "", enabled: false, device: "both" };
      const label = lang === "bn" ? SLOT_BN[s.id][0] : s.label;
      const hint = lang === "bn" ? SLOT_BN[s.id][1] : s.hint;
      return `<div class="slot">
        <div class="slothead">
          <label class="check"><input type="checkbox" name="on_${s.id}" value="1" ${a.enabled ? "checked" : ""}> <b>${label}</b></label>
          <select name="dev_${s.id}">
            <option value="both" ${a.device === "both" ? "selected" : ""}>${t.ad_all}</option>
            <option value="mobile" ${a.device === "mobile" ? "selected" : ""}>${t.ad_mob}</option>
            <option value="desktop" ${a.device === "desktop" ? "selected" : ""}>${t.ad_desk}</option>
          </select>
        </div>
        <p class="dim">${hint}</p>
        <textarea name="code_${s.id}" rows="3" placeholder="${t.ad_ph}">${esc(a.code)}</textarea>
      </div>`;
    }).join("")}
    <button class="btn">${t.ad_savebtn}</button>
  </form>
</div>
<div class="box">
  <h3>${t.ad_notes}</h3>
  <ul class="steps">${(lang === "bn" ? AD_NOTES.bn : AD_NOTES.en).map((x) => `<li>${x}</li>`).join("")}</ul>
</div>`;
}

const AD_NOTES = {
  bn: [
    "যেকোনো HTML বা স্ক্রিপ্ট চলবে — AdSense, Adsterra, Monetag, Ezoic, এমনকি সাধারণ ছবির ব্যানারও।",
    "পরিবর্তন এক মিনিটের মধ্যে লাইভ, deploy লাগবে না।",
    "<b>Adsterra / Monetag</b> সহজে অনুমোদন দেয়, CPM কম। <b>AdSense</b> সবচেয়ে বেশি দেয় কিন্তু অনুমোদন কঠিন। <b>Ezoic</b> মাঝামাঝি — Google-এর ডিমান্ড দেয়, ন্যূনতম ট্রাফিক লাগে না।",
    "AdSense-এ apply করার আগে সব অ্যাড বন্ধ রাখুন, আর অন্তত ১৫-২০টা ব্লগ পোস্ট রাখুন।",
    "পপ-আপ বা পপ-আন্ডার অ্যাড AdSense-এ নিষিদ্ধ — দুটো একসাথে চালাবেন না।",
  ],
  en: [
    "Any HTML or script works — AdSense, Adsterra, Monetag, Ezoic, or a plain image banner.",
    "Changes go live within a minute. No redeploy.",
    "<b>Adsterra / Monetag</b> approve easily but pay less. <b>AdSense</b> pays most but is hard to get. <b>Ezoic</b> sits in between — it serves Google demand with no traffic minimum.",
    "Switch all ads off before applying to AdSense, and have 15–20 real blog posts first.",
    "Pop-up and pop-under ads breach AdSense policy — never run both at once.",
  ],
};

/* ---------- seo ---------- */

function seoTab(cfg, t, lang) {
  const done = lang === "bn"
    ? ["<b>sitemap.xml</b> — <a href='/sitemap.xml' target='_blank'>/sitemap.xml</a>-এ লাইভ, নিজে নিজে আপডেট হয়।",
       "<b>robots.txt</b> — <a href='/robots.txt' target='_blank'>/robots.txt</a>-এ লাইভ, এডমিন পেজ বাদ দেওয়া।",
       "<b>Structured data</b> — প্রতিটা টুল পেজে FAQ, HowTo ও SoftwareApplication schema।",
       "<b>Canonical ও Open Graph</b> — সব পেজে।",
       "<b>Server-rendered HTML</b> — JavaScript না চালিয়েই Google পুরো লেখা দেখতে পায়।"]
    : ["<b>sitemap.xml</b> — live at <a href='/sitemap.xml' target='_blank'>/sitemap.xml</a>, updates itself.",
       "<b>robots.txt</b> — live at <a href='/robots.txt' target='_blank'>/robots.txt</a>, admin excluded.",
       "<b>Structured data</b> — FAQ, HowTo and SoftwareApplication schema on every tool page.",
       "<b>Canonical tags &amp; Open Graph</b> — on every page.",
       "<b>Server-rendered HTML</b> — Google sees the full text without running JavaScript."];

  const next = lang === "bn"
    ? ["GA4 property বানিয়ে আইডি উপরে বসান।",
       "Search Console-এ সাইট যোগ করুন, ভেরিফিকেশন কোড উপরে বসান, তারপর Verify চাপুন।",
       "Search Console-এ <code>/sitemap.xml</code> জমা দিন।",
       "হোম পেজ আর প্রতিটা টুল পেজের জন্য indexing request করুন।",
       "অপেক্ষা করুন। নতুন ডোমেইনে র‍্যাঙ্কিং নড়তে ৪-১২ সপ্তাহ লাগে। এই সময়ে বারবার কিছু বদলাবেন না।",
       "সপ্তাহে একটা ব্লগ পোস্ট দিন। নতুন সাইট আসলে লং-টেইল keyword-এই জেতে।"]
    : ["Create a GA4 property and paste the ID above.",
       "Add the site in Search Console, paste the verification code above, then press Verify.",
       "Submit <code>/sitemap.xml</code> in Search Console.",
       "Request indexing for the home page and each tool page.",
       "Wait. New domains take 4–12 weeks before rankings move. Do not keep changing things in that window.",
       "Publish one blog post a week. Long-tail queries are where a new site actually wins."];

  return `
<div class="box">
  <form method="post" action="/admin?do=seo">
    <input type="hidden" name="tab" value="seo">
    <h3>${t.seo_brand}</h3>
    <label>${t.seo_brandname} <span class="dim">${t.seo_brandhint}</span></label>
    <input name="brandName" value="${esc(cfg.brand.name)}">
    <label>${t.seo_ga}</label>
    <input name="ga4" value="${esc(cfg.analytics.ga4)}" placeholder="G-XXXXXXXXXX">
    ${guide(t.guide, t.g_ga)}
    <label>${t.seo_gsc}</label>
    <input name="gscTag" value="${esc(cfg.analytics.gscTag)}">
    ${guide(t.guide, t.g_gsc)}
    <label>${t.seo_ads}</label>
    <input name="adsenseClient" value="${esc(cfg.analytics.adsenseClient)}" placeholder="ca-pub-0000000000000000">
    ${guide(t.guide, t.g_adsense)}
    <button class="btn">${t.save}</button>
  </form>
</div>
<div class="box"><h3>${t.seo_done}</h3><ul class="steps">${done.map((x) => `<li>${x}</li>`).join("")}</ul></div>
<div class="box"><h3>${t.seo_next}</h3><ol class="steps">${next.map((x) => `<li>${x}</li>`).join("")}</ol></div>`;
}

/* ---------- settings ---------- */

function settingsTab(cfg, t) {
  return `
<div class="box">
  <form method="post" action="/admin?do=settings">
    <input type="hidden" name="tab" value="settings">
    <h3>${t.set_behav}</h3>
    <label>${t.set_cache}</label>
    <input name="cacheTtl" type="number" value="${cfg.settings.cacheTtl}" min="60" max="21600">
    ${guide(t.guide, t.g_cachettl)}
    <label>${t.set_rate}</label>
    <input name="rateLimit" type="number" value="${cfg.settings.rateLimitPerHour}" min="5" max="500">
    ${guide(t.guide, t.g_rl)}
    <label class="check"><input type="checkbox" name="maintenance" value="1" ${cfg.settings.maintenance ? "checked" : ""}> ${t.set_maint} <span class="dim">${t.set_mainthint}</span></label>
    <h3 style="margin-top:22px">${t.set_tg} <span class="dim">${t.set_optional}</span></h3>
    ${guide(t.guide, t.g_tg)}
    <label>${t.set_token}</label>
    <input name="tgToken" value="${esc(cfg.settings.telegramToken)}" placeholder="1234:AA...">
    <label>${t.set_chat}</label>
    <input name="tgChat" value="${esc(cfg.settings.telegramChat)}" placeholder="123456789">
    <button class="btn">${t.set_savebtn}</button>
  </form>
</div>
<div class="box">
  <form method="post" action="/admin?do=password">
    <input type="hidden" name="tab" value="settings">
    <h3>${t.set_pw}</h3>
    <label>${t.set_new}</label>
    <input name="pw1" type="password" autocomplete="new-password">
    <label>${t.set_again}</label>
    <input name="pw2" type="password" autocomplete="new-password">
    <button class="btn">${t.set_pwbtn}</button>
  </form>
</div>`;
}

/* ---------- diagnostics ---------- */

function diagTab(t, lang) {
  const rows = lang === "bn"
    ? [["<code>ok: true</code>", "কাজ করছে", "কিছু করার নেই"],
       ["<code>http 401</code> / <code>login wall</code>", "Instagram কুকি গ্রহণ করেনি", "নতুন sessionid যোগ করুন"],
       ["<code>http 429</code>", "ওই অ্যাকাউন্টে অতিরিক্ত রিকোয়েস্ট", "আরও কুকি যোগ করুন, ক্যাশ সময় বাড়ান"],
       ["<code>no items</code> / <code>404</code>", "পোস্ট প্রাইভেট বা ডিলিট করা", "কিছু করার নেই — স্বাভাবিক"],
       ["<code>bad shortcode</code>", "এটা পোস্টের লিংক না", "Share → Copy link ব্যবহার করুন"]]
    : [["<code>ok: true</code>", "Working", "Nothing to do"],
       ["<code>http 401</code> / <code>login wall</code>", "Instagram rejected the cookie", "Add a fresh sessionid"],
       ["<code>http 429</code>", "Too many requests on that account", "Add more cookies, raise cache duration"],
       ["<code>no items</code> / <code>404</code>", "Post is private or deleted", "Nothing — expected"],
       ["<code>bad shortcode</code>", "Not a post link", "Use Share → Copy link"]];

  return `
<div class="box">
  <h3>${t.d_test}</h3>
  <p class="dim">${t.d_intro}</p>
  <input id="diagurl" placeholder="https://www.instagram.com/reel/...">
  <button class="btn" onclick="runDiag()">${t.d_run}</button>
  <pre id="diagout" class="out hide"></pre>
</div>
<div class="box">
  <h3>${t.d_read}</h3>
  <table class="wide"><tr><th>${t.d_what}</th><th>${t.d_means}</th><th>${t.d_fix}</th></tr>
  ${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table>
</div>`;
}

/* ---------- help ---------- */

function helpTab(lang) {
  const H = lang === "bn" ? HELP.bn : HELP.en;
  return H.map((sec) => `<div class="box"><h3>${sec.h}</h3><${sec.ol ? "ol" : "ul"} class="steps">${sec.items.map((i) => `<li>${i}</li>`).join("")}</${sec.ol ? "ol" : "ul"}></div>`).join("");
}

const HELP = {
  bn: [
    { h: "কিছু ভেঙে গেলে — ক্রম অনুযায়ী যা করবেন", ol: true, items: [
      "<b>ডায়াগনস্টিক ট্যাব খুলুন</b> আর একটা পাবলিক রিল দিয়ে টেস্ট করুন।",
      "<b>সব মেথডে 401 বা login wall দেখালে</b> → কুকি মেয়াদোত্তীর্ণ। কুকি ট্যাবে নতুন sessionid যোগ করুন, মরাগুলো মুছুন।",
      "<b>mobile-api ফেল করছে কিন্তু বাকিগুলো কাজ করছে</b> → Instagram নিজেদের দিকে কিছু বদলেছে। সাধারণত একদিনের মধ্যে ঠিক হয়ে যায়। ততক্ষণ বাকি মেথড সাইট চালু রাখবে।",
      "<b>একটা নির্দিষ্ট লিংক ফেল করছে, বাকিগুলো ঠিক</b> → ওই পোস্ট প্রাইভেট বা ডিলিট করা। সাইটে কোনো সমস্যা নেই।",
      "<b>সব ঠিক দেখাচ্ছে কিন্তু ইউজার অভিযোগ করছে</b> → ড্যাশবোর্ড থেকে ক্যাশ পরিষ্কার করুন। পুরনো জমানো লিংক মেয়াদোত্তীর্ণ হয়ে থাকতে পারে।",
    ]},
    { h: "নিয়মিত রক্ষণাবেক্ষণ", items: [
      "<b>সাপ্তাহিক:</b> ড্যাশবোর্ডে একবার চোখ বুলান। সফলতার হার ৮০%-এর নিচে মানে কোনো কুকি মরছে।",
      "<b>মাসিক:</b> একটা নতুন কুকি যোগ করুন, সবচেয়ে পুরনোটা মুছুন।",
      "<b>সবসময় ২-৩টা সচল কুকি রাখুন।</b> একটা মানে একটাই ঝুঁকি।",
      "প্রতি ৩০ মিনিটে হেলথ চেক নিজে নিজেই চলে আর মরা কুকি বাদ দিয়ে দেয়।",
    ]},
    { h: "বৃদ্ধির চেকলিস্ট", ol: true, items: [
      "GA4 আর Search Console যোগ করুন (SEO ট্যাব), sitemap জমা দিন।",
      "সপ্তাহে একটা ব্লগ পোস্ট — মানুষ যে নির্দিষ্ট প্রশ্ন সার্চ করে সেটা ধরে।",
      "দুইটা অ্যাড স্লট চালু করুন, দশটা না। মেপে দেখুন, তারপর বাড়ান।",
      "আসল কনটেন্ট আর নিয়মিত ট্রাফিক হলে AdSense-এ apply করুন। reject হলে Ezoic, তারপর Adsterra।",
      "ড্যাশবোর্ডে কোন দেশ আসছে দেখুন, ওদের জন্য লিখুন।",
    ]},
    { h: "ফ্রি প্ল্যান ছাড়িয়ে গেলে", items: [
      "Cloudflare ফ্রি প্ল্যানে দিনে ১,০০,০০০ রিকোয়েস্ট। প্রতি ভিজিটরে প্রায় ৩টা লাগে, তাই ~৩৩ হাজার ভিজিটর।",
      "ড্যাশবোর্ডে সীমার কাছে পৌঁছাতে দেখলে <b>Workers Paid ($৫/মাস)</b> নিন — দৈনিক সীমা পুরো উঠে যাবে।",
      "ক্যাশ সময় বাড়ালে ইতিমধ্যে অনেকটা জায়গা তৈরি হয়।",
    ]},
  ],
  en: [
    { h: "Something broke — what to do, in order", ol: true, items: [
      "<b>Open Diagnostics</b> and test a reel you know is public.",
      "<b>If every method says 401 or login wall</b> → cookies expired. Add a fresh sessionid in Cookies and delete the dead ones.",
      "<b>If mobile-api fails but others work</b> → Instagram changed something on their side. It usually fixes itself within a day; the other methods keep the site running meanwhile.",
      "<b>If one specific link fails but others work</b> → that post is private or deleted. Nothing is wrong with the site.",
      "<b>If everything looks fine but users complain</b> → clear the cache on the Dashboard. A stale entry may be holding an expired media URL.",
    ]},
    { h: "Routine upkeep", items: [
      "<b>Weekly:</b> glance at the dashboard. Success rate under 80% means a cookie is dying.",
      "<b>Monthly:</b> add one fresh cookie, delete the oldest.",
      "<b>Always keep 2–3 working cookies.</b> One is a single point of failure.",
      "A health check runs every 30 minutes and retires dead cookies on its own.",
    ]},
    { h: "Growth checklist", ol: true, items: [
      "Connect GA4 and Search Console (SEO tab), submit the sitemap.",
      "Publish one blog post a week targeting a specific question people search for.",
      "Turn on two ad slots, not ten. Measure, then adjust.",
      "Apply to AdSense once you have real content and steady traffic. If rejected, try Ezoic, then Adsterra.",
      "Watch which countries show up on the dashboard and write for them.",
    ]},
    { h: "Scaling past the free plan", items: [
      "Cloudflare's free plan allows 100,000 requests a day. Each visitor uses roughly three, so about 33,000 visitors.",
      "When the dashboard shows you nearing that, upgrade to <b>Workers Paid ($5/month)</b> and the daily limit disappears.",
      "Raising cache duration already buys a lot of headroom.",
    ]},
  ],
};

/* ===================== bits ===================== */

function guide(label, text) {
  return `<details class="guide"><summary>${label}</summary><div>${esc(text).replace(/\n/g, "<br>")}</div></details>`;
}
function stat(label, value, tone = "") {
  return `<div class="card ${tone}"><span>${label}</span><b>${value}</b></div>`;
}
function postBtn(action, tab, label, cls = "") {
  return `<form method="post" action="/admin?do=${action}" style="display:inline"><input type="hidden" name="tab" value="${tab}"><button class="btn ${cls}">${label}</button></form>`;
}
function bad(t) { return `<div class="alert bad">${esc(t)}</div>`; }
function mid(t) { return `<div class="alert mid">${esc(t)}</div>`; }
function ago(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  if (m < 1440) return Math.floor(m / 60) + "h";
  return Math.floor(m / 1440) + "d";
}
function json(o) { return new Response(JSON.stringify(o, null, 2), { headers: { "content-type": "application/json" } }); }
function langOf(request) {
  const m = (request.headers.get("cookie") || "").match(/iglang=(bn|en)/);
  return m ? m[1] : "bn";
}

function loginForm(err, t, lang) {
  return `<div class="login">
  <div class="logo"><span class="mk"></span>IGtoDownload <em>${t.admin}</em></div>
  ${err ? `<div class="alert bad">${esc(err)}</div>` : ""}
  <form method="post" action="/admin?do=login">
    <input name="pw" type="password" placeholder="${t.password}" autocomplete="current-password" autofocus>
    <button class="btn">${t.signin}</button>
  </form>
  <div class="lang mid-lang">
    <a href="/admin?lang=bn" class="${lang === "bn" ? "on" : ""}">বাংলা</a>
    <a href="/admin?lang=en" class="${lang === "en" ? "on" : ""}">EN</a>
  </div>
</div>`;
}

function page(inner, bare) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Admin — IGtoDownload</title>
<style>${ACSS}</style></head>
<body class="${bare ? "bare" : ""}"><div class="wrap">${inner}</div>
<script>${AJS}</script></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } }
  );
}

/* ===================== auth ===================== */

async function checkPassword(pw, env) {
  const stored = await env.CONFIG.get("adminpw");
  if (stored) return (await sha256(pw)) === stored;
  return pw === (env.ADMIN_PASSWORD || "@Shadhin1234");
}
async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sessKey(env) {
  const secret = (env.SIGN_SECRET || "igtodownload-default-change-me") + "|admin";
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function mkSession(env) {
  const t = btoa(String(Date.now() + SESSION_HOURS * 3600_000)).replace(/=+$/, "");
  const sig = await crypto.subtle.sign("HMAC", await sessKey(env), new TextEncoder().encode(t));
  const s = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return t + "." + s;
}
async function validSession(request, env) {
  const m = (request.headers.get("cookie") || "").match(/igadm=([^;]+)/);
  if (!m) return false;
  const [t, s] = decodeURIComponent(m[1]).split(".");
  if (!t || !s) return false;
  try {
    const p = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
    const sig = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) sig[i] = bin.charCodeAt(i);
    if (!(await crypto.subtle.verify("HMAC", await sessKey(env), sig, new TextEncoder().encode(t)))) return false;
    return +atob(t) > Date.now();
  } catch { return false; }
}

/* ===================== styles ===================== */

const ACSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0b0b11;color:#ececf1;font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Bengali",Arial,sans-serif;padding:16px 14px 60px}
body.bare{display:grid;place-items:center;min-height:100vh;padding:20px}
.wrap{max-width:880px;margin:0 auto;width:100%}
.top{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.logo{font-weight:800;font-size:17px;display:flex;align-items:center;gap:9px}
.logo em{font-style:normal;color:#8c8c9b;font-weight:600;font-size:13px}
.mk{width:24px;height:24px;border-radius:7px;background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc)}
.lang{display:flex;gap:4px;margin-left:auto;background:#15151d;border:1px solid #23232c;border-radius:9px;padding:3px}
.lang a{padding:5px 11px;border-radius:7px;color:#8c8c9b;text-decoration:none;font-size:12.5px;font-weight:600}
.lang a.on{background:#262630;color:#fff}
.mid-lang{margin:16px auto 0;width:fit-content}
.out{color:#8c8c9b;text-decoration:none;font-size:13px;border:1px solid #26262f;padding:7px 12px;border-radius:9px}
.tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;-webkit-overflow-scrolling:touch}
.tabs a{white-space:nowrap;padding:8px 14px;border-radius:10px;background:#15151d;border:1px solid #23232c;color:#9a9aa8;text-decoration:none;font-size:13.5px;font-weight:600}
.tabs a.on{background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc);color:#fff;border-color:transparent}
.msg{background:rgba(43,217,124,.1);border:1px solid rgba(43,217,124,.35);padding:11px 14px;border-radius:11px;margin-bottom:12px;font-size:14px}
.alert{padding:11px 14px;border-radius:11px;margin-bottom:12px;font-size:14px}
.alert.bad{background:rgba(249,55,125,.1);border:1px solid rgba(249,55,125,.38)}
.alert.mid{background:rgba(255,170,60,.09);border:1px solid rgba(255,170,60,.32)}
.box{background:#13131a;border:1px solid #23232c;border-radius:15px;padding:16px;margin-bottom:13px}
.box h3{font-size:15.5px;margin-bottom:10px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:13px}
@media(max-width:700px){.two{grid-template-columns:1fr}}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px}
.card{background:#13131a;border:1px solid #23232c;border-radius:14px;padding:14px}
.card span{display:block;color:#8c8c9b;font-size:12px;margin-bottom:5px}
.card b{font-size:24px;font-weight:800}
.card.good b{color:#2bd97c}.card.mid b{color:#ffaa3c}.card.bad b{color:#ff5c8a}
.guide{background:#101017;border:1px solid #23232c;border-radius:11px;margin:9px 0 2px;overflow:hidden}
.guide summary{cursor:pointer;padding:10px 13px;font-size:13px;color:#b07ff0;font-weight:600;list-style:none}
.guide summary::-webkit-details-marker{display:none}
.guide[open] summary{border-bottom:1px solid #1e1e26}
.guide div{padding:12px 13px;font-size:13.5px;color:#b9b9c6;line-height:1.85}
.chart{display:flex;align-items:flex-end;gap:3px;height:90px;margin-top:6px}
.bar{flex:1;background:#1b1b24;border-radius:3px;display:flex;align-items:flex-end;overflow:hidden;min-height:3px}
.bar span{width:100%;background:linear-gradient(180deg,#f9377d,#8a3ffc);border-radius:3px;min-height:3px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;color:#8c8c9b;font-weight:600;font-size:12px;padding:6px 8px 6px 0;border-bottom:1px solid #23232c}
td{padding:9px 8px 9px 0;border-bottom:1px solid #1b1b23;vertical-align:middle}
tr.sub td{color:#ff7fa5;font-size:12px;padding-top:0;border:0}
.nowrap{white-space:nowrap;text-align:right}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.dot.ok{background:#2bd97c}.dot.warn{background:#ffaa3c}.dot.dead{background:#ff5c8a}
label{display:block;font-size:13px;font-weight:600;margin:12px 0 5px}
label.check{display:flex;align-items:center;gap:8px;font-weight:500}
label.check input{width:auto;margin:0}
input,textarea,select{width:100%;background:#0d0d13;border:1px solid #26262f;color:#ececf1;border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit}
textarea{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;resize:vertical}
input:focus,textarea:focus,select:focus{outline:none;border-color:#f9377d}
.btn{background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc);border:0;color:#fff;font-weight:700;padding:11px 18px;border-radius:11px;cursor:pointer;font-size:14px;margin-top:13px;font-family:inherit}
.btn.ghost{background:#1b1b24;border:1px solid #2a2a34;color:#c9c9d4}
.mini{background:#1b1b24;border:1px solid #2a2a34;color:#c9c9d4;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;margin-left:5px;font-family:inherit}
.mini.danger{color:#ff7fa5;border-color:rgba(249,55,125,.3)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.row .btn{margin-top:0}
.dim{color:#8c8c9b;font-size:13px;margin-top:4px}
code{background:#0d0d13;border:1px solid #26262f;border-radius:5px;padding:1px 5px;font-size:12.5px}
.steps{margin:8px 0 0 18px;font-size:14px;color:#b9b9c6}
.steps li{margin-bottom:10px}
.steps b{color:#ececf1}
.slot{border-top:1px solid #1e1e26;padding-top:13px;margin-top:13px}
.slothead{display:flex;gap:10px;align-items:center}
.slothead select{width:auto;padding:6px 9px;font-size:12.5px;margin-left:auto}
.out{background:#0d0d13;border:1px solid #26262f;border-radius:10px;padding:12px;font-size:12px;white-space:pre-wrap;word-break:break-word;margin-top:12px;max-height:340px;overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace}
.hide{display:none}
.login{width:100%;max-width:330px}
.login .logo{justify-content:center;margin-bottom:18px}
.login .btn{width:100%}
a{color:#ff8ab0}
`;

const AJS = `
function show(id,txt){var e=document.getElementById(id);if(!e)return;e.classList.remove('hide');e.textContent=txt}
function runDiag(){
  var v=document.getElementById('diagurl').value.trim();
  if(!v){alert('Paste a link first');return}
  show('diagout','Testing...');
  fetch('/admin?api=diag&url='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(d){
    if(d.error){show('diagout',d.error);return}
    var s='shortcode: '+d.code+'\\n\\n';
    d.rows.forEach(function(r){s+=(r.ok?'  OK  ':' FAIL ')+' | '+pad(r.cookie,16)+' | '+pad(r.method,14)+' | '+pad(r.ms+'ms',7)+' | '+(r.ok?('items: '+r.items):(r.error||''))+'\\n'});
    show('diagout',s);
  }).catch(function(){show('diagout','Request failed.')});
}
function runHealth(){
  show('healthout','Checking...');
  fetch('/admin?api=health').then(function(r){return r.json()}).then(function(d){
    show('healthout','Checked: '+d.checked+'\\nWorking: '+d.live+'\\nRevived: '+(d.revived||0)+'\\n\\nReload the page to see updated statuses.');
  }).catch(function(){show('healthout','Request failed.')});
}
function pad(s,n){s=String(s||'');while(s.length<n)s+=' ';return s}
`;
