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

// تنفيذ عدة أوامر في طلب واحد (Upstash pipeline) — يوفّر رحلات شبكة متتالية
async function pipe(cmds) {
  if (!cmds || !cmds.length) return [];
  if (cmds.length === 1) return [await cmd(cmds[0])];
  const r = await fetch(URL.replace(/\/+$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error((j && j.error) || "pipeline_failed");
  return j.map((x) => (x && x.error ? null : x ? x.result : null));
}

const newId = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// تاريخ الكويت (UTC+3) بصيغة YYYYMMDD
function kwDateStr() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// ===== الطلبات =====
// presetId: يسمح للمُنادي بمعرفة رقم الطلب قبل الكتابة (لتشغيل عمليات أخرى بالتوازي)
async function addOrder(o, presetId) {
  const id = presetId || newId("ORD");
  // رقم طلب ودّي متسلسل يومياً: Inv-YYYYMMDD-001
  const ds = kwDateStr();
  let seq = 1;
  try {
    // رحلة واحدة بدل رحلتين
    const r = await pipe([["INCR", "seq:" + ds], ["EXPIRE", "seq:" + ds, "259200"]]);
    if (r && r[0]) seq = r[0];
  } catch (_) {}
  const no = `Inv-${ds}-${String(seq).padStart(3, "0")}`;
  const order = { id, no, createdAt: new Date().toISOString(), status: "new", ...o };
  // رحلة واحدة بدل ثلاث
  await pipe([
    ["SET", "order:" + id, JSON.stringify(order)],
    ["LPUSH", "orders", id],
    ["LTRIM", "orders", "0", "999"],
  ]);
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
  await pipe([
    ["SET", "rsv:" + id, JSON.stringify(r)],
    ["LPUSH", "reservations", id],
    ["LTRIM", "reservations", "0", "999"],
  ]);
  return r;
}
async function listReservations(limit) {
  const ids = await cmd(["LRANGE", "reservations", "0", String((limit || 200) - 1)]);
  if (!ids || !ids.length) return [];
  const vals = await cmd(["MGET", ...ids.map((i) => "rsv:" + i)]);
  return (vals || []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

module.exports = { cmd, pipe, newId, addOrder, listOrders, setOrderStatus, addReservation, listReservations };
