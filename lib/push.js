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
// يُستدعى من الكرون كل دقيقة: يعيد التنبيه طالما في طلبات نشطة
async function tick() {
  const n = await activeCount();
  if (!n) return { active: 0, sent: { total: 0, ok: 0 } };
  const sent = await sendPush({
    title: "🔔 طلب جديد بانتظارك — عهد الضيافة",
    body: "عندك " + n + " طلب جديد محتاج متابعة — افتح لوحة التحكم لإيقاف التنبيه",
    url: "/admin.html",
  });
  return { active: n, sent };
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

module.exports = { getPublicKey, addSub, sendPush, countSubs, addActive, clearActive, activeCount, tick, getTickToken };
