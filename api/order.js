// /api/order?id=<orderId> — يرجّع تفاصيل طلب واحد للعميل (لعرض الفاتورة)
// الـ id رمز عشوائي غير قابل للتخمين، فالوصول به آمن.
const { cmd } = require("../lib/kv");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method" });

  const id = req.query && req.query.id;
  if (!id) return res.status(400).json({ error: "id_required" });

  let s;
  try { s = await cmd(["GET", "order:" + String(id)]); }
  catch (_) { return res.status(500).json({ error: "server_error" }); }
  if (!s) return res.status(404).json({ error: "not_found" });

  let o;
  try { o = JSON.parse(s); } catch (_) { return res.status(500).json({ error: "parse_error" }); }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    order: {
      no: o.no || o.id, createdAt: o.createdAt, channel: o.channel, status: o.status,
      name: o.name || "", phone: o.phone || "", deliveryType: o.deliveryType || "",
      area: o.area || "", address: o.address || "", deliveryTime: o.deliveryTime || "", mapUrl: o.mapUrl || "",
      deliveryFee: Number(o.deliveryFee) || 0, total: Number(o.total) || 0,
      lines: Array.isArray(o.lines) ? o.lines : [],
      itemsSubtotal: Number(o.itemsSubtotal) || 0, discountPct: Number(o.discountPct) || 0,
      items: o.items || "",
    },
  });
};
