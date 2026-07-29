// /api/orders — POST: إنشاء طلب | GET: قائمة الطلبات (أدمن) | PATCH: تحديث الحالة (أدمن)
// GET ?debug=1 (أدمن): يرجّع آخر تشخيصات الدفع (pay_debug) لمتابعة عمليات Hesabe
const { addOrder, listOrders, setOrderStatus, addReservation, listReservations, cmd } = require("../lib/kv");
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
      // تحديث موقع السائق (تطبيق السائق) — التفويض بمعرفة معرف الطلب غير القابل للتخمين
      if (b.locFor) {
        const id = String(b.locFor);
        const lat = Number(b.lat), lng = Number(b.lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: "bad coords" });
        const os = await cmd(["GET", "order:" + id]);
        if (!os) return res.status(404).json({ error: "not_found" });
        let oo; try { oo = JSON.parse(os); } catch { return res.status(500).json({ error: "parse" }); }
        if (oo.status !== "delivering") return res.status(409).json({ error: "order not delivering", status: oo.status });
        await cmd(["SET", "loc:" + id, JSON.stringify({ lat, lng, at: Date.now() })]);
        await cmd(["EXPIRE", "loc:" + id, "10800"]);
        return res.status(200).json({ ok: true });
      }
      // إنهاء التوصيلة من تطبيق السائق
      if (b.deliveredBy) {
        const id = String(b.deliveredBy);
        const os = await cmd(["GET", "order:" + id]);
        if (!os) return res.status(404).json({ error: "not_found" });
        let oo; try { oo = JSON.parse(os); } catch { return res.status(500).json({ error: "parse" }); }
        if (oo.status === "delivering") { await setOrderStatus(id, "done"); try { await cmd(["DEL", "loc:" + id]); } catch (_) {} }
        return res.status(200).json({ ok: true });
      }
      // حجز مناسبة/ديوانية (مدموج من /api/reservations)
      if (b.kind === "reservation") {
        if (!b.name || !b.date) return res.status(400).json({ error: "missing name/date" });
        const r = await addReservation({ name: b.name, phone: b.phone || "", type: b.type || "", count: b.count || "", date: b.date, time: b.time || "", notes: b.notes || "" });
        return res.status(200).json({ ok: true, id: r.id });
      }
      if (!b.items || b.total == null) return res.status(400).json({ error: "missing items/total" });
      const order = await addOrder({
        items: b.items, total: b.total, channel: b.channel || "web",
        name: b.name || "", phone: b.phone || "", note: b.note || "",
        deliveryType: b.deliveryType || "", area: b.area || "",
        address: b.address || "", deliveryFee: Number(b.deliveryFee) || 0,
        deliveryTime: b.deliveryTime || "", mapUrl: b.mapUrl || "",
        scheduledFor: b.scheduledFor || "",
        lines: Array.isArray(b.lines) ? b.lines : [],
        itemsSubtotal: Number(b.itemsSubtotal) || 0,
        discountPct: Number(b.discountPct) || 0,
        // KNET: "pending" حتى نجاح الدفع | واتساب: "awaiting" (بانتظار تأكيد الأدمن) | غيرهم: "new"
        status: (b.channel === "knet") ? "pending" : (b.channel === "whatsapp") ? "awaiting" : "new",
      });
      // إشعار Push للأدمن حسب حالة الطلب
      // إشعارات بدون انتظار — لا تؤخر رد السيرفر على الزبون
      try {
        if (push && push.sendPush) {
          (async () => {
            try { if (order.status === "new" || order.status === "awaiting") await push.addActive(order.id); } catch (_) {}
            try {
              if (order.status === "awaiting")
                await push.sendPush({ title: "🟡 طلب بانتظار التأكيد", body: (order.name || "عميل") + " أرسل طلب — بانتظار تأكيدك", url: "/admin.html" });
              else if (order.status === "new")
                await push.sendPush({ title: "🔔 طلب جديد — عهد الضيافة", body: "وصلك طلب جديد، تابعه من لوحة التحكم", url: "/admin.html" });
            } catch (_) {}
          })();
        }
      } catch (_) {}
      return res.status(200).json({ ok: true, id: order.id, no: order.no });
    }
    if (req.method === "GET") {
      // سجل طلبات برقم التليفون — الإثبات: معرف طلب غير قابل للتخمين يخص نفس الرقم
      if (req.query && req.query.myhist === "1") {
        const phone = String(req.query.phone || "").replace(/\D/g, "");
        const proof = String(req.query.proof || "");
        if (!phone || phone.length < 6 || !proof) return res.status(400).json({ error: "phone+proof required" });
        const ps = await cmd(["GET", "order:" + proof]);
        if (!ps) return res.status(403).json({ error: "proof invalid" });
        let po; try { po = JSON.parse(ps); } catch { return res.status(500).json({ error: "parse" }); }
        const pPhone = String(po.phone || "").replace(/\D/g, "");
        if (!pPhone || pPhone.slice(-8) !== phone.slice(-8)) return res.status(403).json({ error: "proof mismatch" });
        const all = await listOrders(1000);
        const mine = all.filter(o => o && String(o.phone || "").replace(/\D/g, "").slice(-8) === phone.slice(-8))
          .slice(0, 20)
          .map(o => ({ id: o.id, no: o.no, total: Number(o.total) || 0, at: o.createdAt, status: o.status, itemsTxt: o.items || "", lines: Array.isArray(o.lines) ? o.lines.map(l => ({ name: l.name, qty: l.qty })) : [] }));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ orders: mine });
      }
      // طلب واحد للفاتورة (عام — الـ id رمز عشوائي غير قابل للتخمين) — مدموج من /api/order
      if (req.query && req.query.id && req.query.cleanupCod !== "1" && !req.query.debug) {
        const id = String(req.query.id);
        let s;
        try { s = await cmd(["GET", "order:" + id]); } catch (_) { return res.status(500).json({ error: "server_error" }); }
        if (!s) return res.status(404).json({ error: "not_found" });
        let o; try { o = JSON.parse(s); } catch (_) { return res.status(500).json({ error: "parse_error" }); }
        let driverLoc = null;
        if (o.status === "delivering") {
          try { const ls = await cmd(["GET", "loc:" + id]); if (ls) driverLoc = JSON.parse(ls); } catch (_) {}
        }
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ driverLoc, order: {
          no: o.no || o.id, createdAt: o.createdAt, channel: o.channel, status: o.status,
          name: o.name || "", phone: o.phone || "", deliveryType: o.deliveryType || "",
          area: o.area || "", address: o.address || "", deliveryTime: o.deliveryTime || "", mapUrl: o.mapUrl || "",
          deliveryFee: Number(o.deliveryFee) || 0, total: Number(o.total) || 0,
          note: o.note || "", scheduledFor: o.scheduledFor || "",
          lines: Array.isArray(o.lines) ? o.lines : [],
          itemsSubtotal: Number(o.itemsSubtotal) || 0, discountPct: Number(o.discountPct) || 0,
          items: o.items || "",
        }});
      }
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      // قائمة الحجوزات (أدمن) — مدموج من /api/reservations
      if (req.query && req.query.rsv === "1") return res.status(200).json({ reservations: await listReservations(300) });
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
      if (b.kind === "reservation") {
        const s2 = await cmd(["GET", "rsv:" + b.id]);
        if (s2) { const o2 = JSON.parse(s2); o2.status = b.status; await cmd(["SET", "rsv:" + b.id, JSON.stringify(o2)]); return res.status(200).json({ ok: true, reservation: o2 }); }
        return res.status(404).json({ error: "not found" });
      }
      const o = await setOrderStatus(b.id, b.status);
      return res.status(200).json({ ok: true, order: o });
    }
    return res.status(405).json({ error: "method" });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
