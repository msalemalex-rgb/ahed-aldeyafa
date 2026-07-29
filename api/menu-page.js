// /menu  (rewrite → /api/menu-page)
// صفحة منيو مبنية على السيرفر: أسماء الأصناف وأوصافها وأسعارها موجودة في HTML
// نفسه، فزاحف جوجل يقراها. الموقع التفاعلي بيحمّل المنيو بجافاسكربت من /api/menu
// وده محجوب في robots.txt، فكان جوجل ما بيشوف ولا صنف ولا سعر.
const { cmd } = require("../lib/kv");

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// صور الأصناف مخدومة من /api/img وهو محجوب للزواحف — نستخدم المسار المسموح /i/<id>.jpg
const crawlableImg = (u) => {
  const s = String(u || "");
  const m = /^\/api\/img\?id=([^&]+)/.exec(s);
  return m ? "/i/" + encodeURIComponent(m[1]) + ".jpg" : s;
};

const money = (n, cur) => (Number(n) || 0).toFixed(3) + " " + cur;

function dayList(days) {
  const EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (Array.isArray(days) ? days : []).map((d) => EN[Number(d)]).filter(Boolean);
}

function buildJsonLd(data, site, lang) {
  const st = (data && data.settings) || {};
  const cur = "KWD";
  const sections = (data.menu || []).map((c) => ({
    "@type": "MenuSection",
    name: (lang === "en" && c.catEn) || c.cat || "",
    hasMenuItem: (c.items || [])
      .filter((it) => it && Number(it.price) > 0 && it.available !== false)
      .map((it) => ({
        "@type": "MenuItem",
        name: (lang === "en" && it.nameEn) || it.name || "",
        ...(it.desc ? { description: (lang === "en" && it.descEn) || it.desc } : {}),
        offers: { "@type": "Offer", price: (Number(it.price) || 0).toFixed(3), priceCurrency: cur },
      })),
  })).filter((s) => s.hasMenuItem.length);

  const hours = (Array.isArray(st.hours) ? st.hours : [])
    .filter((h) => h && Array.isArray(h.days) && h.days.length && h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: dayList(h.days), opens: h.open, closes: h.close,
    }));

  const j = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: lang === "en" ? "Ahd Al-Diyafa Restaurant" : "مطعم عهد الضيافة",
    servesCuisine: lang === "en" ? "Kuwaiti" : "كويتي",
    priceRange: "KWD 0.15 - 46",
    url: site + "/",
    address: {
      "@type": "PostalAddress", addressLocality: lang === "en" ? "Hawally" : "حولي",
      addressCountry: "KW",
      streetAddress: lang === "en" ? "Sharhabeel Bin Hasana St." : "شارع شرحبيل بن حسنة",
    },
    geo: { "@type": "GeoCoordinates", latitude: 29.328963, longitude: 48.0252862 },
    acceptsReservations: true,
    hasMenu: { "@type": "Menu", name: lang === "en" ? "Menu" : "قائمة الطعام", hasMenuSection: sections },
  };
  if (st.whatsapp) j.telephone = "+" + String(st.whatsapp).replace(/\D/g, "");
  if (hours.length) j.openingHoursSpecification = hours;
  return j;
}

