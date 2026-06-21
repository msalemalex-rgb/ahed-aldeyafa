// مساعد Upstash Redis عبر REST API (بدون مكتبات)
const URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function cmd(args) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

const newId = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ===== تحديد معدّل الطلبات (Rate limit) =====
// يزيد عدّاد لكل مفتاح (مثلاً IP) خلال نافذة زمنية، ويرجّع true لو تجاوز الحد
async function rateHit(id, limit, ttlSec) {
  try {
    const k = "rl:" + id;
    const n = await cmd(["INCR", k]);
    if (n === 1) await cmd(["EXPIRE", k, String(ttlSec)]);
    return n > limit;
  } catch (_) { return false; }
}

// ===== الطلبات =====
async function addOrder(o) {
  const id = newId("ORD");
  const order = { id, createdAt: new Date().toISOString(), status: "new", ...o };
  await cmd(["SET", "order:" + id, JSON.stringify(order)]);
  await cmd(["LPUSH", "orders", id]);
  await cmd(["LTRIM", "orders", "0", "999"]);
  return order;
}
async function listOrders(limit) {
  const ids = await cmd(["LRANGE", "orders", "0", String((limit || 200) - 1)]);
  if (!ids || !ids.length) return [];
  const vals = await cmd(["MGET", ...ids.map((i) => "order:" + i)]);
  return (vals || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}
async function setOrderStatus(id, status) {
  const s = await cmd(["GET", "order:" + id]);
  if (!s) return null;
  const o = JSON.parse(s); o.status = status;
  await cmd(["SET", "order:" + id, JSON.stringify(o)]);
  return o;
}

// ===== الحجوزات =====
async function addReservation(o) {
  const id = newId("RSV");
  const r = { id, createdAt: new Date().toISOString(), status: "new", ...o };
  await cmd(["SET", "rsv:" + id, JSON.stringify(r)]);
  await cmd(["LPUSH", "reservations", id]);
  await cmd(["LTRIM", "reservations", "0", "999"]);
  return r;
}
async function listReservations(limit) {
  const ids = await cmd(["LRANGE", "reservations", "0", String((limit || 200) - 1)]);
  if (!ids || !ids.length) return [];
  const vals = await cmd(["MGET", ...ids.map((i) => "rsv:" + i)]);
  return (vals || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

module.exports = { cmd, rateHit, addOrder, listOrders, setOrderStatus, addReservation, listReservations };
