// /api/stats — إحصائيات لوحة التحكم (أدمن) مع فلتر بالمدة (?days=1|7|30|90)
// يرجّع رسماً بيانياً بتواريخ (يومي للمدد القصيرة، أسبوعي للمدد الطويلة)
const { cmd, listOrders } = require("../lib/kv");

function isAdmin(req) {
  const key = (req.query && req.query.key) || req.headers["x-admin-key"];
  return process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD;
}
function kwDateOff(off) {
  const d = new Date(Date.now() + 3 * 3600 * 1000 - (off || 0) * 86400000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
function kwDateFromISO(iso) {
  try {
    const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch { return ""; }
}
async function gnum(key) { try { const v = await cmd(["GET", key]); return Number(v) || 0; } catch { return 0; } }
async function mget(keys) { if (!keys.length) return []; try { const v = await cmd(["MGET", ...keys]); return (v || []).map(x => Number(x) || 0); } catch { return keys.map(() => 0); } }
const sumArr = (a) => a.reduce((s, x) => s + x, 0);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    let daysN = parseInt((req.query && req.query.days) || "7", 10);
    if (![1, 7, 30, 90].includes(daysN)) daysN = 7;
    const spanDays = daysN === 1 ? 7 : daysN; // نطاق الرسم (اليوم يعرض آخر 7 أيام للسياق)
    const today = kwDateOff(0);
    const spanDates = [];
    for (let i = spanDays - 1; i >= 0; i--) spanDates.push(kwDateOff(i)); // الأقدم -> الأحدث
    const winSet = new Set(spanDates.slice(spanDays - daysN)); // آخر daysN للإحصاء

    // ===== الطلبات =====
    const orders = await listOrders(1000);
    const PAID = ["new", "preparing", "done"];
    const counts = {};
    let revenue = 0, revToday = 0, ordersInWin = 0, paidCount = 0;
    const itemMap = {};
    for (const o of orders) {
      const st = o.status || "new";
      const oDate = kwDateFromISO(o.createdAt);
      const tot = Number(o.total) || 0;
      if (PAID.includes(st) && oDate === today) revToday += tot;
      if (!winSet.has(oDate)) continue;
      counts[st] = (counts[st] || 0) + 1;
      ordersInWin++;
      if (PAID.includes(st)) { revenue += tot; paidCount++; }
      if (st !== "failed" && st !== "pending" && st !== "cancelled") {
        const lines = Array.isArray(o.lines) ? o.lines : [];
        if (lines.length) { for (const l of lines) { const nm = (l && l.name ? String(l.name) : "").trim(); if (nm) itemMap[nm] = (itemMap[nm] || 0) + (Number(l.qty) || 1); } }
        else if (Array.isArray(o.items)) { for (const it of o.items) { const nm = String(it).replace(/\s*[×x]\s*\d+.*$/, "").replace(/\s*-\s*\d.*$/, "").trim().slice(0, 50); if (nm) itemMap[nm] = (itemMap[nm] || 0) + 1; } }
      }
    }
    const topItems = Object.keys(itemMap).map(n => ({ name: n, qty: itemMap[n] })).sort((a, b) => b.qty - a.qty).slice(0, 8);

    // ===== الزيارات (يومي خام) =====
    const visitRaw = await mget(spanDates.map(d => "stats:visit:" + d));
    const pvRaw = await mget(spanDates.map(d => "stats:pv:" + d));
    const atcRaw = await mget(spanDates.map(d => "stats:atc:" + d));
    const coRaw = await mget(spanDates.map(d => "stats:co:" + d));
    const [visitsTotal, pvTotal] = await Promise.all([gnum("stats:visit:total"), gnum("stats:pv:total")]);

    // إجماليات المدة = آخر daysN يوم
    const lastN = (a) => a.slice(Math.max(0, a.length - daysN));
    const winVisits = sumArr(lastN(visitRaw)), winPv = sumArr(lastN(pvRaw)), winAtc = sumArr(lastN(atcRaw)), winCo = sumArr(lastN(coRaw));

    // ===== تجميع الرسم (يومي أو أسبوعي) =====
    const bucketDays = spanDays > 30 ? 7 : 1;
    const chartLabels = [], chartVisits = [], chartPv = [];
    for (let s = 0; s < spanDates.length; s += bucketDays) {
      const e = Math.min(s + bucketDays, spanDates.length);
      let sv = 0, sp = 0;
      for (let k = s; k < e; k++) { sv += visitRaw[k]; sp += pvRaw[k]; }
      const ds = spanDates[s];
      chartLabels.push(ds.slice(6) + "/" + ds.slice(4, 6));
      chartVisits.push(sv); chartPv.push(sp);
    }

    // ===== مصادر الزيارة (إجمالي) =====
    let sources = [];
    try {
      const skeys = await cmd(["KEYS", "stats:src:*"]);
      if (skeys && skeys.length) { const svals = await mget(skeys); sources = skeys.map((k, i) => ({ name: k.replace("stats:src:", ""), count: svals[i] })).sort((a, b) => b.count - a.count); }
    } catch (_) {}

    return res.status(200).json({
      range: daysN, bucket: bucketDays,
      orders: {
        total: ordersInWin, paidCount,
        revenue: Math.round(revenue * 1000) / 1000,
        revToday: Math.round(revToday * 1000) / 1000,
        counts, topItems,
      },
      traffic: {
        visits: winVisits, pv: winPv, atc: winAtc, co: winCo,
        todayVisits: visitRaw[visitRaw.length - 1] || 0,
        visitsTotal, pvTotal,
        chartLabels, chartVisits, chartPv, sources,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
