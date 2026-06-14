// =====================================================================
//  /api/callback   (responseUrl + failureUrl)
//  يستقبل نتيجة Hesabe (مشفّرة في data)، يفكّها، يتحقق، يؤكّد الطلب في
//  قاعدة البيانات (pending → new عند النجاح، أو failed عند الفشل)،
//  ثم يحوّل المستخدم لصفحة نجاح/فشل على الموقع.
// =====================================================================
const { decrypt } = require("../lib/hesabeCrypt");
const { setOrderStatus } = require("../lib/kv");

function getData(req) {
  if (req.query && req.query.data) return req.query.data;
  if (req.body) {
    if (typeof req.body === "string") {
      const p = new URLSearchParams(req.body);
      if (p.get("data")) return p.get("data");
    } else if (req.body.data) {
      return req.body.data;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  const SITE = process.env.SITE_URL || "";
  try {
    const ENC_KEY = process.env.HSB_ENCRYPTION_KEY;
    const IV_KEY  = process.env.HSB_IV_KEY;
    const data = getData(req);
    if (!data) return res.redirect(302, `${SITE}/?payment=failed`);

    const decrypted = decrypt(data, ENC_KEY, IV_KEY);
    const json = JSON.parse(decrypted);
    const r = (json.response && json.response.data) ? json.response.data : {};
    const code = (r.resultCode || "").toUpperCase();
    const ok = json.status === true && ["CAPTURED", "ACCEPT", "SUCCESS"].includes(code);

    const rawRef = r.orderReferenceNumber || r.variable1 || "";
    const ref     = encodeURIComponent(rawRef);
    const payId   = encodeURIComponent(r.paymentId || "");
    const amount  = encodeURIComponent(r.amount || "");

    // تأكيد/فشل الطلب في قاعدة البيانات
    if (rawRef) {
      try { await setOrderStatus(rawRef, ok ? "new" : "failed"); } catch (_) {}
    }

    if (ok) {
      return res.redirect(302, `${SITE}/?payment=success&ref=${ref}&pid=${payId}&amt=${amount}`);
    }
    return res.redirect(302, `${SITE}/?payment=failed&ref=${ref}`);
  } catch (e) {
    return res.redirect(302, `${SITE}/?payment=failed`);
  }
};
