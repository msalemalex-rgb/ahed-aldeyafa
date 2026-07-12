// /api/push — إدارة إشعارات الدفع (Web Push)
//  GET               → يرجّع مفتاح VAPID العام (للاشتراك)
//  POST {action:subscribe, subscription} → يسجّل جهاز
//  POST {action:test}  (أدمن) → يبعت إشعار تجريبي لكل الأجهزة
const { getPublicKey, addSub, sendPush, countSubs } = require("../lib/push");

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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    if (req.method === "GET") {
      const publicKey = await getPublicKey();
      return res.status(200).json({ publicKey });
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      if (b.action === "subscribe" && b.subscription) {
        await addSub(b.subscription);
        return res.status(200).json({ ok: true, subs: await countSubs() });
      }
      if (b.action === "test") {
        if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
        const sent = await sendPush({ title: "🔔 تجربة تنبيه — عهد الضيافة", body: "التنبيهات شغّالة تمام ✅", url: "/admin.html" });
        return res.status(200).json({ ok: true, sent });
      }
      return res.status(400).json({ error: "bad action" });
    }
    return res.status(405).json({ error: "method" });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
