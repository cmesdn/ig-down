/**
 * admin.js — /admin control panel (Bangla + English)
 * Every option carries a click-to-open guide, so nothing needs to be memorised.
 */

import { getConfig, saveConfig, getCookies, saveCookies, getStats, AD_SLOTS, normalizeCookie, flushCookieCache } from "./store.js";
import { testCookie, healthCheck } from "./resolve.js";
import { siteStatus, statusLine, fullDiagnose, quickCheck } from "./monitor.js";
import { getVapid, addSub, removeSub, clearSubs, pushAll, getSubs } from "./push.js";
import { createBroadcast, sendBatch, audience, testOne } from "./broadcast.js";
import { liveNow, report, resetData } from "./visits.js";
import { flushAll } from "./store.js";
import { esc } from "./pages.js";

const SESSION_HOURS = 24;
const TRIES = new Map();

/* ===================== strings ===================== */

const L = {
  bn: {
    admin: "এডমিন", signout: "সাইন আউট", signin: "সাইন ইন", password: "পাসওয়ার্ড",
    wrongpw: "ভুল পাসওয়ার্ড।", toomany: "অনেকবার ভুল হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।",
    guide: "📖 গাইড দেখুন", save: "সেভ করুন",
    tabs: { monitor: "লাইভ", visitors: "ভিজিটর", home: "ড্যাশবোর্ড", users: "নোটিফিকেশন", cookies: "কুকি", ads: "অ্যাড", seo: "SEO", settings: "সেটিংস", diag: "ডায়াগনস্টিক", help: "সাহায্য" },

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

    mo_live: "লাইভ অবস্থা", mo_checking: "দেখা হচ্ছে...", mo_updated: "শেষ দেখা হয়েছে",
    mo_secago: "সেকেন্ড আগে", mo_refresh: "এখনই দেখুন", mo_auto: "স্বয়ংক্রিয়",
    mo_cookies: "কুকি", mo_today: "আজ", mo_rate: "সফলতা", mo_layers: "সুরক্ষা স্তর",
    mo_l1: "কুকি পুল", mo_l2: "Anonymous", mo_l3: "বাইরের API", mo_proxy: "প্রক্সি",
    mo_on: "চালু", mo_off: "বন্ধ",
    mo_quick: "লিংক পরীক্ষা করুন", mo_quickhint: "একটা রিলের লিংক দিন — এখনই কাজ করছে কিনা বলে দেব, সহজ ভাষায়।",
    mo_check: "পরীক্ষা করুন", mo_full: "বিস্তারিত দেখুন",
    mo_alerts: "সতর্কতা ও ভাইব্রেশন", mo_vib: "ভাইব্রেশন চালু",
    mo_vsec: "ভাইব্রেশনের দৈর্ঘ্য (সেকেন্ড)", mo_vrep: "কতবার কাঁপবে", mo_vgap: "দুই কাঁপুনির মাঝে বিরতি (মিলিসেকেন্ড)",
    mo_poll: "কত সেকেন্ড পরপর দেখবে", mo_warn: "সতর্কতাতেও জানাবে (শুধু বন্ধ হলে নয়)",
    mo_repeat: "সমস্যা চললে কত মিনিট পরপর মনে করাবে", mo_alang: "নোটিফিকেশনের ভাষা",
    mo_testvib: "ভাইব্রেশন পরীক্ষা", mo_savealert: "সতর্কতা সেভ করুন",
    mo_phone: "ফোনে অ্যাপ ও নোটিফিকেশন", mo_install: "অ্যাপ ইনস্টল করুন",
    mo_enablen: "নোটিফিকেশন চালু করুন", mo_testpush: "টেস্ট নোটিফিকেশন পাঠান",
    mo_devices: "যুক্ত ডিভাইস", mo_offn: "নোটিফিকেশন বন্ধ করুন",
    g_mo_alerts: "দুই রকম সতর্কতা আছে, দুটোই আলাদা কাজ করে।\n\n১. অ্যাপ খোলা থাকলে — এই পাতা নিজে নিজেই নির্দিষ্ট সময় পরপর অবস্থা দেখে। সমস্যা পেলে সাথে সাথে ফোন কাঁপে, ঠিক যত সেকেন্ড আপনি বলেছেন। কোনো শব্দ হবে না, শুধু ভাইব্রেশন।\n\n২. অ্যাপ বন্ধ থাকলে — পুশ নোটিফিকেশন আসে। এর জন্য নিচে \"নোটিফিকেশন চালু করুন\" চাপতে হবে একবার।\n\n⚠️ শব্দ বন্ধ করতে: Android সেটিংস → Apps → Chrome → Notifications → Sites → শব্দ বন্ধ, ভাইব্রেশন চালু। ওয়েব থেকে শব্দ আলাদা করে বন্ধ করা যায় না, কিন্তু ফোনের সেটিংস থেকে যায়।\n\niPhone-এ: ভাইব্রেশন API কাজ করে না, আর পুশ পেতে হলে অবশ্যই অ্যাপটা হোম স্ক্রিনে ইনস্টল করতে হবে।",
    g_mo_install: "এটা হোম স্ক্রিনে বসালে সাধারণ অ্যাপের মতোই খুলবে — ব্রাউজারের অ্যাড্রেস বার থাকবে না।\n\nAndroid: Chrome মেনু (⋮) → \"Add to Home screen\" বা \"Install app\"। নিচের বাটনেও কাজ হতে পারে।\n\niPhone: Safari → Share বাটন → \"Add to Home Screen\"। iPhone-এ পুশ নোটিফিকেশন পেতে এটা বাধ্যতামূলক।\n\nইনস্টল করার পর অ্যাপ আইকন থেকেই সরাসরি লাইভ পাতায় ঢুকবেন।",
    set_probe: "হেলথ চেকের টেস্ট লিংক", set_probehint: "(ঐচ্ছিক)",
    g_probe: "প্রতি ৩০ মিনিটে সাইট একটা পরিচিত রিল দিয়ে সব cookie পরীক্ষা করে।\n\nকোন রিল দিয়ে করবে?\nযে রিলটা সবচেয়ে শেষে সফলভাবে ডাউনলোড হয়েছে, সেটা নিজে নিজেই মনে রাখে। তাই সাধারণত এই ঘরটা খালি রাখলেই চলে।\n\nএখানে নিজের একটা স্থায়ী পাবলিক রিলের লিংক দিলে আরও নিশ্চিত হয় — এমন একটা রিল বেছে নিন যেটা কখনো মুছবেন না (নিজের অ্যাকাউন্টের হলে সবচেয়ে ভালো)।\n\n⚠️ গুরুত্বপূর্ণ: টেস্ট রিলটা মুছে গেলে বা প্রাইভেট হলে হেলথ চেক আর কোনো cookie-কে মৃত চিহ্নিত করবে না — ভুল করে পুরো পুল মেরে ফেলার চেয়ে কিছু না করা ভালো।",
    set_fb: "ফলব্যাক স্তর", set_proxy: "প্রক্সি", set_api: "বাইরের API (শেষ ভরসা)",
    set_ptpl: "প্রক্সি URL টেমপ্লেট", set_phdr: "প্রক্সি হেডার (JSON)",
    set_atpl: "API এন্ডপয়েন্ট টেমপ্লেট", set_ahdr: "API হেডার (JSON)",
    g_layers: "সাইট এখন তিন স্তরে চেষ্টা করে, একটা ফেল করলে পরেরটা:\n\n১. প্রতিটা সচল cookie × ৪টা মেথড\n২. anonymous (cookie ছাড়া) × ৪টা মেথড — কিছু পাবলিক পোস্ট এভাবেও আসে\n৩. বাইরের API — নিচে সেট করলে\n\nঅর্থাৎ সব cookie মরে গেলেও সাইট পুরো শূন্য হবে না। তিন স্তর একসাথে ফেল করা প্রায় অসম্ভব।",
    g_proxy: "Cloudflare-এর IP Instagram চেনে। ট্রাফিক বাড়লে প্রক্সি লাগবে।\n\nWorkers সাধারণ HTTP প্রক্সি সাপোর্ট করে না, তাই URL-ভিত্তিক প্রক্সি ব্যবহার করতে হয়। টেমপ্লেটে {url} লিখলে ওখানে আসল ঠিকানা বসে যাবে।\n\nউদাহরণ:\nhttps://api.example.com/fetch?key=ABC&url={url}\n\nহেডার লাগলে JSON-এ দিন:\n{\"X-API-Key\": \"abc123\"}\n\nখালি রাখলে কিছুই বদলায় না — সরাসরি Instagram-এ যাবে। দিনে ১ লাখের নিচে থাকলে দরকার নেই।",
    g_api: "সব cookie মরে গেলে আর anonymous-ও কাজ না করলে এটা শেষ ভরসা।\n\nযেকোনো resolver API চলবে — উত্তরের গঠন যাই হোক, JSON-এর ভেতর .mp4 বা .jpg লিংক খুঁজে নেওয়া হয়।\n\nটেমপ্লেটে {url} বা {shortcode} ব্যবহার করুন:\nhttps://instagram-api.example.com/media?url={url}\n\nRapidAPI হলে হেডার:\n{\"X-RapidAPI-Key\": \"...\", \"X-RapidAPI-Host\": \"...\"}\n\nখরচ হয় (মাসে ~$৫-১৫), কিন্তু সাইট আক্ষরিক অর্থে কখনো বন্ধ হবে না। খালি রাখলে এই স্তরটা শুধু নিষ্ক্রিয় থাকবে।",
    h_broke: "কিছু ভেঙে গেলে — ক্রম অনুযায়ী যা করবেন",
    h_routine: "নিয়মিত রক্ষণাবেক্ষণ", h_growth: "বৃদ্ধির চেকলিস্ট", h_scale: "ফ্রি প্ল্যান ছাড়িয়ে গেলে",
  },

  en: {
    admin: "admin", signout: "Sign out", signin: "Sign in", password: "Password",
    wrongpw: "Wrong password.", toomany: "Too many attempts. Try again in a few minutes.",
    guide: "📖 Show guide", save: "Save",
    tabs: { monitor: "Live", visitors: "Visitors", home: "Dashboard", users: "Notify", cookies: "Cookies", ads: "Ads", seo: "SEO", settings: "Settings", diag: "Diagnostics", help: "Help" },

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

    mo_live: "Live status", mo_checking: "Checking...", mo_updated: "Last checked",
    mo_secago: "seconds ago", mo_refresh: "Check now", mo_auto: "Auto",
    mo_cookies: "Cookies", mo_today: "Today", mo_rate: "Success", mo_layers: "Safety layers",
    mo_l1: "Cookie pool", mo_l2: "Anonymous", mo_l3: "External API", mo_proxy: "Proxy",
    mo_on: "on", mo_off: "off",
    mo_quick: "Check a link", mo_quickhint: "Paste a reel link and I will tell you, in plain words, whether it works right now.",
    mo_check: "Check", mo_full: "Show details",
    mo_alerts: "Alerts and vibration", mo_vib: "Vibration on",
    mo_vsec: "Vibration length (seconds)", mo_vrep: "How many buzzes", mo_vgap: "Gap between buzzes (ms)",
    mo_poll: "Check every N seconds", mo_warn: "Alert on warnings too (not only when down)",
    mo_repeat: "Remind every N minutes while a problem lasts", mo_alang: "Notification language",
    mo_testvib: "Test vibration", mo_savealert: "Save alerts",
    mo_phone: "Phone app and notifications", mo_install: "Install app",
    mo_enablen: "Turn on notifications", mo_testpush: "Send a test notification",
    mo_devices: "Connected devices", mo_offn: "Turn notifications off",
    g_mo_alerts: "There are two kinds of alert, and they work differently.\n\n1. While the app is open — this page checks the status on its own every few seconds. The moment something is wrong the phone vibrates for exactly as many seconds as you set. No sound, vibration only.\n\n2. While the app is closed — a push notification arrives. Press \"Turn on notifications\" below once to enable that.\n\n⚠️ To silence the sound: Android Settings → Apps → Chrome → Notifications → Sites → turn sound off, keep vibration on. The web cannot mute sound separately, but your phone settings can.\n\nOn iPhone: the vibration API does not work, and push only arrives if the app is installed to the home screen.",
    g_mo_install: "Installed to the home screen, this opens like an ordinary app with no browser address bar.\n\nAndroid: Chrome menu (⋮) → \"Add to Home screen\" or \"Install app\". The button below may also work.\n\niPhone: Safari → Share → \"Add to Home Screen\". On iPhone this is required for push notifications to arrive at all.\n\nAfter installing, the app icon takes you straight to the live page.",
    set_probe: "Health check test link", set_probehint: "(optional)",
    g_probe: "Every 30 minutes the site tests all cookies against one known post.\n\nWhich post?\nThe last reel that downloaded successfully is remembered automatically, so this field can usually stay empty.\n\nSetting your own permanent public reel here makes it more reliable — pick one you will never delete (your own account is ideal).\n\n⚠️ Important: if the test post is deleted or goes private, the health check now marks nothing as dead. Doing nothing is safer than wrongly killing the whole pool.",
    set_fb: "Fallback layers", set_proxy: "Proxy", set_api: "External API (last resort)",
    set_ptpl: "Proxy URL template", set_phdr: "Proxy headers (JSON)",
    set_atpl: "API endpoint template", set_ahdr: "API headers (JSON)",
    g_layers: "The site now tries three layers, falling through as each fails:\n\n1. every live cookie × 4 methods\n2. anonymous (no cookie) × 4 methods — some public posts still come through\n3. external API — if configured below\n\nSo even with every cookie dead, the site is not completely down. All three failing at once is close to impossible.",
    g_proxy: "Instagram recognises Cloudflare's IP ranges. As traffic grows you will need a proxy.\n\nWorkers cannot use ordinary HTTP proxies, so this takes a URL-based one. Put {url} in the template and the real address is substituted there.\n\nExample:\nhttps://api.example.com/fetch?key=ABC&url={url}\n\nIf it needs headers, give them as JSON:\n{\"X-API-Key\": \"abc123\"}\n\nLeave it empty and nothing changes — requests go straight to Instagram. Below 100k a day you do not need this.",
    g_api: "The last resort, used only when every cookie is dead and anonymous fails too.\n\nAny resolver API works — whatever shape the response has, the JSON is scanned for .mp4 and .jpg links.\n\nUse {url} or {shortcode} in the template:\nhttps://instagram-api.example.com/media?url={url}\n\nFor RapidAPI, headers look like:\n{\"X-RapidAPI-Key\": \"...\", \"X-RapidAPI-Host\": \"...\"}\n\nIt costs money (roughly $5–15/month) but the site then literally cannot go down. Leave it blank and the layer simply stays off.",
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
      // the admin app is fingerprint-locked on the phone, so it can stay signed in for 90 days
      const hours = /IGtoAdminApp/.test(request.headers.get("user-agent") || "") ? 24 * 90 : SESSION_HOURS;
      return new Response(null, {
        status: 302,
        headers: { location: "/admin", "set-cookie": `igadm=${await mkSession(env, hours)}; Path=/admin; Max-Age=${hours * 3600}; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    const n = ((tr && tr.n) || 0) + 1;
    TRIES.set(ip, { n, until: n >= 5 ? Date.now() + 9e5 : 0 });
    return page(loginForm(t.wrongpw, t, lang), true);
  }

  if (!(await validSession(request, env))) return page(loginForm("", t, lang), true);

  const api = url.searchParams.get("api");
  if (api) return await handleApi(api, request, url, env, lang);

  if (request.method === "POST") {
    const form = await request.formData();
    const msg = await runAction(url.searchParams.get("do"), form, env, lang);
    return new Response(null, { status: 302, headers: { location: "/admin?tab=" + String(form.get("tab") || "home") + "&m=" + encodeURIComponent(msg) } });
  }

  return page(await body(url.searchParams.get("tab") || "monitor", env, url.searchParams.get("m") || "", lang), false, lang);
}

/* ===================== json api ===================== */

async function handleApi(api, request, url, env, lang) {
  switch (api) {
    case "status":
    case "pubstatus": {
      const st = await siteStatus(env);
      st.liveNow = (await liveNow(env)).now;
      st.line = statusLine(st, (st.alerts && st.alerts.lang) || lang);
      return json(st);
    }
    case "health":
      return json(await healthCheck(env));
    case "quick":
      return json(await quickCheck(url.searchParams.get("url") || "", env, lang));
    case "diag":
      return json(await fullDiagnose(url.searchParams.get("url") || "", env, lang));
    case "vapid": {
      const v = await getVapid(env);
      return json({ key: v.publicKey });
    }
    case "subscribe": {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const body = await request.json().catch(() => null);
      if (!body || !body.endpoint) return json({ error: "bad subscription" }, 400);
      const n = await addSub(env, body, request.headers.get("user-agent"));
      return json({ ok: true, devices: n });
    }
    case "unsubscribe": {
      const body = await request.json().catch(() => ({}));
      const n = body && body.endpoint ? await removeSub(env, body.endpoint) : (await clearSubs(env), 0);
      return json({ ok: true, devices: n });
    }
    case "testpush": {
      const r = await pushAll(env);
      const subs = await getSubs(env);
      return json(Object.assign({ devices: subs.length }, r));
    }
    case "bcreate": {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const b = await request.json().catch(() => null);
      if (!b || !String(b.title || "").trim() || !String(b.body || "").trim())
        return json({ error: lang === "bn" ? "শিরোনাম আর বার্তা দুটোই লিখুন।" : "Write both a title and a message." }, 400);
      return json(await createBroadcast(env, {
        title: String(b.title).trim(), body: String(b.body).trim(),
        url: String(b.url || "/").trim() || "/", image: String(b.image || "").trim(), countries: String(b.countries || ""),
      }));
    }
    case "bsend":
      return json(await sendBatch(env, url.searchParams.get("id")));
    case "live":
      return json(await liveNow(env));
    case "btest": {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const b = await request.json().catch(() => ({}));
      return json(await testOne(env, b.id, lang));
    }
    case "visitors":
      return json(Object.assign(await report(env, url.searchParams.get("days")), { live: await liveNow(env) }));
    case "reset": {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const b = await request.json().catch(() => ({}));
      if (b.confirm !== "Confirmed")
        return json({ error: lang === "bn" ? "ঠিক Confirmed লিখতে হবে (বড় হাতের C)।" : "Type Confirmed exactly (capital C)." }, 400);
      const scope = b.scope === "all" ? "all" : "stats";
      const done = await resetData(env, scope);
      flushAll();
      return json({ ok: true, scope, cleared: done });
    }
    case "nimg": {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const b = await request.json().catch(() => ({}));
      const m = String(b.data || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return json({ error: "JPEG only" }, 400);
      const bin = atob(m[1]);
      if (bin.length > 450_000) return json({ error: lang === "bn" ? "ছবিটা অনেক বড়।" : "Picture too large." }, 400);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 16);
      await env.CONFIG.put("nimg:" + id, bytes.buffer, { expirationTtl: 90 * 86400 });
      return json({ ok: true, url: "/n/" + id + ".jpg", size: bin.length });
    }
    default:
      return json({ error: "unknown api" }, 404);
  }
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
    alerts: "অ্যালার্ট সেটিংস সেভ হয়েছে।",
    appcfg: "অ্যাপ সেটিংস সেভ হয়েছে। এক মিনিটের মধ্যে সাইটে দেখা যাবে।",
    addnj: "কুকি যোগ হয়েছে। টেস্ট করা যায়নি: ",
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
    alerts: "Alert settings saved.",
    appcfg: "App settings saved. Live on the site within a minute.",
    addnj: "Cookie added. Could not test it: ",
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
    cfg.settings.proxyTemplate = String(form.get("proxyTemplate") || "").trim();
    cfg.settings.proxyHeaders = String(form.get("proxyHeaders") || "").trim();
    cfg.settings.apiTemplate = String(form.get("apiTemplate") || "").trim();
    cfg.settings.apiHeaders = String(form.get("apiHeaders") || "").trim();
    cfg.settings.probeUrl = String(form.get("probeUrl") || "").trim();
    await saveConfig(env, cfg);
    return m.settings;
  }
  if (action === "appcfg") {
    const app = cfg.app || (cfg.app = { banner: {}, push: {} });
    const b = app.banner || (app.banner = {});
    const p = app.push || (app.push = {});
    const str = (k, n) => String(form.get(k) || "").trim().slice(0, n);
    b.enabled = form.get("bEnabled") === "1";
    b.title = str("bTitle", 60); b.sub = str("bSub", 140); b.button = str("bButton", 18);
    b.escTitle = str("eTitle", 60); b.escSub = str("eSub", 140); b.escButton = str("eButton", 18);
    b.delaySec = clamp(parseInt(form.get("bDelay")) || 4, 1, 60);
    b.snoozeDays = clamp(parseInt(form.get("bSnooze")) || 5, 1, 60);
    p.enabled = form.get("pEnabled") === "1";
    p.after = clamp(parseInt(form.get("pAfter")) || 1, 1, 20);
    p.title = str("pTitle", 50); p.sub = str("pSub", 80); p.button = str("pButton", 18);
    await saveConfig(env, cfg);
    return m.appcfg;
  }

  if (action === "alerts") {
    const a = cfg.alerts;
    a.lang = String(form.get("alertLang") || "bn") === "en" ? "en" : "bn";
    a.vibrate = form.get("vibrate") === "1";
    a.vibrateSeconds = clamp(parseFloat(form.get("vibrateSeconds")) || 2, 0.2, 10);
    a.vibrateRepeat = clamp(parseInt(form.get("vibrateRepeat")) || 3, 1, 10);
    a.vibrateGapMs = clamp(parseInt(form.get("vibrateGapMs")) || 400, 100, 3000);
    a.pollSeconds = clamp(parseInt(form.get("pollSeconds")) || 30, 10, 600);
    a.notifyWarn = form.get("notifyWarn") === "1";
    a.repeatMinutes = clamp(parseInt(form.get("repeatMinutes")) || 180, 15, 1440);
    await saveConfig(env, cfg);
    return m.alerts;
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
    const check = await testCookie(value, env);
    list.push({
      id: "c" + Date.now().toString(36),
      label: String(form.get("label") || "cookie " + (list.length + 1)).slice(0, 40),
      value, status: check.ok ? "ok" : "warn", fails: check.ok ? 0 : 1, uses: 0,
      lastOk: check.ok ? Date.now() : 0, lastError: check.error || "",
    });
    // ok === null means the test post was unavailable, so the cookie is unjudged
    const last = list[list.length - 1];
    if (check.ok === null) { last.status = "ok"; last.fails = 0; }
    await saveCookies(env, list);
    if (check.ok === null) return m.addnj + (check.error || "?");
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
    const r = await testCookie(c.value, env);
    if (r.ok === null) {
      c.lastError = r.error || "";
      await saveCookies(env, list);
      return `"${c.label}" — ${r.error || "?"}`;
    }
    c.status = r.ok ? "ok" : "dead";
    c.fails = r.ok ? 0 : 5;
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
  const order = ["monitor", "visitors", "users", "cookies", "ads", "seo", "settings", "diag", "help"];

  let alert = "";
  if (!cookies.length) alert = bad(t.a_nocookie);
  else if (!live) alert = bad(t.a_alldead);
  else if (live < 2) alert = mid(t.a_one);
  if (cfg.settings.maintenance) alert += bad(t.a_maint);

  const panes = {
    monitor: () => monitorTab(cfg, t, lang),
    visitors: () => visitorsTab(lang),
    users: () => usersTab(env, cfg, t, lang),
    home: () => homeTab(env, cookies, t),
    cookies: () => cookiesTab(cookies, t),
    ads: () => adsTab(cfg, t, lang),
    seo: () => seoTab(cfg, t, lang),
    settings: () => settingsTab(cfg, t),
    diag: async () => diagTab(t, lang) + (await opsBox(env, t)),
    help: () => helpTab(lang),
  };

  return `
<div class="top">
  <div class="logo"><span class="mk"></span>${esc(cfg.brand.name)} <em>${t.admin}</em></div>
  <div class="lang">
    <a href="/admin?lang=bn&tab=${tab}" class="${lang === "bn" ? "on" : ""}">বাংলা</a>
    <a href="/admin?lang=en&tab=${tab}" class="${lang === "en" ? "on" : ""}">EN</a>
  </div>
  <a class="out" href="/admin?logout=1" title="${t.signout}" aria-label="${t.signout}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg></a>
</div>
<div class="tabs">${order.map((k) => `<a href="/admin?tab=${k}" class="${k === tab ? "on" : ""}">${t.tabs[k]}</a>`).join("")}</div>
${msg ? `<div class="msg">${esc(msg)}</div>` : ""}
${alert}
${await panes[tab in panes ? tab : "monitor"]()}`;
}

/* ---------- live monitor ---------- */

function monitorTab(cfg, t, lang) {
  const a = cfg.alerts;
  return `
<div class="box statusbox">
  <div class="stathead">
    <h3>${t.mo_live}</h3>
    <span class="age" id="age">${t.mo_checking}</span>
  </div>
  <div class="bigstat" id="bigstat">
    <span class="ring pending" id="ring"></span>
    <div><b id="stTitle">${t.mo_checking}</b><p id="stBody">&nbsp;</p></div>
  </div>
  <div class="minis" id="minis"></div>
  <div class="row" style="margin-top:12px">
    <button class="btn ghost" onclick="poll(true)">${t.mo_refresh}</button>
    ${postBtn("cache_clear", "monitor", t.clearcache, "ghost")}
    <button class="btn ghost" onclick="runHealth()">${t.c_healthnow}</button>
  </div>
  <pre id="healthout" class="out hide"></pre>
</div>

<div class="box">
  <h3>${t.mo_layers}</h3>
  <div class="layers" id="layers"></div>
</div>

<div class="box">
  <h3>${t.mo_quick}</h3>
  <p class="dim">${t.mo_quickhint}</p>
  <input id="qurl" placeholder="https://www.instagram.com/reel/...">
  <div class="row">
    <button class="btn" onclick="quick()">${t.mo_check}</button>
    <button class="btn ghost" onclick="quickFull()">${t.mo_full}</button>
  </div>
  <div id="qout"></div>
</div>

<div class="box">
  <h3>${t.mo_alerts}</h3>
  ${guide(t.guide, t.g_mo_alerts)}
  <form method="post" action="/admin?do=alerts">
    <input type="hidden" name="tab" value="monitor">
    <label class="check"><input type="checkbox" name="vibrate" value="1" ${a.vibrate ? "checked" : ""}> <b>${t.mo_vib}</b></label>
    <label>${t.mo_vsec}</label>
    <input name="vibrateSeconds" type="number" step="0.1" min="0.2" max="10" value="${a.vibrateSeconds}">
    <label>${t.mo_vrep}</label>
    <input name="vibrateRepeat" type="number" min="1" max="10" value="${a.vibrateRepeat}">
    <label>${t.mo_vgap}</label>
    <input name="vibrateGapMs" type="number" min="100" max="3000" step="50" value="${a.vibrateGapMs}">
    <div class="row" style="margin-top:10px">
      <button type="button" class="btn ghost" onclick="testVib()">${t.mo_testvib}</button>
    </div>
    <label>${t.mo_poll}</label>
    <input name="pollSeconds" type="number" min="10" max="600" value="${a.pollSeconds}">
    <label>${t.mo_repeat}</label>
    <input name="repeatMinutes" type="number" min="15" max="1440" value="${a.repeatMinutes}">
    <label>${t.mo_alang}</label>
    <select name="alertLang">
      <option value="bn" ${a.lang === "bn" ? "selected" : ""}>বাংলা</option>
      <option value="en" ${a.lang === "en" ? "selected" : ""}>English</option>
    </select>
    <label class="check"><input type="checkbox" name="notifyWarn" value="1" ${a.notifyWarn ? "checked" : ""}> ${t.mo_warn}</label>
    <button class="btn">${t.mo_savealert}</button>
  </form>
</div>

<div class="box">
  <h3>${t.mo_phone}</h3>
  ${guide(t.guide, t.g_mo_install)}
  <div class="row">
    <button class="btn" id="btnNotif" onclick="enableNotif()">${t.mo_enablen}</button>
    <button class="btn ghost" id="btnInstall" onclick="doInstall()" style="display:none">${t.mo_install}</button>
    <button class="btn ghost" onclick="testPush()">${t.mo_testpush}</button>
  </div>
  <p class="dim" id="notifState">${t.mo_devices}: <b id="devCount">—</b></p>
  <pre id="pushout" class="out hide"></pre>
</div>`;
}

/* ---------- visitors ---------- */

const V = {
  bn: {
    live: "এখন সাইটে আছে", livehint: "গত ৩ মিনিটে সক্রিয় · নিজে নিজে হালনাগাদ হয়",
    inapp: "অ্যাপ থেকে", countries: "কোন দেশ থেকে", pages: "কোন পেজে", devices: "কোন ডিভাইস",
    p1: "আজ", p7: "৭ দিন", p30: "৩০ দিন", p90: "৯০ দিন",
    visits: "ভিজিট", pageviews: "পেজ দেখা", downloads: "ডাউনলোড", conv: "ডাউনলোড হার", installs: "অ্যাপ ইনস্টল",
    daily: "প্রতিদিন — ভিজিট আর ডাউনলোড", hourly: "আজ, ঘণ্টা অনুযায়ী (UTC)", sources: "কোথা থেকে এসেছে", appsplit: "অ্যাপ বনাম ব্রাউজার",
    app: "অ্যাপ", web: "ব্রাউজার", none: "এখনো ডেটা নেই", totals: "সারসংক্ষেপ",
    keep: "সব ডেটা ৯০ দিন রাখা হয়, তারপর নিজে নিজেই মুছে যায়। পুরো রিসেট করতে চাইলে সেটিংস ট্যাবের একদম নিচে দেখুন।",
    g:
      "এই সংখ্যাগুলো কীভাবে গোনা হয়:\n\n• ভিজিট — একটা ব্রাউজার ট্যাব খোলা থেকে বন্ধ হওয়া পর্যন্ত একটা ভিজিট। একই মানুষ সকালে আর রাতে এলে দুটো ভিজিট।\n• এখন সাইটে আছে — গত ৩ মিনিটে যাদের পাতা খোলা ছিল। পাতা খোলা থাকলে প্রতি ২ মিনিটে একটা ছোট সংকেত আসে।\n• ডাউনলোড হার — কত শতাংশ ভিজিটে অন্তত একটা সফল ডাউনলোড হয়েছে।\n\nকোনো কুকি বা ব্যক্তিগত তথ্য রাখা হয় না — শুধু দেশ, ডিভাইসের ধরন আর কোন পেজ। Google বা অন্য বট গোনা হয় না।\n\nGoogle Analytics-এর সংখ্যার সাথে পুরোপুরি মিলবে না — ওরা ভিন্নভাবে গোনে। প্রবণতা দেখার জন্য দুটোই ঠিক আছে।",
    src: { google: "Google", bing: "Bing", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", x: "X / Twitter", telegram: "Telegram", whatsapp: "WhatsApp", direct: "সরাসরি / বুকমার্ক", "other search": "অন্য সার্চ", other: "অন্যান্য" },
    dev: { android: "Android", ios: "iPhone", desktop: "কম্পিউটার", other: "অন্যান্য" },
  },
  en: {
    live: "On the site right now", livehint: "Active in the last 3 minutes · updates by itself",
    inapp: "in the app", countries: "Countries", pages: "Pages", devices: "Devices",
    p1: "Today", p7: "7 days", p30: "30 days", p90: "90 days",
    visits: "Visits", pageviews: "Page views", downloads: "Downloads", conv: "Download rate", installs: "App installs",
    daily: "Daily — visits and downloads", hourly: "Today by hour (UTC)", sources: "Where they came from", appsplit: "App vs browser",
    app: "App", web: "Browser", none: "No data yet", totals: "Summary",
    keep: "Everything is kept for 90 days and then deleted automatically. For a full reset, see the bottom of the Settings tab.",
    g:
      "How these are counted:\n\n• Visit — one browser tab from opening to closing. Someone who comes in the morning and again at night is two visits.\n• On the site now — anyone whose page was open in the last 3 minutes. An open page sends a tiny signal every 2 minutes.\n• Download rate — the share of visits with at least one successful download.\n\nNo cookies or personal data are stored — only country, device type and page. Google and other bots are not counted.\n\nNumbers will not match Google Analytics exactly; it counts differently. Both are fine for spotting trends.",
    src: { google: "Google", bing: "Bing", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", x: "X / Twitter", telegram: "Telegram", whatsapp: "WhatsApp", direct: "Direct / bookmark", "other search": "Other search", other: "Other" },
    dev: { android: "Android", ios: "iPhone", desktop: "Computer", other: "Other" },
  },
};

function visitorsTab(lang) {
  const T = V[lang];
  return `
<div class="box livebox">
  <div class="stathead"><h3>${T.live}</h3><span class="age" id="vAge"></span></div>
  <div class="livebig"><span class="livedot"></span><b id="vLive">—</b><span id="vApp" class="dim"></span></div>
  <p class="dim">${T.livehint}</p>
  <div class="two" style="margin-top:12px">
    <div><h4 class="mh">${T.countries}</h4><div id="vLC" class="bars"></div></div>
    <div><h4 class="mh">${T.pages}</h4><div id="vLP" class="bars"></div></div>
  </div>
</div>

<div class="seg" id="vSeg">
  <button data-d="1">${T.p1}</button><button data-d="7" class="on">${T.p7}</button><button data-d="30">${T.p30}</button><button data-d="90">${T.p90}</button>
</div>

<div class="cards" id="vCards"></div>
${guide("📖 " + (lang === "bn" ? "সংখ্যাগুলো কীভাবে গোনা হয়" : "How the numbers are counted"), T.g)}

<div class="box"><h3>${T.daily}</h3><div class="chart2" id="vDaily"></div><div class="legend"><span><i class="lv"></i>${T.visits}</span><span><i class="ld"></i>${T.downloads}</span></div></div>
<div class="box"><h3>${T.hourly}</h3><div class="chart2 hours" id="vHours"></div></div>

<div class="two">
  <div class="box"><h3>${T.sources}</h3><div id="vSrc" class="bars"></div></div>
  <div class="box"><h3>${T.countries}</h3><div id="vCtry" class="bars"></div></div>
</div>
<div class="two">
  <div class="box"><h3>${T.pages}</h3><div id="vPages" class="bars"></div></div>
  <div class="box"><h3>${T.devices}</h3><div id="vDev" class="bars"></div><h4 class="mh" style="margin-top:14px">${T.appsplit}</h4><div id="vSplit" class="bars"></div></div>
</div>
<p class="dim" style="margin:4px 2px 0">${T.keep}</p>
<script>window.__V=${JSON.stringify({ T: { visits: T.visits, pageviews: T.pageviews, downloads: T.downloads, conv: T.conv, installs: T.installs, none: T.none, app: T.app, web: T.web, inapp: T.inapp }, src: T.src, dev: T.dev }).replace(/</g, "\\u003c")};</script>`;
}

/* ---------- users & app ---------- */

const U = {
  bn: {
    stats: "অ্যাপ ও ইউজার",
    subs: "নোটিফিকেশন নিয়েছে", inst7: "ইনস্টল (৭ দিন)", inst30: "ইনস্টল (৩০ দিন)", opens: "অ্যাপ খোলা (৭ দিন)", shares: "Share থেকে এসেছে (৭ দিন)",
    bycountry: "কোন দেশের ইউজার নোটিফিকেশন নিয়েছে", none: "এখনো কেউ নেই।",
    banner: "অ্যাপ ইনস্টল ব্যানার", bon: "ব্যানার চালু",
    btitle: "শিরোনাম", bsub: "ছোট বর্ণনা", bbtn: "বাটনের লেখা",
    esc: "Instagram-এর ভেতর থেকে এলে যা দেখাবে", delay: "কত সেকেন্ড পরে দেখাবে", snooze: "বন্ধ করলে কত দিন আর দেখাবে না",
    optin: "নোটিফিকেশন নেওয়ার প্রস্তাব", pon: "প্রস্তাব চালু", pafter: "কতগুলো সফল ডাউনলোডের পরে প্রস্তাব দেবে",
    ptitle: "প্রস্তাবের শিরোনাম", psub: "প্রস্তাবের ছোট লেখা", pbtn: "বাটনের লেখা",
    save: "সেভ করুন",
    compose: "নোটিফিকেশন পাঠান",
    pvhint: "প্রিভিউ — চাপলে বড় হয়ে ছবিসহ দেখাবে, ঠিক যেমন ফোনে নামিয়ে দেখলে দেখায়",
    now: "এখন", phT: "নতুন: Share করলেই ডাউনলোড", phB: "Instagram-এ রিল দেখছেন? Share চাপুন, IGtoDownload বেছে নিন — হয়ে গেল।",
    pic: "ছবি (ঐচ্ছিক)", upload: "📷 ফোন থেকে ছবি দিন", remove: "সরান", orlink: "অথবা ছবির লিংক পেস্ট করুন",
    pichint: "পাশাপাশি লম্বা (২:১) ছবি সবচেয়ে সুন্দর দেখায়, যেমন ১০২৪×৫১২। ফোন থেকে দিলে নিজে নিজেই ছোট করে নেওয়া হবে। শুধু Android-এ ছবি দেখায়।",
    linkto: "চাপলে কোথায় যাবে", home: "হোম", custom: "অন্য লিংক",
    audience: "কারা পাবে", all: "সবাই", reach: "জন পাবেন", sendTo: "জনকে পাঠান", confirmSend: "জনের কাছে এই নোটিফিকেশন যাবে। পাঠাবেন?",
    nosubs: "এই দেশে এখনো কেউ নোটিফিকেশন নেয়নি।", uploading: "ছবি তোলা হচ্ছে...",
    devtitle: "নতুন যুক্ত হওয়া ফোন — পরীক্ষা পাঠান",
    devhint: "নিজের ফোনে নোটিফিকেশন চালু করলে সেটা এখানে সবার উপরে আসবে। \"পরীক্ষা\" চাপলে শুধু ওই ফোনে একটা নোটিফিকেশন যাবে, আর ঠিক কী হলো সেটা সহজ ভাষায় দেখাবে।",
    devtest: "পরীক্ষা", nodev: "এখনো কোনো ফোন যুক্ত হয়নি। সাইটের অ্যাপে উপরের 🔔 বাটন চাপুন, অথবা একটা ডাউনলোডের পর \"Notify me\" চাপুন।",
    ntitle: "শিরোনাম", nbody: "বার্তা", nurl: "ক্লিক করলে কোথায় যাবে", nimg: "ছবির লিংক (ঐচ্ছিক)",
    ncountry: "দেশ (ঐচ্ছিক) — যেমন BD, IN, PK। খালি রাখলে সবাই পাবে",
    send: "পাঠান", sending: "পাঠানো হচ্ছে...", preview: "যেমন দেখাবে",
    recent: "আগে পাঠানো নোটিফিকেশন", c_date: "তারিখ", c_title: "শিরোনাম", c_target: "লক্ষ্য", c_sent: "পৌঁছেছে", c_fail: "ব্যর্থ", c_click: "ক্লিক",
    g_banner:
      "এটা সাইটের নিচে ভেসে ওঠা একটা ছোট কার্ড — পাতার কোনো লেখা সরায় না, তাই SEO বা পেজের গতিতে কোনো প্রভাব নেই।\n\nকখন দেখায়:\n• শুধু Android ফোনে (iPhone-এ অ্যাপ ইনস্টল হয় না)\n• প্রথমবার ঢুকেই না — একটা ভিডিও সফলভাবে ডাউনলোড হওয়ার পরে, অথবা দ্বিতীয়বার এলে\n• যে ফোনে ইতিমধ্যে অ্যাপ আছে সেখানে কখনো না\n• কেউ বন্ধ করলে নির্দিষ্ট দিন আর দেখায় না\n\nকেন ডাউনলোডের পরে? ঠিক ওই মুহূর্তে ইউজার সবচেয়ে খুশি — ইনস্টলের হার সবচেয়ে বেশি থাকে।\n\nInstagram-এর ভেতর থেকে এলে: Instagram-এর ব্রাউজারে অ্যাপ ইনস্টল হয় না। তখন ব্যানার বলবে \"Chrome-এ খুলুন\" — এক ট্যাপে পাতাটা Chrome-এ খুলে যায়।",
    g_optin:
      "নোটিফিকেশনের অনুমতি চাওয়া হয় কখনো পাতা খোলার সাথে সাথে না — শুধু সফল ডাউনলোডের পর, রেজাল্টের নিচে একটা ছোট বক্সে। ইউজার নিজে বোতাম চাপলে তবেই Chrome-এর অনুমতি চাওয়া হয়।\n\nকেন এভাবে: পাতা খুলেই অনুমতি চাইলে বেশিরভাগ মানুষ \"Block\" চাপে, আর Google এটাকে খারাপ অভিজ্ঞতা ধরে। কাজ পাওয়ার পর চাইলে অনেক বেশি মানুষ রাজি হয়।\n\n\"না\" বললে ১৪ দিন আর জিজ্ঞেস করে না।",
    g_compose:
      "যারা নোটিফিকেশন নিয়েছে শুধু তারাই পাবে — অ্যাপ ইনস্টল করা থাকুক বা না থাকুক।\n\nভালো নোটিফিকেশনের নিয়ম:\n• সপ্তাহে ১-২টার বেশি না। বেশি পাঠালে মানুষ নোটিফিকেশন বন্ধ করে দেয়, আর আর কখনো ফেরানো যায় না\n• শিরোনাম ছোট, ৪০ অক্ষরের মধ্যে\n• কাজের কিছু বলুন — নতুন ফিচার, দ্রুততর ডাউনলোড, নতুন টুল\n• দেশ বেছে নিলে প্রাসঙ্গিক হয়, ক্লিক বাড়ে\n\nপাঠানো ধাপে ধাপে হয় (৪০ জন করে) — বড় তালিকায় কয়েক সেকেন্ড লাগতে পারে, পাতা বন্ধ করবেন না।\n\n\"ব্যর্থ\" বা মুছে যাওয়া ঠিকানাগুলো নিজে নিজেই তালিকা থেকে বাদ যায়।",
  },
  en: {
    stats: "App and users",
    subs: "Subscribed to notifications", inst7: "Installs (7 days)", inst30: "Installs (30 days)", opens: "App opens (7 days)", shares: "Arrived via Share (7 days)",
    bycountry: "Subscribers by country", none: "Nobody yet.",
    banner: "App install banner", bon: "Banner on",
    btitle: "Title", bsub: "Short description", bbtn: "Button text",
    esc: "What to show inside Instagram's browser", delay: "Show after N seconds", snooze: "Days to stay hidden after dismissing",
    optin: "Notification opt-in offer", pon: "Offer on", pafter: "Offer after N successful downloads",
    ptitle: "Offer title", psub: "Offer text", pbtn: "Button text",
    save: "Save",
    compose: "Send a notification",
    pvhint: "Preview — tap it to expand with the picture, exactly as it looks when pulled down on a phone",
    now: "now", phT: "New: share a reel to download it", phB: "Watching a reel on Instagram? Tap Share, pick IGtoDownload — done.",
    pic: "Picture (optional)", upload: "📷 Pick a picture from the phone", remove: "Remove", orlink: "or paste a picture link",
    pichint: "Wide (2:1) pictures look best, e.g. 1024×512. Pictures from the phone are resized automatically. Pictures show on Android only.",
    linkto: "Where a tap goes", home: "Home", custom: "Other link",
    audience: "Who receives it", all: "Everyone", reach: "people will receive it", sendTo: "Send to", confirmSend: "people will receive this notification. Send it?",
    nosubs: "Nobody in this country has opted in yet.", uploading: "Uploading picture...",
    devtitle: "Newest phones — send a test",
    devhint: "Turn notifications on from your own phone and it appears at the top here. \"Test\" sends one notification to that phone only and tells you, in plain words, what happened.",
    devtest: "Test", nodev: "No phones yet. In the site app tap the 🔔 button at the top, or tap \"Notify me\" after a download.",
    ntitle: "Title", nbody: "Message", nurl: "Where a tap goes", nimg: "Image link (optional)",
    ncountry: "Countries (optional) — e.g. BD, IN, PK. Empty means everyone",
    send: "Send", sending: "Sending...", preview: "Preview",
    recent: "Previously sent", c_date: "Date", c_title: "Title", c_target: "Target", c_sent: "Delivered", c_fail: "Failed", c_click: "Clicks",
    g_banner:
      "A small card that floats up from the bottom — it never pushes page content, so SEO and page speed are untouched.\n\nWhen it shows:\n• Android phones only (iPhone cannot install it)\n• Never on first arrival — only after a successful download, or on a return visit\n• Never on a phone that already has the app\n• Hidden for the set number of days once dismissed\n\nWhy after a download? That is the moment people are happiest with the site, so install rates are highest.\n\nFrom inside Instagram: Instagram's browser cannot install apps, so the banner offers \"Open in Chrome\" — one tap moves the page into Chrome.",
    g_optin:
      "Permission is never asked on page load — only after a successful download, in a small box under the result. Chrome's permission prompt appears only when the user taps the button.\n\nWhy: asking on load gets mostly \"Block\", and Google treats it as a poor experience. Asking after people got what they came for converts far better.\n\nIf they say no, they are not asked again for 14 days.",
    g_compose:
      "Only people who opted in receive it — whether or not they installed the app.\n\nRules for good notifications:\n• No more than one or two a week. Overdo it and people switch notifications off, and you never get them back\n• Keep the title short, under 40 characters\n• Say something useful — a new feature, faster downloads, a new tool\n• Targeting a country makes it relevant and lifts clicks\n\nSending happens in batches of 40 — a big list may take a few seconds, so keep the page open.\n\nFailed or expired addresses are removed from the list automatically.",
  },
};

async function usersTab(env, cfg, t, lang) {
  const T = U[lang];
  const a = await audience(env);
  const b = (cfg.app && cfg.app.banner) || {};
  const p = (cfg.app && cfg.app.push) || {};
  const ck = (v) => (v ? "checked" : "");
  const v = (x) => esc(x == null ? "" : String(x));
  const d = (ts) => new Date(ts).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" });

  return `
<div class="box composer">
  <h3>${T.compose}</h3>
  ${guide(t.guide, T.g_compose)}

  <div class="pvhint">${T.pvhint}</div>
  <div class="anotif" id="aN" onclick="this.classList.toggle('open')">
    <div class="an-head"><span class="an-ic"></span><span>${esc(cfg.brand.name)}</span><span class="an-dot">·</span><span>${T.now}</span><span class="an-chev">⌄</span></div>
    <div class="an-main">
      <div class="an-tx"><b id="pvT">${T.ntitle}</b><span id="pvB">${T.nbody}</span></div>
      <img class="an-thumb" id="pvThumb" alt="" hidden>
    </div>
    <img class="an-big" id="pvBig" alt="" hidden>
  </div>

  <label>${T.ntitle} <span class="dim cnt" id="cT">0/50</span></label>
  <input id="nTitle" maxlength="80" placeholder="${T.phT}">
  <label>${T.nbody} <span class="dim cnt" id="cB">0/180</span></label>
  <textarea id="nBody" rows="3" maxlength="220" placeholder="${T.phB}"></textarea>

  <label>${T.pic}</label>
  <div class="picrow">
    <label class="btn ghost upbtn">${T.upload}<input type="file" id="nFile" accept="image/*" hidden></label>
    <div class="picprev" id="picPrev" hidden><img id="picImg" alt=""><button type="button" class="mini danger" onclick="clearPic()">${T.remove}</button></div>
  </div>
  <input id="nImg" placeholder="${T.orlink}">
  <p class="dim">${T.pichint}</p>

  <label>${T.linkto}</label>
  <div class="chips" id="lChips">
    <button type="button" data-u="/" class="on">${T.home}</button><button type="button" data-u="/reels">Reels</button><button type="button" data-u="/video">Video</button><button type="button" data-u="/photo">Photo</button><button type="button" data-u="/story">Story</button><button type="button" data-u="/blog">Blog</button><button type="button" data-u="">${T.custom}</button>
  </div>
  <input id="nUrl" value="/" class="hide" placeholder="https://...">

  <label>${T.audience}</label>
  <div class="chips" id="cChips">
    <button type="button" data-c="" data-n="${a.subscribers}" class="on">${T.all} · ${a.subscribers}</button>
    ${a.countries.map((c) => `<button type="button" data-c="${esc(c.country)}" data-n="${c.n}">${esc(c.country)} · ${c.n}</button>`).join("")}
  </div>
  <input id="nCountry" type="hidden">
  <p class="reach" id="reach"></p>

  <button class="btn sendbtn" id="nSend" onclick="sendBroadcast()">${T.send}</button>
  <div class="progress hide" id="nProg"><span id="nBar"></span></div>
  <p class="dim" id="nStat"></p>
</div>

<div class="box">
  <h3>${T.devtitle}</h3>
  <p class="dim">${T.devhint}</p>
  ${a.devices.length
    ? `<div class="devs">${a.devices
        .map((x) => `<div class="devrow"><span class="devic">${x.device === "desktop" ? "🖥" : "📱"}</span>
          <div class="devtx"><b>${esc(x.country || "—")} · ${esc(x.device || "—")}</b><span class="dim">${ago(x.created)}</span></div>
          <button type="button" class="mini" onclick="testDevice(${+x.id}, this)">${T.devtest}</button></div>
          <p class="devout" id="dvo${+x.id}"></p>`)
        .join("")}</div>`
    : `<p class="dim">${T.nodev}</p>`}
</div>

<div class="box">
  <h3>${T.recent}</h3>
  ${a.recent.length
    ? `<div class="hist">${a.recent
        .map((r) => {
          const ctr = r.sent ? Math.round((r.clicks / r.sent) * 100) : 0;
          return `<div class="hcard">${r.image ? `<img src="${esc(r.image)}" alt="">` : `<span class="hnoimg"></span>`}
            <div class="hbody"><b>${esc(r.title)}</b><span class="dim">${d(r.created)}${r.countries ? " · " + esc(r.countries) : ""}${r.done ? "" : " · …"}</span>
            <div class="hstats"><span>${T.c_target} <b>${r.target}</b></span><span>${T.c_sent} <b>${r.sent}</b></span><span>${T.c_click} <b>${r.clicks}</b></span><span>CTR <b>${ctr}%</b></span></div></div></div>`;
        })
        .join("")}</div>`
    : `<p class="dim">${T.none}</p>`}
</div>

<div class="box">
  <h3>${T.stats}</h3>
  <div class="cards" style="margin:0">
    ${stat(T.subs, a.subscribers)}
    ${stat(T.inst7, a.installs7)}
    ${stat(T.inst30, a.installs30)}
    ${stat(T.opens, a.opens7)}
    ${stat(T.shares, a.shares7)}
  </div>
</div>

<div class="box">
  <form method="post" action="/admin?do=appcfg">
    <input type="hidden" name="tab" value="users">
    <h3>${T.banner}</h3>
    ${guide(t.guide, T.g_banner)}
    <label class="check"><input type="checkbox" name="bEnabled" value="1" ${ck(b.enabled)}> <b>${T.bon}</b></label>
    <label>${T.btitle}</label><input name="bTitle" maxlength="60" value="${v(b.title)}">
    <label>${T.bsub}</label><input name="bSub" maxlength="140" value="${v(b.sub)}">
    <label>${T.bbtn}</label><input name="bButton" maxlength="18" value="${v(b.button)}">
    <h3 style="margin-top:18px;font-size:14px">${T.esc}</h3>
    <label>${T.btitle}</label><input name="eTitle" maxlength="60" value="${v(b.escTitle)}">
    <label>${T.bsub}</label><input name="eSub" maxlength="140" value="${v(b.escSub)}">
    <label>${T.bbtn}</label><input name="eButton" maxlength="18" value="${v(b.escButton)}">
    <label>${T.delay}</label><input name="bDelay" type="number" min="1" max="60" value="${v(b.delaySec || 4)}">
    <label>${T.snooze}</label><input name="bSnooze" type="number" min="1" max="60" value="${v(b.snoozeDays || 5)}">

    <h3 style="margin-top:24px">${T.optin}</h3>
    ${guide(t.guide, T.g_optin)}
    <label class="check"><input type="checkbox" name="pEnabled" value="1" ${ck(p.enabled)}> <b>${T.pon}</b></label>
    <label>${T.pafter}</label><input name="pAfter" type="number" min="1" max="20" value="${v(p.after || 1)}">
    <label>${T.ptitle}</label><input name="pTitle" maxlength="50" value="${v(p.title)}">
    <label>${T.psub}</label><input name="pSub" maxlength="80" value="${v(p.sub)}">
    <label>${T.pbtn}</label><input name="pButton" maxlength="18" value="${v(p.button)}">
    <button class="btn">${T.save}</button>
  </form>
</div>
<script>window.__U=${JSON.stringify({ sending: T.sending, send: T.send, sendTo: T.sendTo, reach: T.reach, confirm: T.confirmSend, nosubs: T.nosubs, ntitle: T.ntitle, nbody: T.nbody, uploading: T.uploading }).replace(/</g, "\\u003c")};</script>`;
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
    <label>${t.set_probe} <span class="dim">${t.set_probehint}</span></label>
    <input name="probeUrl" value="${esc(cfg.settings.probeUrl || "")}" placeholder="https://www.instagram.com/reel/...">
    ${guide(t.guide, t.g_probe)}
    <h3 style="margin-top:22px">${t.set_fb}</h3>
    ${guide(t.guide, t.g_layers)}
    <h3 style="margin-top:18px">${t.set_proxy} <span class="dim">${t.set_optional}</span></h3>
    ${guide(t.guide, t.g_proxy)}
    <label>${t.set_ptpl}</label>
    <input name="proxyTemplate" value="${esc(cfg.settings.proxyTemplate || "")}" placeholder="https://api.example.com/fetch?key=ABC&url={url}">
    <label>${t.set_phdr}</label>
    <input name="proxyHeaders" value="${esc(cfg.settings.proxyHeaders || "")}" placeholder='{"X-API-Key":"abc123"}'>
    <h3 style="margin-top:18px">${t.set_api} <span class="dim">${t.set_optional}</span></h3>
    ${guide(t.guide, t.g_api)}
    <label>${t.set_atpl}</label>
    <input name="apiTemplate" value="${esc(cfg.settings.apiTemplate || "")}" placeholder="https://some-api.example.com/ig?url={url}">
    <label>${t.set_ahdr}</label>
    <input name="apiHeaders" value="${esc(cfg.settings.apiHeaders || "")}" placeholder='{"X-RapidAPI-Key":"..."}'>
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
</div>
${resetBox(t === L.bn ? "bn" : "en")}`;
}

/* ---------- diagnostics ---------- */

function diagTab(t, lang) {
  return `
<div class="box">
  <h3>${t.d_test}</h3>
  <p class="dim">${t.d_intro}</p>
  <input id="diagurl" placeholder="https://www.instagram.com/reel/...">
  <button class="btn" onclick="runDiag()">${t.d_run}</button>
  <div id="diagout"></div>
</div>
<div class="box">
  <h3>${lang === "bn" ? "কীভাবে পড়বেন" : "How to read this"}</h3>
  <p class="dim">${
    lang === "bn"
      ? "সাইট পরপর কয়েকটা পদ্ধতি চেষ্টা করে এবং প্রথমটা সফল হলেই থেমে যায়। তাই নিচে কিছু লাল সারি থাকা স্বাভাবিক — একটা সবুজ থাকলেই ইউজাররা ভিডিও পাবে। প্রতিটা সারিতে কী হয়েছে, তার মানে কী, আর কী করতে হবে — তিনটাই সহজ ভাষায় লেখা থাকে।"
      : "The site tries several routes in order and stops at the first success, so some red rows are normal — one green row means visitors get the video. Each row explains what happened, what it means and what to do, in plain words."
  }</p>
</div>`;
}

/* ---------- which route works / common errors (moved from the old dashboard) ---------- */

async function opsBox(env, t) {
  const st = await getStats(env);
  return `
<div class="two">
  <div class="box">
    <h3>${t.whichmethod}</h3>
    ${st.methods.length
      ? `<table><tr><th>${t.method}</th><th>${t.tries}</th><th>${t.ok}</th></tr>${st.methods.map((m) => `<tr><td>${esc(m.method || "—")}</td><td>${m.n}</td><td>${m.ok}</td></tr>`).join("")}</table>`
      : `<p class="dim">${t.nodata}</p>`}
    ${guide(t.guide, t.g_method)}
  </div>
  <div class="box">
    <h3>${t.comerr}</h3>
    ${st.errors.length
      ? `<table><tr><th>${t.error}</th><th>${t.count}</th></tr>${st.errors.map((e) => `<tr><td>${esc(e.err)}</td><td>${e.n}</td></tr>`).join("")}</table>`
      : `<p class="dim">${t.nodata}</p>`}
  </div>
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


/* ---------- danger zone ---------- */

function resetBox(lang) {
  const bn = lang === "bn";
  return `
<div class="box danger">
  <h3>${bn ? "ডেটা মুছে ফেলা ও রিসেট" : "Erase data and reset"}</h3>
  <p class="dim">${bn
    ? "সব পরিসংখ্যান এমনিতেই ৯০ দিন পর নিজে নিজে মুছে যায়। এখানে চাইলে এখনই মুছে ফেলতে পারেন। এটা ফেরানো যায় না।"
    : "All statistics are deleted automatically after 90 days anyway. Here you can erase them right now. This cannot be undone."}</p>
  <label class="check"><input type="radio" name="rscope" value="stats" checked> <span><b>${bn ? "শুধু পরিসংখ্যান" : "Statistics only"}</b><br><span class="dim">${bn
    ? "ভিজিট, ডাউনলোডের হিসাব, ইভেন্ট, নোটিফিকেশনের ইতিহাস। কুকি, অ্যাড, সেটিংস যেমন আছে থাকবে।"
    : "Visits, download counts, events, notification history. Cookies, ads and settings stay as they are."}</span></span></label>
  <label class="check"><input type="radio" name="rscope" value="all"> <span><b>${bn ? "পুরো প্যানেল" : "The whole panel"}</b><br><span class="dim">${bn
    ? "উপরের সব, সাথে নোটিফিকেশন নেওয়া ইউজার, সব কুকি, অ্যাড কোড, SEO আর সব সেটিংস। শুধু আপনার পাসওয়ার্ড থাকবে, যাতে আবার ঢুকতে পারেন।"
    : "Everything above, plus notification subscribers, all cookies, ad codes, SEO and every setting. Only your password is kept, so you can still sign in."}</span></span></label>
  <label>${bn ? "নিশ্চিত করতে লিখুন: <code>Confirmed</code>" : "To confirm, type: <code>Confirmed</code>"}</label>
  <input id="rConfirm" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Confirmed">
  <button class="btn dangerbtn" id="rBtn" disabled onclick="doReset()">${bn ? "মুছে ফেলুন" : "Erase"}</button>
  <p class="dim" id="rOut"></p>
</div>`;
}

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
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
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

function page(inner, bare, lang) {
  return new Response(
    `<!DOCTYPE html><html lang="${lang === "en" ? "en" : "bn"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#0b0b11">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Admin">
<link rel="manifest" href="/admin/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" href="/icon-192.png">
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
async function mkSession(env, hours) {
  const t = btoa(String(Date.now() + (hours || SESSION_HOURS) * 3600_000)).replace(/=+$/, "");
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
.top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:nowrap}
.logo{font-weight:800;font-size:17px;display:flex;align-items:center;gap:9px}
.logo em{font-style:normal;color:#8c8c9b;font-weight:600;font-size:13px}
.mk{width:24px;height:24px;border-radius:7px;background:linear-gradient(100deg,#ff8a3d,#f9377d 48%,#8a3ffc)}
.lang{display:flex;gap:4px;margin-left:auto;background:#15151d;border:1px solid #23232c;border-radius:9px;padding:3px}
.lang a{padding:5px 11px;border-radius:7px;color:#8c8c9b;text-decoration:none;font-size:12.5px;font-weight:600}
.lang a.on{background:#262630;color:#fff}
.mid-lang{margin:16px auto 0;width:fit-content}
.out{color:#8c8c9b;text-decoration:none;border:1px solid #26262f;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none}
@media(max-width:380px){.logo em{display:none}}
.logo{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tabs{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;
  margin:0 -14px 14px;padding:8px 14px;position:sticky;top:0;z-index:30;
  background:rgba(11,11,17,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  scroll-snap-type:x proximity;scroll-padding:0 14px;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
  scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 22px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 22px),transparent 100%)}
.tabs::-webkit-scrollbar{display:none}
.tabs a{flex:none;scroll-snap-align:start;white-space:nowrap;display:flex;align-items:center;min-height:38px;padding:8px 15px;border-radius:11px;
  background:#15151d;border:1px solid #23232c;color:#9a9aa8;text-decoration:none;font-size:13.5px;font-weight:600;
  -webkit-tap-highlight-color:transparent;transition:transform .15s ease}
.tabs a:active{transform:scale(.96)}
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
.devs{display:grid;gap:6px}
.devrow{display:flex;align-items:center;gap:10px;background:#0f0f16;border:1px solid #1e1e27;border-radius:12px;padding:9px 11px}
.devic{width:30px;height:30px;border-radius:9px;background:#1b1b24;display:grid;place-items:center;font-size:15px;flex:none}
.devtx{flex:1;min-width:0}.devtx b{display:block;font-size:13.5px}.devtx .dim{font-size:12px;margin:0}
.devout{font-size:12.5px;margin:2px 4px 6px;line-height:1.5}
.devout.good{color:#2bd97c}.devout.bad{color:#ff7fa5}
#nBody{font-family:inherit;font-size:14px;line-height:1.55}
.pvhint{font-size:12px;color:#8c8c9b;margin:4px 0 8px}
.anotif{background:#1d1d27;border-radius:22px;padding:13px 15px;cursor:pointer;-webkit-tap-highlight-color:transparent;
  box-shadow:0 10px 30px rgba(0,0,0,.35);transition:background .2s;user-select:none}
.an-head{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#a6a6b5}
.an-ic{width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#ff8a3d,#f9377d 50%,#8a3ffc);flex:none;position:relative}
.an-ic::after{content:"";position:absolute;left:5px;top:3px;width:6px;height:6px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}
.an-dot{opacity:.6}.an-chev{margin-left:auto;font-size:14px;transition:transform .25s}
.anotif.open .an-chev{transform:rotate(180deg)}
.an-main{display:flex;gap:12px;align-items:flex-start;margin-top:7px}
.an-tx{flex:1;min-width:0}
.an-tx b{display:block;font-size:14.5px;font-weight:600;color:#f0f0f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.an-tx span{display:block;font-size:13.5px;color:#c4c4d0;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.anotif.open .an-tx span{white-space:normal}
.an-thumb{width:44px;height:44px;border-radius:9px;object-fit:cover;flex:none}
.anotif.open .an-thumb{display:none}
.an-big{display:none;width:100%;aspect-ratio:2/1;object-fit:cover;border-radius:14px;margin-top:11px}
.anotif.open .an-big:not([hidden]){display:block}
.cnt{float:right;font-weight:500}
.cnt.over{color:#ffaa3c}
.picrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.upbtn{margin-top:0;position:relative}
.picprev{display:flex;align-items:center;gap:8px}
.picprev img{width:72px;height:36px;object-fit:cover;border-radius:7px;border:1px solid #26262f}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips button{background:#15151d;border:1px solid #26262f;color:#b9b9c6;border-radius:20px;padding:7px 12px;font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer}
.chips button.on{background:rgba(249,55,125,.16);border-color:rgba(249,55,125,.55);color:#fff}
.reach{margin-top:10px;font-size:14px;font-weight:600}
.sendbtn{width:100%;padding:14px;font-size:15px}
.hist{display:grid;gap:8px}
.hcard{display:flex;gap:11px;background:#0f0f16;border:1px solid #1e1e27;border-radius:13px;padding:10px;align-items:flex-start}
.hcard img,.hnoimg{width:64px;height:32px;border-radius:7px;object-fit:cover;flex:none;background:linear-gradient(135deg,#ff8a3d33,#8a3ffc33)}
.hbody{min-width:0;flex:1}
.hbody b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hbody .dim{font-size:12px;margin-top:1px}
.hstats{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:12px;color:#8c8c9b}
.hstats b{display:inline;color:#ececf1;font-size:12px}
.livebox{background:linear-gradient(160deg,#16131f,#13131a 60%)}
.livebig{display:flex;align-items:center;gap:12px;margin-top:10px}
.livebig b{font-size:46px;font-weight:800;letter-spacing:-1.5px;line-height:1}
.livedot{width:12px;height:12px;border-radius:50%;background:#2bd97c;box-shadow:0 0 0 0 rgba(43,217,124,.5);animation:ldot 1.8s ease-out infinite;flex:none}
@keyframes ldot{0%{box-shadow:0 0 0 0 rgba(43,217,124,.45)}100%{box-shadow:0 0 0 14px rgba(43,217,124,0)}}
.mh{font-size:12px;color:#8c8c9b;font-weight:600;margin-bottom:7px;text-transform:uppercase;letter-spacing:.6px}
.seg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#15151d;border:1px solid #23232c;border-radius:12px;padding:4px;margin-bottom:12px}
.seg button{background:none;border:0;color:#9a9aa8;font-weight:600;font-size:13px;padding:9px 4px;border-radius:9px;font-family:inherit;cursor:pointer}
.seg button.on{background:#262630;color:#fff}
.bars{display:grid;gap:7px}
.bar2{position:relative;background:#0f0f16;border:1px solid #1e1e27;border-radius:9px;padding:8px 10px;font-size:13px;display:flex;justify-content:space-between;gap:8px;overflow:hidden}
.bar2 i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(249,55,125,.22),rgba(138,63,252,.18));border-radius:9px}
.bar2 span,.bar2 b{position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar2 b{flex:none}
.chart2{display:flex;align-items:flex-end;gap:2px;height:120px;margin-top:8px}
.chart2 .c{flex:1;display:flex;align-items:flex-end;gap:1px;height:100%;min-width:0}
.chart2 .c span{flex:1;border-radius:3px 3px 0 0;min-height:2px}
.chart2 .v{background:linear-gradient(180deg,#f9377d,#8a3ffc)}
.chart2 .d{background:#2bd97c}
.chart2.hours .c span{background:linear-gradient(180deg,#ff8a3d,#f9377d)}
.legend{display:flex;gap:14px;margin-top:8px;font-size:12px;color:#8c8c9b}
.legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.legend .lv{background:#f9377d}.legend .ld{background:#2bd97c}
.danger{border-color:rgba(255,92,138,.35)}
.danger label.check{align-items:flex-start;margin-top:12px}
.danger label.check input{margin-top:4px}
.dangerbtn{background:#ff3d6e}
.dangerbtn:disabled{opacity:.4;cursor:not-allowed}
.npreview{display:flex;gap:11px;align-items:center;background:#0f0f16;border:1px solid #23232c;border-radius:13px;padding:12px;margin-top:14px}
.npreview img{width:38px;height:38px;border-radius:9px;flex:none}
.npreview b{display:block;font-size:14px}
.npreview span{display:block;color:#9a9aa8;font-size:12.5px;margin-top:2px;line-height:1.45}
.progress{height:8px;border-radius:8px;background:#1b1b24;overflow:hidden;margin-top:12px}
.progress span{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff8a3d,#f9377d 48%,#8a3ffc);transition:width .3s ease}
.stathead{display:flex;align-items:center;gap:10px}
.stathead h3{margin:0}
.age{margin-left:auto;color:#8c8c9b;font-size:12px}
.bigstat{display:flex;gap:14px;align-items:center;margin-top:14px}
.bigstat b{display:block;font-size:17px;line-height:1.35}
.bigstat p{color:#9a9aa8;font-size:13.5px;margin-top:4px;line-height:1.55}
.ring{width:46px;height:46px;border-radius:50%;flex:none;position:relative;display:grid;place-items:center}
.ring::after{content:"";width:16px;height:16px;border-radius:50%}
.ring.pending{background:rgba(140,140,155,.15)}.ring.pending::after{background:#8c8c9b}
.ring.ok{background:rgba(43,217,124,.14)}.ring.ok::after{background:#2bd97c}
.ring.warn{background:rgba(255,170,60,.14)}.ring.warn::after{background:#ffaa3c}
.ring.down{background:rgba(255,92,138,.14)}.ring.down::after{background:#ff5c8a;animation:beat 1.1s ease-in-out infinite}
@keyframes beat{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.6}}
.ring.down{animation:halo 1.6s ease-out infinite}
@keyframes halo{0%{box-shadow:0 0 0 0 rgba(255,92,138,.35)}100%{box-shadow:0 0 0 16px rgba(255,92,138,0)}}
.minis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}
.mini-c .ldot2,.ldot2{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2bd97c;margin-right:6px;vertical-align:2px;animation:ldot 1.8s ease-out infinite}
.mini-c{background:#0f0f16;border:1px solid #23232c;border-radius:12px;padding:10px;text-align:center}
.mini-c span{display:block;color:#8c8c9b;font-size:11px}
.mini-c b{font-size:17px}
.layers{display:grid;gap:8px}
.layer{display:flex;align-items:center;gap:9px;background:#0f0f16;border:1px solid #23232c;border-radius:11px;padding:11px 13px;font-size:13.5px}
.layer .num{width:20px;height:20px;border-radius:6px;background:#1f1f29;display:grid;place-items:center;font-size:11px;font-weight:700;color:#9a9aa8;flex:none}
.layer .pill{margin-left:auto;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:7px}
.pill.on{background:rgba(43,217,124,.14);color:#2bd97c}
.pill.off{background:rgba(140,140,155,.12);color:#8c8c9b}
.verdict{border-radius:13px;padding:14px 15px;margin-top:13px;font-size:14px;line-height:1.6}
.verdict b{display:block;font-size:15px;margin-bottom:5px}
.verdict.ok{background:rgba(43,217,124,.09);border:1px solid rgba(43,217,124,.33)}
.verdict.mid{background:rgba(255,170,60,.08);border:1px solid rgba(255,170,60,.3)}
.verdict.bad{background:rgba(255,92,138,.08);border:1px solid rgba(255,92,138,.33)}
.drow{background:#0f0f16;border:1px solid #23232c;border-radius:12px;padding:12px 13px;margin-top:8px}
.drow .dh{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700}
.drow .tick{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;flex:none;color:#0b0b11;font-weight:800}
.tick.y{background:#2bd97c}.tick.n{background:#ff5c8a}
.drow .who2{margin-left:auto;color:#8c8c9b;font-size:11.5px;font-weight:500}
.drow p{color:#9a9aa8;font-size:13px;margin-top:6px;line-height:1.6}
.drow .fix{color:#ffb86b;font-size:13px;margin-top:5px;line-height:1.6}
.login{width:100%;max-width:330px}
.login .logo{justify-content:center;margin-bottom:18px}
.login .btn{width:100%}
a{color:#ff8ab0}
`;

const AJS = `
var AL={vibrate:true,vibrateSeconds:2,vibrateRepeat:3,vibrateGapMs:400,pollSeconds:30,notifyWarn:true};
var lastLevel=null, timer=null, deferredPrompt=null;

function show(id,txt){var e=document.getElementById(id);if(!e)return;e.classList.remove('hide');e.textContent=txt}
function el(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

/* ---------- vibration ---------- */
function pattern(){
  if(!AL.vibrate) return null;
  var on=Math.max(200,Math.round((AL.vibrateSeconds||2)*1000));
  var gap=Math.max(100,AL.vibrateGapMs||400);
  var n=Math.min(10,Math.max(1,AL.vibrateRepeat||3));
  var p=[];for(var i=0;i<n;i++){p.push(on);if(i<n-1)p.push(gap)}
  return p;
}
var APP = window.IGtoApp || null;
var BN = !/(?:^|; )iglang=en/.test(document.cookie);
function buzz(){
  var p=pattern();
  if(!p) return false;
  if(APP){try{APP.vibrate(p.join(','));return true}catch(e){}}
  if(navigator.vibrate){try{navigator.vibrate(p);return true}catch(e){}}
  return false;
}
function testVib(){
  var f=el('vibrateSeconds'), r=el('vibrateRepeat'), g=el('vibrateGapMs');
  var form=document.querySelector('form[action*="do=alerts"]');
  if(form){
    AL.vibrateSeconds=parseFloat(form.vibrateSeconds.value)||2;
    AL.vibrateRepeat=parseInt(form.vibrateRepeat.value)||3;
    AL.vibrateGapMs=parseInt(form.vibrateGapMs.value)||400;
    AL.vibrate=form.vibrate.checked;
  }
  if(APP){
    var p=pattern(); var r=APP.testAlert(p?p.join(','):'');
    if(r && r!=='ok'){
      var bn2=BN;
      alert(r==='channel_off'
        ? (bn2?'এই অ্যাপের "Urgent alerts" নোটিফিকেশন ফোনের সেটিংসে বন্ধ করা আছে। ঠিক আছে চাপলে সেটিংস খুলবে — ওটা চালু করে দিন।':'The app\\'s "Urgent alerts" notifications are switched off in phone settings. Press OK to open settings and turn them on.')
        : (bn2?'এই অ্যাপের নোটিফিকেশন বন্ধ আছে, তাই কিছু আসছে না। ঠিক আছে চাপলে চালু করার জায়গায় নিয়ে যাবে।':'Notifications are off for this app, so nothing can arrive. Press OK to turn them on.'));
      if(APP.fixNotifications) APP.fixNotifications();
    }
    return;
  }
  if(!buzz()) alert('This phone or browser does not support vibration (iPhone does not).');
}

/* ---------- live polling ---------- */
function poll(manual){
  if(!el('bigstat')) return;
  fetch('/admin?api=status',{cache:'no-store'}).then(function(r){return r.json()}).then(function(st){
    if(st.alerts) AL=Object.assign(AL,st.alerts);
    paint(st);
    var bad = st.level==='down' || (st.level==='warn' && AL.notifyWarn);
    if(bad && lastLevel!==null && lastLevel!==st.level) buzz();
    lastLevel=st.level;
    schedule();
  }).catch(function(){ if(el('age'))el('age').textContent='connection problem'; schedule(); });
}
function schedule(){
  if(timer)clearTimeout(timer);
  timer=setTimeout(poll,Math.max(10,AL.pollSeconds||30)*1000);
}
function paint(st){
  var ring=el('ring'); ring.className='ring '+st.level;
  el('stTitle').textContent=st.line?st.line.title:'';
  el('stBody').textContent=st.line?st.line.body:'';
  el('age').textContent=new Date(st.at).toLocaleTimeString();
  var c=st.cookies;
  el('minis').innerHTML=
    mini(BN?'এখন সাইটে':'On site now','<i class="ldot2"></i>'+(st.liveNow||0))+
    mini(BN?'কুকি':'Cookies',(c.live+c.warn)+' / '+c.total)+
    mini(BN?'আজ ডাউনলোড':'Downloads today',st.stats.today)+
    mini(BN?'সফলতা':'Success',st.stats.rate+'%');
  var L=el('layers');
  if(L) L.innerHTML=
    layer(1,'Cookie pool',(c.live+c.warn)+' usable',(c.live+c.warn)>0)+
    layer(2,'Anonymous','always tried',true)+
    layer(3,'External API',st.fallbacks.externalApi?'configured':'not set',st.fallbacks.externalApi)+
    layer('P','Proxy',st.fallbacks.proxy?'configured':'direct',st.fallbacks.proxy);
  var dc=el('devCount'); if(dc)dc.textContent=st.push.devices;
}
function mini(l,v){return '<div class="mini-c"><span>'+l+'</span><b>'+v+'</b></div>'}
function layer(n,name,note,on){
  return '<div class="layer"><span class="num">'+n+'</span><span>'+name+'</span>'+
         '<span class="pill '+(on?'on':'off')+'">'+note+'</span></div>';
}

/* ---------- quick check ---------- */
function quick(){
  var v=el('qurl').value.trim(); if(!v){alert('Paste a link first');return}
  el('qout').innerHTML='<div class="verdict mid"><b>...</b>checking</div>';
  fetch('/admin?api=quick&url='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(d){
    el('qout').innerHTML='<div class="verdict '+d.tone+'"><b>'+esc(d.head)+'</b>'+esc(d.body)+'</div>';
  }).catch(function(){el('qout').innerHTML='<div class="verdict bad"><b>Failed</b>Request did not complete.</div>'});
}
function quickFull(){
  var v=el('qurl').value.trim(); if(!v){alert('Paste a link first');return}
  el('qout').innerHTML='<div class="verdict mid"><b>...</b>running every route</div>';
  fetchDiag(v,'qout');
}
function runDiag(){
  var v=el('diagurl').value.trim(); if(!v){alert('Paste a link first');return}
  el('diagout').innerHTML='<div class="verdict mid"><b>...</b>running every route with every cookie</div>';
  fetchDiag(v,'diagout');
}
function fetchDiag(v,target){
  fetch('/admin?api=diag&url='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(d){
    if(d.error){el(target).innerHTML='<div class="verdict bad"><b>'+esc(d.error)+'</b></div>';return}
    var h='<div class="verdict '+d.verdict.tone+'"><b>'+esc(d.verdict.head)+'</b>'+esc(d.verdict.body)+'</div>';
    d.rows.forEach(function(r){
      h+='<div class="drow"><div class="dh"><span class="tick '+(r.ok?'y':'n')+'">'+(r.ok?'\\u2713':'\\u00d7')+'</span>'+
         esc(r.plain.head)+'<span class="who2">'+esc(r.label)+' \\u00b7 '+esc(r.cookie)+' \\u00b7 '+r.ms+'ms</span></div>'+
         '<p>'+esc(r.plain.why)+'</p>'+(r.plain.fix?'<p class="fix">\\u2192 '+esc(r.plain.fix)+'</p>':'')+'</div>';
    });
    el(target).innerHTML=h;
  }).catch(function(){el(target).innerHTML='<div class="verdict bad"><b>Failed</b>Request did not complete.</div>'});
}

/* ---------- health check ---------- */
function runHealth(){
  show('healthout','Checking every cookie...');
  fetch('/admin?api=health').then(function(r){return r.json()}).then(function(d){
    show('healthout','Checked: '+d.checked+'\\nWorking: '+d.live+'\\nRevived: '+(d.revived||0)+(d.note?'\\n\\n'+d.note:''));
    poll(true);
  }).catch(function(){show('healthout','Request failed.')});
}

/* ---------- push + install ---------- */
function b64ToU8(b){
  var pad='='.repeat((4-b.length%4)%4);
  var raw=atob((b+pad).replace(/-/g,'+').replace(/_/g,'/'));
  var out=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
async function enableNotif(){
  if(APP){ APP.batterySettings(); return; }
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){
      alert('This browser cannot receive push notifications. On iPhone, install the app to the home screen first.');return;
    }
    var reg=await navigator.serviceWorker.register('/sw.js',{scope:'/admin'});
    await navigator.serviceWorker.ready;
    var perm=await Notification.requestPermission();
    if(perm!=='granted'){alert('Notifications were not allowed. Enable them in your browser site settings.');return}
    var kr=await fetch('/admin?api=vapid');var k=await kr.json();
    var sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(k.key)});
    var res=await fetch('/admin?api=subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sub.toJSON?sub.toJSON():sub)});
    var out=await res.json();
    show('pushout','Notifications are on. Connected devices: '+(out.devices||1));
    var dc=el('devCount'); if(dc)dc.textContent=out.devices||1;
  }catch(e){ show('pushout','Could not turn on notifications: '+(e&&e.message||e)); }
}
function testPush(){
  show('pushout','Sending...');
  fetch('/admin?api=testpush').then(function(r){return r.json()}).then(function(d){
    show('pushout','Devices: '+d.devices+'\\nSent: '+d.sent+'\\nFailed: '+d.failed+'\\nExpired: '+d.gone+
      (d.devices?'\\n\\nIf nothing arrived, check the browser notification permission.':'\\n\\nNo device registered yet — press "Turn on notifications" first.'));
  }).catch(function(){show('pushout','Request failed.')});
}
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault(); deferredPrompt=e;
  var b=el('btnInstall'); if(b)b.style.display='';
});
async function doInstall(){
  if(!deferredPrompt){alert('Use your browser menu: Add to Home screen.');return}
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null;
  var b=el('btnInstall'); if(b)b.style.display='none';
}

/* ---------- user notifications ---------- */
var UU=window.__U||{};
function pv(){
  var t=el('nTitle'), b=el('nBody'); if(!t) return;
  el('pvT').textContent=t.value||UU.ntitle||'—';
  el('pvB').textContent=b.value||UU.nbody||'—';
  var ct=el('cT'), cb=el('cB');
  ct.textContent=t.value.length+'/50'; ct.classList.toggle('over',t.value.length>50);
  cb.textContent=b.value.length+'/180'; cb.classList.toggle('over',b.value.length>180);
  var img=el('nImg').value.trim();
  var th=el('pvThumb'), big=el('pvBig');
  if(img){ th.src=img; big.src=img; th.hidden=false; big.hidden=false; el('aN').classList.add('open'); }
  else { th.hidden=true; big.hidden=true; }
}
['nTitle','nBody','nImg'].forEach(function(id){ var x=el(id); if(x) x.addEventListener('input',pv); });

function clearPic(){ el('nImg').value=''; el('picPrev').hidden=true; pv(); }

/* pictures from the phone: shrink to at most 1024px wide, JPEG, then upload */
(function(){
  var f=el('nFile'); if(!f) return;
  f.addEventListener('change',function(){
    var file=f.files&&f.files[0]; if(!file) return;
    var st=el('nStat'); st.textContent=UU.uploading||'...';
    var img=new Image(), url=URL.createObjectURL(file);
    img.onload=function(){
      var w=img.naturalWidth, h=img.naturalHeight, max=1024;
      if(w>max){ h=Math.round(h*max/w); w=max; }
      if(h>max){ w=Math.round(w*max/h); h=max; }
      var c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      var q=0.85, data=c.toDataURL('image/jpeg',q);
      while(data.length>560000 && q>0.4){ q-=0.1; data=c.toDataURL('image/jpeg',q); }
      fetch('/admin?api=nimg',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:data})})
        .then(function(r){return r.json()}).then(function(d){
          if(d.error){ st.textContent=d.error; return; }
          el('nImg').value=d.url; el('picImg').src=d.url; el('picPrev').hidden=false;
          st.textContent='✓ '+Math.round(d.size/1024)+' KB'; pv();
        }).catch(function(){ st.textContent='Upload failed.'; });
    };
    img.onerror=function(){ st.textContent='Could not read that picture.'; };
    img.src=url; f.value='';
  });
})();

/* where a tap goes */
(function(){
  var box=el('lChips'); if(!box) return;
  box.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    [].forEach.call(box.children,function(x){x.classList.toggle('on',x===b)});
    var u=b.getAttribute('data-u'), inp=el('nUrl');
    if(u){ inp.value=u; inp.classList.add('hide'); } else { inp.value=''; inp.classList.remove('hide'); inp.focus(); }
  });
})();

/* who receives it: "Everyone" or any mix of countries */
function reach(){
  var box=el('cChips'); if(!box) return 0;
  var on=[].filter.call(box.children,function(x){return x.classList.contains('on')});
  var all=on.length===1&&on[0].getAttribute('data-c')==='';
  var n=on.reduce(function(s,x){return s+(+x.getAttribute('data-n')||0)},0);
  el('nCountry').value=all?'':on.map(function(x){return x.getAttribute('data-c')}).join(',');
  el('reach').textContent=n+' '+(UU.reach||'');
  el('nSend').textContent=/[\u0980-\u09FF]/.test(UU.sendTo||'')?(n+' '+UU.sendTo):((UU.sendTo||'Send to')+' '+n);
  return n;
}
(function(){
  var box=el('cChips'); if(!box) return;
  box.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    var everyone=box.children[0];
    if(b===everyone){ [].forEach.call(box.children,function(x){x.classList.toggle('on',x===everyone)}); }
    else {
      b.classList.toggle('on'); everyone.classList.remove('on');
      if(![].some.call(box.children,function(x){return x.classList.contains('on')})) everyone.classList.add('on');
    }
    reach();
  });
  reach(); pv();
})();

async function testDevice(id, btn){
  var out=el('dvo'+id); btn.disabled=true; out.textContent='...';
  try{
    var r=await (await fetch('/admin?api=btest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id})})).json();
    out.className='devout '+(r.ok?'good':'bad');
    out.textContent=(r.ok?'\u2713 ':'\u2715 ')+r.text+(r.status?' ('+r.status+')':'');
  }catch(e){ out.textContent='Request failed.'; }
  btn.disabled=false;
}
function codeLine(codes){
  if(!codes) return '';
  return ' \u00b7 '+Object.keys(codes).map(function(k){return (k==='0'?'net':k)+'\u00d7'+codes[k]}).join(' ');
}

async function sendBroadcast(){
  var body={title:el('nTitle').value.trim(),body:el('nBody').value.trim(),url:el('nUrl').value.trim()||'/',image:el('nImg').value.trim(),countries:el('nCountry').value};
  if(!body.title||!body.body){ alert((UU.ntitle||'Title')+' + '+(UU.nbody||'Message')); el(!body.title?'nTitle':'nBody').focus(); return; }
  var n=reach();
  if(!n){ alert(UU.nosubs||'No subscribers yet.'); return; }
  if(!confirm(n+' '+(UU.confirm||'people will receive this. Send?'))) return;
  var btn=el('nSend'); btn.disabled=true; btn.textContent=UU.sending||'Sending...';
  el('nProg').classList.remove('hide'); el('nBar').style.width='2%';
  try{
    var r=await fetch('/admin?api=bcreate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    var c=await r.json(); if(c.error) throw new Error(c.error);
    if(!c.target){ el('nStat').textContent=UU.nosubs||'Nothing sent.'; el('nBar').style.width='100%'; return; }
    var s, guard=0;
    do{
      s=await (await fetch('/admin?api=bsend&id='+c.id)).json();
      if(s.error) throw new Error(s.error);
      var done=s.sent+s.failed+s.gone;
      el('nBar').style.width=Math.min(100,Math.round(done/Math.max(1,s.target)*100))+'%';
      el('nStat').textContent='✓ '+s.sent+' · ✕ '+(s.failed+s.gone)+' · '+done+'/'+s.target;
    }while(!s.done && ++guard<2000);
    el('nBar').style.width='100%';
    setTimeout(function(){ location.href='/admin?tab=users'; },1500);
  }catch(e){ el('nStat').textContent='Stopped: '+(e&&e.message||e); }
  finally{ btn.disabled=false; reach(); }
}

/* ---------- admin app extras ---------- */
function appPanel(){
  if(!APP) return;
  var box=el('notifState'); if(!box) return;
  var bn=!/(?:^|; )iglang=en/.test(document.cookie);
  var T=bn?{bg:'ব্যাকগ্রাউন্ড চেক',every:'প্রতি ১৫ মিনিটে',last:'শেষ চেক',never:'এখনো হয়নি',bat:'ব্যাটারি',free:'সীমাহীন ✓',limited:'সীমিত — চাপুন',lock:'আঙুলের ছাপ লক',on:'চালু',off:'বন্ধ',now:'এখনই চেক',ver:'অ্যাপ'}
             :{bg:'Background check',every:'every 15 minutes',last:'Last check',never:'not yet',bat:'Battery',free:'Unrestricted ✓',limited:'Restricted — tap',lock:'Fingerprint lock',on:'On',off:'Off',now:'Check now',ver:'App'};
  var last=APP.lastCheck(); var mins=last?Math.round((Date.now()-last)/60000):-1;
  var free=APP.batteryFree(); var lock=APP.lockEnabled();
  var ns=APP.notifState?APP.notifState():'on';
  var nOn=ns==='on';
  var nTxt=nOn?(bn?'চালু ✓':'On ✓'):(ns==='channel_off'?(bn?'জরুরি অ্যালার্ট বন্ধ — চাপুন':'Urgent alerts muted — tap'):(bn?'বন্ধ — চাপুন':'Off — tap'));
  box.innerHTML=
    '<div class="layers" style="margin-top:6px">'+
    '<div class="layer" id="notRow" style="cursor:pointer"><span class="num">\u{1F514}</span><span>'+(bn?'নোটিফিকেশন':'Notifications')+'</span><span class="pill '+(nOn?'on':'off')+'">'+nTxt+'</span></div>'+
    layer('\u23F1',T.bg,T.every,true)+
    layer('\u2713',T.last,mins<0?T.never:(mins+(bn?' মিনিট আগে':' min ago')),mins>=0&&mins<40)+
    '<div class="layer" id="batRow" style="cursor:pointer"><span class="num">\u26A1</span><span>'+T.bat+'</span><span class="pill '+(free?'on':'off')+'">'+(free?T.free:T.limited)+'</span></div>'+
    '<div class="layer" id="lockRow" style="cursor:pointer"><span class="num">\u{1F512}</span><span>'+T.lock+'</span><span class="pill '+(lock?'on':'off')+'">'+(lock?T.on:T.off)+'</span></div>'+
    '</div><p class="dim" style="margin-top:10px">'+T.ver+' '+APP.version()+'</p>';
  el('batRow').onclick=function(){APP.batterySettings()};
  el('notRow').onclick=function(){ if(APP.fixNotifications) APP.fixNotifications(); };
  el('lockRow').onclick=function(){APP.setLock(!APP.lockEnabled());appPanel()};
  var b=el('btnNotif'); if(b){ b.textContent=free?T.now:(bn?'ব্যাকগ্রাউন্ডে চলতে দিন':'Allow background running'); b.onclick=free?function(){APP.checkNow();setTimeout(appPanel,4000)}:function(){APP.batterySettings()}; }
  var tp=document.querySelector('button[onclick="testPush()"]'); if(tp) tp.style.display='none';
}

/* ---------- visitors ---------- */
var vDays=7, vTimer=null;
function vbars(id,rows,map,total){
  var box=el(id); if(!box) return;
  var VV=window.__V||{T:{}};
  if(!rows||!rows.length){ box.innerHTML='<p class="dim">'+(VV.T.none||'—')+'</p>'; return; }
  var max=total||Math.max.apply(null,rows.map(function(r){return r.n}));
  box.innerHTML=rows.map(function(r){
    var name=map&&map[r.k]!=null?map[r.k]:(r.k===''?'—':r.k);
    var pct=Math.max(3,Math.round(r.n/Math.max(1,max)*100));
    return '<div class="bar2"><i style="width:'+pct+'%"></i><span>'+esc(name)+'</span><b>'+r.n+'</b></div>';
  }).join('');
}
function vChart(id,series){
  var box=el(id); if(!box) return;
  var max=Math.max(1,Math.max.apply(null,series.map(function(x){return Math.max(x.visits,x.downloads)})));
  box.innerHTML=series.map(function(x){
    return '<div class="c" title="'+x.day+': '+x.visits+' / '+x.downloads+'"><span class="v" style="height:'+Math.round(x.visits/max*100)+'%"></span><span class="d" style="height:'+Math.round(x.downloads/max*100)+'%"></span></div>';
  }).join('');
}
function vHours(id,hours){
  var box=el(id); if(!box) return;
  var max=Math.max(1,Math.max.apply(null,hours));
  box.innerHTML=hours.map(function(n,h){return '<div class="c" title="'+h+':00 — '+n+'"><span style="height:'+Math.round(n/max*100)+'%"></span></div>'}).join('');
}
function vLive(L){
  var VV=window.__V||{T:{}};
  if(el('vLive')) el('vLive').textContent=L.now;
  if(el('vApp')) el('vApp').textContent=L.app?('\u00b7 '+L.app+' '+VV.T.inapp):'';
  if(el('vAge')) el('vAge').textContent=new Date().toLocaleTimeString();
  vbars('vLC',L.countries);
  vbars('vLP',L.pages);
}
function loadVisitors(){
  if(!el('vCards')) return;
  fetch('/admin?api=visitors&days='+vDays,{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
    var VV=window.__V||{T:{},src:{},dev:{}}, T=VV.T;
    el('vCards').innerHTML=
      stat2(T.visits,d.visits)+stat2(T.pageviews,d.pageviews)+stat2(T.downloads,d.downloads)+stat2(T.conv,d.conversion+'%')+stat2(T.installs,d.installs);
    vChart('vDaily',d.series.slice(-Math.max(vDays,7)));
    vHours('vHours',d.hours);
    vbars('vSrc',d.sources,VV.src);
    vbars('vCtry',d.countries);
    vbars('vPages',d.pages);
    vbars('vDev',d.devices,VV.dev);
    vbars('vSplit',[{k:'app',n:d.app.app},{k:'web',n:d.app.web}].filter(function(x){return x.n}),{app:T.app,web:T.web});
    vLive(d.live);
  }).catch(function(){});
}
function stat2(l,v){return '<div class="card"><span>'+l+'</span><b>'+v+'</b></div>'}
function liveLoop(){
  if(!el('vLive')) return;
  if(vTimer) clearTimeout(vTimer);
  vTimer=setTimeout(function(){
    if(!document.hidden) fetch('/admin?api=live',{cache:'no-store'}).then(function(r){return r.json()}).then(vLive).catch(function(){});
    liveLoop();
  },15000);
}
(function(){
  var seg=el('vSeg'); if(!seg) return;
  seg.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    [].forEach.call(seg.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b)});
    vDays=+b.getAttribute('data-d'); loadVisitors();
  });
  loadVisitors(); liveLoop();
})();

/* ---------- reset ---------- */
(function(){
  var i=el('rConfirm'), b=el('rBtn'); if(!i||!b) return;
  i.addEventListener('input',function(){ b.disabled = i.value !== 'Confirmed'; });
})();
async function doReset(){
  var scope=(document.querySelector('input[name=rscope]:checked')||{}).value||'stats';
  var v=el('rConfirm').value;
  if(v!=='Confirmed') return;
  var msg = scope==='all' ? 'This erases the WHOLE panel. Continue?' : 'Erase all statistics now?';
  if(!confirm(msg)) return;
  el('rBtn').disabled=true; el('rOut').textContent='...';
  try{
    var r=await fetch('/admin?api=reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope:scope,confirm:v})});
    var d=await r.json();
    if(d.error){ el('rOut').textContent=d.error; el('rBtn').disabled=false; return; }
    el('rOut').textContent='\u2713 Done. Reloading...';
    setTimeout(function(){ location.href='/admin?tab=monitor'; },900);
  }catch(e){ el('rOut').textContent='Failed.'; el('rBtn').disabled=false; }
}

/* ---------- tab bar: keep the open tab in view ---------- */
(function(){
  var bar=document.querySelector('.tabs'), on=bar&&bar.querySelector('a.on'); if(!on) return;
  bar.scrollLeft=Math.max(0,on.offsetLeft-(bar.clientWidth-on.clientWidth)/2);
})();

/* ---------- boot ---------- */
if('serviceWorker' in navigator){ navigator.serviceWorker.register('/sw.js',{scope:'/admin'}).catch(function(){}); }
if(el('bigstat')) poll(true);
appPanel();
document.addEventListener('visibilitychange',function(){ if(!document.hidden) appPanel(); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden&&el('bigstat')) poll(true); });
`;