function render(data, { site, lang }) {
  const st = (data && data.settings) || {};
  const cur = st.currency || "د.ك";
  const ar = lang !== "en";
  const t = ar
    ? { title: "منيو مطعم عهد الضيافة — الأسعار كاملة | حولي، الكويت",
        desc: "قائمة طعام مطعم عهد الضيافة في حولي بالكويت: المجبوس والبرياني والمطبق والروبيان والتشاريب وصواني الديوانيات، بالأسعار كاملة بالدينار الكويتي.",
        h1: "منيو مطعم عهد الضيافة", sub: "مأكولات كويتية أصيلة — حولي، شارع شرحبيل بن حسنة",
        order: "🍽️ اطلب الآن من الموقع", cta: "الأسعار بالدينار الكويتي • الطلب أونلاين عليه خصم",
        na: "غير متوفر حالياً", hours: "أوقات العمل", items: "صنف", other: "English menu",
        note: "دي نسخة نصية من المنيو للعرض والبحث. للطلب والتوصيل استخدم الموقع." }
    : { title: "Ahd Al-Diyafa Restaurant Menu with Prices | Hawally, Kuwait",
        desc: "Full menu and prices for Ahd Al-Diyafa in Hawally, Kuwait: Majboos, Biryani, Mutabbaq, shrimp dishes, traditional plates and diwaniya trays.",
        h1: "Ahd Al-Diyafa Menu", sub: "Authentic Kuwaiti food — Hawally, Sharhabeel Bin Hasana St.",
        order: "🍽️ Order on the website", cta: "Prices in Kuwaiti Dinar • Online orders get a discount",
        na: "Currently unavailable", hours: "Working hours", items: "items", other: "المنيو بالعربي",
        note: "This is a text version of the menu for browsing and search. Use the website to order." };

  const cats = (data.menu || []).filter((c) => c && (c.items || []).length);
  const totalItems = cats.reduce((a, c) => a + c.items.length, 0);

  const sections = cats.map((c) => {
    const name = esc((!ar && c.catEn) || c.cat);
    const rows = (c.items || []).map((it) => {
      const nm = esc((!ar && it.nameEn) || it.name);
      const alt = ar ? esc(it.nameEn || "") : esc(it.name || "");
      const d = esc((!ar && it.descEn) || it.desc || "");
      const img = crawlableImg(it.img);
      const off = it.available === false;
      const price = Number(it.price) > 0 ? money(it.price, cur) : "";
      return `<li class="it${off ? " off" : ""}">`
        + (img ? `<img src="${esc(img)}" alt="${nm}" width="72" height="54" loading="lazy" decoding="async">` : `<span class="ph">🍽️</span>`)
        + `<div class="in"><h3>${nm}</h3>`
        + (alt && alt !== nm ? `<div class="alt">${alt}</div>` : "")
        + (d ? `<p>${d}</p>` : "")
        + `</div>`
        + `<div class="pr">${off ? `<span class="na">${t.na}</span>` : esc(price)}</div></li>`;
    }).join("");
    return `<section class="cat"><h2>${name} <span class="n">${c.items.length} ${t.items}</span></h2><ul>${rows}</ul></section>`;
  }).join("");

  const hoursRows = (Array.isArray(st.hours) ? st.hours : []).map((h) => {
    const dl = Array.isArray(h.days) && h.days.length
      ? (h.days.length === 7 ? (ar ? "كل أيام الأسبوع" : "All week") : dayList(h.days).join(", "))
      : esc(h.label || "");
    const tm = h.open && h.close ? `${esc(h.open)} – ${esc(h.close)}` : esc(h.time || "");
    return dl || tm ? `<div class="hr"><span>${esc(dl)}</span><b>${tm}</b></div>` : "";
  }).join("");

  const ld = JSON.stringify(buildJsonLd(data, site, lang));
  const self = site + "/menu" + (ar ? "" : "?lang=en");

  return `<!DOCTYPE html>
<html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${esc(self)}">
<link rel="alternate" hreflang="ar" href="${site}/menu">
<link rel="alternate" hreflang="en" href="${site}/menu?lang=en">
<link rel="alternate" hreflang="x-default" href="${site}/menu">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${esc(self)}">
<script type="application/ld+json">${ld}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#fdf6ea;color:#2a1a13;line-height:1.7}
.wrap{max-width:820px;margin:0 auto;padding:0 16px 50px}
header{background:linear-gradient(135deg,#4d0d18,#6e1423 60%,#8b1a1a);color:#fff;padding:26px 16px 22px;text-align:center}
header h1{font-size:24px;color:#e6c061;line-height:1.35}
header p{font-size:14px;opacity:.92;margin-top:6px}
.acts{margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.acts a{display:inline-block;background:#c8962f;color:#4d0d18;font-weight:800;font-size:14px;padding:10px 18px;border-radius:50px;text-decoration:none}
.acts a.alt{background:transparent;color:#e6c061;border:1px solid #c8962f}
.note{font-size:13px;color:#5f4f42;background:#f7ecd8;border-radius:8px;padding:10px 12px;margin:16px 0}
.cat{margin:22px 0}
.cat h2{font-size:18.5px;color:#6e1423;border-bottom:2px solid #c8962f;padding-bottom:7px;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.cat h2 .n{font-size:12px;color:#8a7565;font-weight:600}
.cat ul{list-style:none;margin-top:8px}
.it{display:flex;gap:11px;align-items:center;padding:10px 0;border-bottom:1px dashed #e8d9bf}
.it img{width:72px;height:54px;object-fit:cover;border-radius:8px;flex:0 0 auto;background:#f3ece1}
.it .ph{width:72px;height:54px;border-radius:8px;background:#f3ece1;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.it .in{flex:1;min-width:0}
.it h3{font-size:15.5px;font-weight:700;color:#2a1a13;line-height:1.45}
.it .alt{font-size:12px;color:#5f4f42}
.it .in p{font-size:13px;color:#5f4f42}
.it .pr{font-weight:800;color:#6e1423;white-space:nowrap;font-size:15px}
.it.off{opacity:.62}
.it .na{font-size:12px;font-weight:700;color:#8a7565}
.hrs{background:#fff;border:1px solid #e8d9bf;border-radius:10px;padding:12px 14px;margin:24px 0}
.hrs h2{font-size:16px;color:#6e1423;margin-bottom:6px}
.hr{display:flex;justify-content:space-between;font-size:14.5px;padding:4px 0}
footer{text-align:center;font-size:13px;color:#5f4f42;margin-top:26px;padding-top:16px;border-top:1px solid #e8d9bf}
footer a{color:#6e1423;font-weight:700}
</style>
</head>
<body>
<header>
  <h1>${esc(t.h1)}</h1>
  <p>${esc(t.sub)}</p>
  <p style="font-size:13px;margin-top:4px">${esc(t.cta)}</p>
  <div class="acts">
    <a href="${site}/">${esc(t.order)}</a>
    <a class="alt" href="${ar ? site + "/menu?lang=en" : site + "/menu"}">${esc(t.other)}</a>
  </div>
</header>
<div class="wrap">
  <div class="note">${esc(t.note)}</div>
  ${sections}
  ${hoursRows ? `<div class="hrs"><h2>${esc(t.hours)}</h2>${hoursRows}</div>` : ""}
  <footer>
    ${totalItems} ${esc(t.items)} — <a href="${site}/">${esc(t.order)}</a>
  </footer>
</div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "ahed-aldeyafa.vercel.app";
  const site = "https://" + String(host).replace(/\/+$/, "");
  const lang = (req.query && String(req.query.lang || "")) === "en" ? "en" : "ar";
  try {
    const raw = await cmd(["GET", "menu_data"]);
    const data = raw ? JSON.parse(raw) : null;
    if (!data) { res.statusCode = 503; res.setHeader("Content-Type", "text/plain; charset=utf-8"); return res.end("menu unavailable"); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // كاش على شبكة Vercel: الزاحف والزبون بياخدوا نسخة جاهزة بدون تشغيل الدالة كل مرة
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    res.statusCode = 200;
    return res.end(render(data, { site, lang }));
  } catch (e) {
    res.statusCode = 500; res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("error");
  }
};
