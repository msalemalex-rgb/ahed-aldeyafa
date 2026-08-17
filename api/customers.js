// /api/customers — بيانات العملاء القابلة للتعديل (أدمن فقط)
//   GET  → كل البيانات المحفوظة  { customers: { "12345678": {...} } }
//   POST → حفظ بيانات عميل واحد  { key, name, area, address, note }
// هذه طبقة فوق البيانات المستخرجة من الطلبات: أي حقل محفوظ هنا يَغلب على ما يأتي
// من آخر طلب، والحقل الفارغ معناه «اترك ما في الطلبات كما هو».
const { cmd, rateLimit, clientIp } = require("../lib/kv");

const HKEY = "cust_edits";
const cut = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

function isAdmin(req) {
  const key = (req.query && req.query.key) || req.headers["x-admin-key"];
  return process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD;
}
function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body || "{}")); } catch { return Promise.resolve({}); } }
  return new Promise((res) => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}
// نفس مفتاح الدمج المستخدم في اللوحة: آخر ٨ أرقام من الهاتف
function normKey(p) { const d = String(p == null ? "" : p).replace(/\D/g, ""); return d.length > 8 ? d.slice(-8) : d; }

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (!isAdmin(req)) {
      // إبطاء تجريب المفاتيح الخاطئة من نفس الاتصال
      let r = { ok: true };
      try { r = await rateLimit("custkey:" + clientIp(req), 10, 600); } catch (_) {}
      if (!r.ok) { res.setHeader("Retry-After", "600"); return res.status(429).json({ error: "too_many_requests" }); }
      return res.status(401).json({ error: "unauthorized" });
    }

    if (req.method === "GET") {
      const flat = (await cmd(["HGETALL", HKEY])) || [];
      const customers = {};
      for (let i = 0; i < flat.length; i += 2) {
        try { customers[flat[i]] = JSON.parse(flat[i + 1]); } catch (_) {}
      }
      return res.status(200).json({ customers });
    }

    if (req.method === "POST") {
      const b = await readBody(req);
      const key = normKey(b.key || b.phone);
      if (!/^\d{6,8}$/.test(key)) return res.status(400).json({ error: "bad_key" });
      const rec = {
        name:    cut(b.name, 80),
        area:    cut(b.area, 60),
        address: cut(b.address, 300),
        note:    cut(b.note, 400),
        updatedAt: Date.now(),
      };
      // كل الحقول فارغة → احذف السجل ورجّع البيانات المستخرجة من الطلبات
      if (!rec.name && !rec.area && !rec.address && !rec.note) {
        try { await cmd(["HDEL", HKEY, key]); } catch (_) {}
        return res.status(200).json({ ok: true, cleared: true });
      }
      await cmd(["HSET", HKEY, key, JSON.stringify(rec)]);
      return res.status(200).json({ ok: true, customer: rec });
    }

    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
};
