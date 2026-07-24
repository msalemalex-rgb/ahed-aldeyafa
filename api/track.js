// /api/track — تتبّع أحداث الموقع (زيارات، مشاهدات، إضافة للسلة، بدء الدفع، مصدر الزيارة)
// عام (بدون مصادقة) — يستقبل POST {type, src}. يخزّن عدّادات في KV.
const { cmd } = require("../lib/kv");

function kwDateStr() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body || "{}")); } catch { return Promise.resolve({}); } }
  return new Promise((res) => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}

// خريطة نوع الحدث -> بادئة المفتاح
const MAP = { visit: "visit", view: "pv", add_to_cart: "atc", checkout: "co" };

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const b = await readBody(req);
    const t = String(b.type || "").toLowerCase();
    const k = MAP[t];
    const ds = kwDateStr();
    if (k) {
      await cmd(["INCR", `stats:${k}:total`]);
      await cmd(["INCR", `stats:${k}:${ds}`]);
      await cmd(["EXPIRE", `stats:${k}:${ds}`, "8640000"]); // 100 يوم
    }
    // مصدر الزيارة (مع حدث visit فقط)
    if (t === "visit" && b.src) {
      const src = String(b.src).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
      if (src) await cmd(["INCR", `stats:src:${src}`]);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false }); // فشل صامت — ما يأثرش على تجربة الزائر
  }
};
