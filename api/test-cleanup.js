// /api/test-cleanup — حذف طلبات التجربة (كاش عند الاستلام) وتنظيف أثرها من الإحصائيات (أدمن فقط)
// GET ?key=ADMIN_PASSWORD                 → معاينة: إيه اللي هيتمسح (من غير أي تنفيذ)
// GET ?key=ADMIN_PASSWORD&apply=1         → تنفيذ فعلي
// GET ?key=...&date=YYYYMMDD              → يوم محدد بتوقيت الكويت (الافتراضي: النهارده)
// المنطق: أي طلب قناته "cod" في اليوم المحدد يعتبر طلب تجربة (خيار الكاش مخفي عن الزباين)
// - يتمسح الطلب نهائياً من قائمة الطلبات (فيختفي من الإيرادات والفانل تلقائياً)
// - وينقص عدادي "إضافة للسلة" و"بدء الدفع" لنفس اليوم بعدد الطلبات الممسوحة
const { cmd, listOrders } = require("../lib/kv");

function isAdmin(req) {
  const k = (req.query && req.query.key) || req.headers["x-admin-key"];
  return process.env.ADMIN_PASSWORD && k === process.env.ADMIN_PASSWORD;
}
function kwDateFromISO(iso) {
  try {
    const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch { return ""; }
}
function kwToday() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
async function decrFloor(key, n) {
  try {
    const cur = Number(await cmd(["GET", key])) || 0;
    const next = Math.max(0, cur - n);
    await cmd(["SET", key, String(next)]);
    return { key, before: cur, after: next };
  } catch (e) { return { key, error: e.message }; }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized — أضف ?key=كلمة سر الأدمن" });
  const apply = req.query && (req.query.apply === "1" || req.query.apply === "true");
  const day = (req.query && /^\d{8}$/.test(req.query.date || "")) ? req.query.date : kwToday();
  try {
    const orders = await listOrders(1000);
    const targets = orders.filter(o => o && o.channel === "cod" && kwDateFromISO(o.createdAt) === day);
    const rep = {
      mode: apply ? "APPLIED ✅ اتمسحوا نهائياً" : "DRY-RUN 👀 معاينة فقط — أضف &apply=1 للتنفيذ",
      day,
      found: targets.length,
      orders: targets.map(o => ({ no: o.no, id: o.id, name: o.name || "", total: o.total, status: o.status, at: o.createdAt })),
      countersAdjusted: [],
    };
    if (apply && targets.length) {
      for (const o of targets) {
        try { await cmd(["LREM", "orders", "0", o.id]); } catch (_) {}
        try { await cmd(["DEL", "order:" + o.id]); } catch (_) {}
      }
      rep.countersAdjusted.push(await decrFloor("stats:atc:" + day, targets.length));
      rep.countersAdjusted.push(await decrFloor("stats:co:" + day, targets.length));
      rep.countersAdjusted.push(await decrFloor("stats:atc:total", targets.length));
      rep.countersAdjusted.push(await decrFloor("stats:co:total", targets.length));
    }
    rep.note = "مسح الطلب بيشيله تلقائياً من الإيرادات وعدد الطلبات المدفوعة والفانل. أحداث فيسبوك التجريبية اللي اتبعتت مش بتتمسح من عند فيسبوك — طلب أو اتنين مش هيأثروا على حاجة.";
    return res.status(200).json(rep);
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
