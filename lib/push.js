// lib/push.js — Web Push (VAPID) helper.
// مفاتيح VAPID تتخزن في KV (سرية) عشان الريبو عام.
const webpush = require("web-push");
const { cmd } = require("./kv");

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

module.exports = { getPublicKey, addSub, sendPush, countSubs };
