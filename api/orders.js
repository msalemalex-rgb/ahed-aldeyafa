// /api/orders — POST: إنشاء طلب | GET: قائمة الطلبات (أدمن) | PATCH: تحديث الحالة (أدمن)
const { addOrder, listOrders, setOrderStatus } = require("../lib/kv");

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
      // طلب KNET يُنشأ كـ pending ولا يظهر في اللوحة إلا بعد تأكيد الدفع في callback
      const status = b.channel === "knet" ? "pending" : "new";
      const order = await addOrder({
        items: b.items, total: b.total, subtotal: b.subtotal != null ? b.subtotal : null,
        channel: b.channel || "web", status,
        name: b.name || "", phone: b.phone || "", note: b.note || "",
        deliveryType: b.deliveryType || "", area: b.area || "",
        deliveryFee: b.deliveryFee != null ? b.deliveryFee : 0,
        prepTime: b.prepTime != null ? b.prepTime : null,
        address: b.address || "",
      });
      return res.status(200).json({ ok: true, id: order.id });
    }
    if (req.method === "GET") {
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      const all = await listOrders(300);
      // إخفاء الطلبات المعلّقة (لم يتأكد دفعها) والفاشلة
      const visible = all.filter(o => o.status !== "pending" && o.status !== "failed");
      return res.status(200).json({ orders: visible });
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
