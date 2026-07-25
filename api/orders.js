// /api/orders — POST: إنشاء طلب | GET: قائمة الطلبات (أدمن) | PATCH: تحديث الحالة (أدمن)
// GET ?debug=1 (أدمن): يرجّع آخر تشخيصات الدفع (pay_debug) لمتابعة عمليات Hesabe
const { addOrder, listOrders, setOrderStatus, cmd } = require("../lib/kv");
let push = null;
try { push = require("../lib/push"); } catch (_) {}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body || "{}")); } catch { return Promise.resolve({}); } }
  return new Promise((res) => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}
function isAdmin(req) {
  const key = (req.query && req.query.key) || req.headers["x-admin-key"];
  return process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD;
}
// ===== أدوات تنظيف طلبات التجربة (كاش عند الاستلام) =====
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
// حذف طلبات الكاش التجريبية ليوم محدد + تنظيف عدادات الفانل
// GET /api/orders?key=..&cleanupCod=1[&apply=1][&date=YYYYMMDD]
async function cleanupCod(req, res) {
  const apply = req.query.apply === "1" || req.query.apply === "true";
  const day = /^\d{8}$/.test(req.query.date || "") ? req.query.date : kwToday();
  const orders = await listOrders(1000);
  const targets = orders.filter(o => o && o.channel === "cod" && kwDateFromISO(o.createdAt) === day);
  const rep = {
    mode: apply ? "APPLIED ✅ اتمسحوا نهائياً" : "DRY-RUN 👀 معاينة فقط — أضف &apply=1 للتنفيذ",
    day, found: targets.length,
    orders: targets.map(o => ({ no: o.no, name: o.name || "", total: o.total, status: o.status, at: o.createdAt })),
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
  rep.note = "حذف الطلب بيشيله تلقائياً من الإيرادات والفانل. أحداث فيسبوك التجريبية مش بتتمسح من عند فيسبوك — طلب أو اتنين ملهمش تأثير.";
  return res.status(200).json(rep);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    if (req.method === "POST") {
      const b = await readBody(req);
      if (!b.items || b.total == null) return res.status(400).json({ error: "missing items/total" });
      const order = await addOrder({
        items: b.items, total: b.total, channel: b.channel || "web",
        name: b.name || "", phone: b.phone || "", note: b.note || "",
        deliveryType: b.deliveryType || "", area: b.area || "",
        address: b.address || "", deliveryFee: Number(b.deliveryFee) || 0,
        deliveryTime: b.deliveryTime || "", mapUrl: b.mapUrl || "",
        lines: Array.isArray(b.lines) ? b.lines : [],
        itemsSubtotal: Number(b.itemsSubtotal) || 0,
        discountPct: Number(b.discountPct) || 0,
        // KNET: "pending" حتى نجاح الدفع | واتساب: "awaiting" (بانتظار تأكيد الأدمن) | غيرهم: "new"
        status: (b.channel === "knet") ? "pending" : (b.channel === "whatsapp") ? "awaiting" : "new",
      });
      // إشعار Push للأدمن حسب حالة الطلب
      try {
        if (push && push.sendPush) {
          try { if (order.status === "new" || order.status === "awaiting") await push.addActive(order.id); } catch (_) {}
          if (order.status === "awaiting")
            await push.sendPush({ title: "🟡 طلب بانتظار التأكيد", body: (order.name || "عميل") + " أرسل طلب — بانتظار تأكيدك", url: "/admin.html" });
          else if (order.status === "new")
            await push.sendPush({ title: "🔔 طلب جديد — عهد الضيافة", body: "وصلك طلب جديد، تابعه من لوحة التحكم", url: "/admin.html" });
        }
      } catch (_) {}
      return res.status(200).json({ ok: true, id: order.id, no: order.no });
    }
    if (req.method === "GET") {
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      if (req.query && req.query.cleanupCod === "1") return await cleanupCod(req, res);
      if (req.query && (req.query.debug === "1" || req.query.debug === "true")) {
        const rows = await cmd(["LRANGE", "pay_debug", "0", "49"]);
        const debug = (rows || []).map((s) => { try { return JSON.parse(s); } catch { return s; } });
        return res.status(200).json({ debug });
      }
      return res.status(200).json({ orders: await listOrders(200) });
    }
    if (req.method === "PATCH") {
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      const b = await readBody(req);
      const o = await setOrderStatus(b.id, b.status);
      return res.status(200).json({ ok: true, order: o });
    }
    return res.status(405).json({ error: "method" });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
