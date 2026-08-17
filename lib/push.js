// lib/push.js — Web Push (VAPID) helper.
// مفاتيح VAPID تتخزن في KV (سرية) عشان الريبو عام.
const webpush = require("web-push");
const { cmd } = require("./kv");
const crypto = require("crypto");

const SUBJECT = "mailto:m.salemalex@gmail.com";

// يقرأ مفاتيح VAPID من KV، ولو مش موجودة يولّدها ويخزّنها (مرة واحدة)
async function getVapid() {
  let raw = null;
  try { raw = await cmd(["GET", "push:vapid"]); } catch (_) {}
  if (raw) { try { return JSON.parse(raw); } catch (_) {} }
  const keys = webpush.generateVAPIDKeys();
  try { await cmd(["SET", "push:vapid", JSON.stringify(keys)]); } catch (_) {}
  return keys;
}

async function getPublicKey() {
  const k = await getVapid();
  return k.publicKey;
}

// يخزّن اشتراك جهاز جديد (SADD يمنع التكرار)
async function addSub(sub) {
  await cmd(["SADD", "push:subs", JSON.stringify(sub)]);
}

async function listRaw() {
  return (await cmd(["SMEMBERS", "push:subs"])) || [];
}

async function countSubs() {
  try { return (await listRaw()).length; } catch (_) { return 0; }
}

// يبعت إشعار لكل الأجهزة المشتركة؛ يشيل الاشتراكات المنتهية (404/410)
async function sendPush(payload) {
  const vapid = await getVapid();
  webpush.setVapidDetails(SUBJECT, vapid.publicKey, vapid.privateKey);
  const raws = await listRaw();
  const body = JSON.stringify(payload);
  let ok = 0;
  await Promise.all(
    raws.map(async (raw) => {
      let sub;
      try { sub = JSON.parse(raw); } catch (_) { return; }
      try {
        await webpush.sendNotification(sub, body, { TTL: 3600, urgency: "high" });
        ok++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          try { await cmd(["SREM", "push:subs", raw]); } catch (_) {}
        }
      }
    })
  );
  return { total: raws.length, ok };
}

// ===== منبّه مستمر: طلبات لسه محتاجة متابعة =====
// نخزّن أرقام الطلبات النشطة، ونعيد إرسال التنبيه كل دقيقة لحد ما الأدمن يفتح اللوحة (ack)
async function addActive(id) {
  if (!id) return;
  try { await cmd(["SADD", "push:active", String(id)]); await cmd(["EXPIRE", "push:active", "86400"]); } catch (_) {}
}
async function clearActive() {
  try { await cmd(["DEL", "push:active"]); } catch (_) {}
}
async function activeCount() {
  try { return (await cmd(["SCARD", "push:active"])) || 0; } catch (_) { return 0; }
}

// ===== تذكير الطلبات المؤجلة: ننبّه قبل موعد التسليم بوقت كافٍ للتحضير =====
// الطلب المؤجل كان بيوصل إشعاره ساعة ما العميل يطلب بس — يعني ممكن يطلب
// النهاردة لبكرة الساعة ٨ والمطبخ ينساه. دلوقتي بنسجّل موعد تنبيه وبنرنّ فيه.
const SCHED_KEY = "push:sched";
const DEFAULT_LEAD_MIN = 120;

function schedToMs(sf) {                    // "YYYY-MM-DD HH:MM" بتوقيت الكويت (+3)
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(sf || ""));
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 3 * 3600 * 1000;
}
function schedLabel(sf) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(sf || ""));
  if (!m) return String(sf || "");
  let hh = +m[4]; const ap = hh >= 12 ? "\u0645" : "\u0635"; hh = hh % 12 || 12;
  return m[3] + "/" + m[2] + " \u0627\u0644\u0633\u0627\u0639\u0629 " + hh + ":" + m[5] + " " + ap;
}
async function leadMinutes() {
  try {
    const raw = await cmd(["GET", "menu_data"]);
    const st = raw ? (JSON.parse(raw).settings || {}) : {};
    const v = Number(st.schedLeadMin);
    if (isFinite(v) && v >= 5 && v <= 1440) return v;
  } catch (_) {}
  return DEFAULT_LEAD_MIN;
}
async function addSchedReminder(id, scheduledFor) {
  const at = schedToMs(scheduledFor);
  if (!id || !at) return;
  const remindAt = at - (await leadMinutes()) * 60000;
  try { await cmd(["ZADD", SCHED_KEY, String(remindAt), String(id)]); } catch (_) {}
}
async function remSchedReminder(id) {
  if (!id) return;
  try { await cmd(["ZREM", SCHED_KEY, String(id)]); } catch (_) {}
}
async function runSchedReminders(now) {
  let due = [];
  try { due = (await cmd(["ZRANGEBYSCORE", SCHED_KEY, "-inf", String(now), "LIMIT", "0", "20"])) || []; }
  catch (_) { return []; }
  const fired = [];
  for (const id of due) {
    await remSchedReminder(id);                 // ينطلق مرة واحدة
    let o = null;
    try { const raw = await cmd(["GET", "order:" + id]); if (raw) o = JSON.parse(raw); } catch (_) {}
    if (!o) continue;
    const st = String(o.status || "");
    if (st === "cancelled" || st === "done" || st === "delivered" || st === "failed") continue;
    // نسلّح المنبّه المتكرر الأول: لو الإشعار الفوري فشل (مفاتيح ناقصة أو خدمة
    // الإشعارات واقعة) يفضل الطلب "نشط" والتيك اللي بعده يرنّ عليه تاني.
    try { await addActive(id); } catch (_) {}
    try {
      await sendPush({
        title: "\u23f0 \u0637\u0644\u0628 \u0645\u0624\u062c\u0651\u0644 \u2014 \u0648\u0642\u062a \u0627\u0644\u062a\u062d\u0636\u064a\u0631",
        body: "\u0637\u0644\u0628 \u0631\u0642\u0645 " + (o.no || id) + " \u0644\u0644\u062a\u0633\u0644\u064a\u0645 " + schedLabel(o.scheduledFor) + " \u2014 \u0627\u0628\u062f\u0623 \u0627\u0644\u062a\u062d\u0636\u064a\u0631 \u0627\u0644\u0622\u0646",
        url: "/admin.html",
      });
    } catch (_) {}
    fired.push(String(id));
  }
  return fired;
}

// يُستدعى من الكرون: تذكيرات الطلبات المؤجلة + إعادة تنبيه الطلبات النشطة
async function tick() {
  const sched = await runSchedReminders(Date.now());
  const n = await activeCount();
  if (!n) return { active: 0, sent: { total: 0, ok: 0 }, sched: sched.length };
  const sent = await sendPush({
    title: "🔔 طلب جديد بانتظارك — عهد الضيافة",
    body: "عندك " + n + " طلب جديد محتاج متابعة — افتح لوحة التحكم لإيقاف التنبيه",
    url: "/admin.html",
  });
  return { active: n, sent, sched: sched.length };
}

// توكن سري لتشغيل المنبّه المتكرر عبر كرون خارجي (مش باسورد الأدمن)
async function getTickToken() {
  let t = null;
  try { t = await cmd(["GET", "push:ticktoken"]); } catch (_) {}
  if (t) return t;
  t = crypto.randomBytes(18).toString("hex");
  try { await cmd(["SET", "push:ticktoken", t]); } catch (_) {}
  return t;
}

module.exports = { getPublicKey, addSub, sendPush, countSubs, addActive, clearActive, activeCount, tick, getTickToken,
  addSchedReminder, remSchedReminder, runSchedReminders, schedToMs, schedLabel };
