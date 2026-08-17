// /api/push — إدارة إشعارات الدفع (Web Push) + منبّه متكرر
//  GET                → مفتاح VAPID العام (للاشتراك)
//  GET  ?action=tick&key=ADMIN → يعيد إرسال التنبيه لو في طلبات نشطة (للكرون)
//  POST {action:subscribe, subscription} → يسجّل جهاز
//  POST {action:ack}   (أدمن) → يوقف المنبّه المتكرر (الأدمن فتح اللوحة)
//  POST {action:test}  (أدمن) → إشعار تجريبي
const { getPublicKey, addSub, sendPush, countSubs, clearActive, tick, getTickToken, runSchedReminders } = require("../lib/push");
const { rateLimit, clientIp } = require("../lib/kv");

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
    // حد أقصى لمحاولات كلمة السر الخاطئة من نفس الاتصال
    const supplied = (req.query && req.query.key) || req.headers["x-admin-key"];
    if (supplied && !isAdmin(req)) {
      const r = await rateLimit("authfail:" + clientIp(req), 10, 900);
      if (!r.ok) { res.setHeader("Retry-After", "900"); return res.status(429).json({ error: "too_many_attempts" }); }
    }
    if (req.method === "GET") {
      // كنس تنبيهات الطلبات المؤجَّلة وحدها — تناديه مهمة دورية كل ٥ دقائق.
      // بلا مفتاح: لا يرسل شيئًا إلا تنبيهًا حان موعده فعلاً، فتكرار النداء لا
      // ينتج إزعاجًا، ومعه حدّ عام يمنع تنفيذه أكثر من مرة كل ٤٥ ثانية.
      if (req.query && req.query.action === "sched") {
        let g = { ok: true };
        try { g = await rateLimit("schedsweep", 1, 45); } catch (_) {}
        if (!g.ok) return res.status(200).json({ ok: true, skipped: "throttled" });
        const fired = await runSchedReminders(Date.now());
        return res.status(200).json({ ok: true, fired: fired.length });
      }
      if (req.query && req.query.action === "tick") {
        const key = (req.query && req.query.key) || req.headers["x-admin-key"];
        const tok = await getTickToken();
        if (!isAdmin(req) && key !== tok) return res.status(401).json({ error: "unauthorized" });
        const r = await tick();
        return res.status(200).json({ ok: true, tick: r });
      }
      if (req.query && req.query.action === "tickinfo") {
        if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
        const tok = await getTickToken();
        const host = req.headers["x-forwarded-host"] || req.headers.host || "ahed-aldeyafa.vercel.app";
        return res.status(200).json({ ok: true, token: tok, url: "https://" + host + "/api/push?action=tick&key=" + tok });
      }
      const publicKey = await getPublicKey();
      return res.status(200).json({ publicKey });
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      if (b.action === "subscribe" && b.subscription) {
        // التسجيل للإشعارات للأدمن فقط — الإشعارات فيها أسماء الزبائن وروابط اللوحة
        if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
        await addSub(b.subscription);
        return res.status(200).json({ ok: true, subs: await countSubs() });
      }
      if (b.action === "ack") {
        if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
        await clearActive();
        return res.status(200).json({ ok: true, acked: true });
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
