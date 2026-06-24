// /api/orders — POST: إنشاء طلب | GET: قائمة الطلبات (أدمن) | PATCH: تحديث الحالة (أدمن)
// GET ?debug=1 (أدمن): يرجّع آخر تشخيصات الدفع (pay_debug) لمتابعة عمليات Hesabe
const { addOrder, listOrders, setOrderStatus, cmd } = require("../lib/kv");

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body || "{}")); } catch { return Promise.resolve({}); } }
  return new Promise((res) => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}
function isAdmin(req) {
  const key = (req.query && req.query.key) || req.headers["x-admin-key"];
  return process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD;
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
        // طلبات KNET تبدأ "بانتظار الدفع" ولا تدخل الطابور إلا بعد نجاح الدفع
        status: (b.channel === "knet") ? "pending" : "new",
      });
      return res.status(200).json({ ok: true, id: order.id, no: order.no });
    }
    if (req.method === "GET") {
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
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
