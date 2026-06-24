// =====================================================================
//  /api/callback   (responseUrl + failureUrl)
//  يستقبل نتيجة Hesabe (مشفّرة في data)، يفكّها، يتحقق، ويحوّل المستخدم
//  لصفحة نجاح/فشل على الموقع.
//  - قراءة جسم الطلب بشكل متين (POST form / GET / raw stream) لتفادي
//    فقدان data وبالتالي اعتبار دفعة ناجحة "فاشلة".
//  - كشف نجاح متسامح مع اختلاف بنية رد Hesabe.
//  - تشخيص يُحفظ في KV (pay_debug) لمراجعة آخر العمليات.
//  - وضع تجربة (?sandbox=1) يستخدم مفاتيح Hesabe التجريبية العامة.
// =====================================================================
const { decrypt } = require("../lib/hesabeCrypt");
let kv = null;
try { kv = require("../lib/kv"); } catch (_) {}

// مفاتيح Hesabe التجريبية العامة (للـ sandbox فقط — منشورة في التوثيق الرسمي)
const SANDBOX_KEYS = { ENC: "PkW64zMe5NVdrlPVNnjo2Jy9nOb7v1Xg", IV: "5NVdrlPVNnjo2Jy9" };

// قراءة الجسم بأي صيغة: object جاهز، أو نقرأه من الـ stream لو Vercel ما فكّه
async function readRawBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") return req.body;
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
    req.on("error", () => resolve(""));
  });
}

// استخراج قيمة data من query أو body (object / urlencoded string / hex خام)
function extractData(req, body) {
  if (req.query && req.query.data) return req.query.data;
  if (body && typeof body === "object" && body.data) return body.data;
  if (typeof body === "string" && body.length) {
    try { const p = new URLSearchParams(body); if (p.get("data")) return p.get("data"); } catch (_) {}
    if (/^[0-9a-fA-F]{32,}$/.test(body.trim())) return body.trim();
  }
  return null;
}

async function logDebug(entry) {
  if (!kv || !kv.cmd) return;
  try {
    await kv.cmd(["LPUSH", "pay_debug", JSON.stringify(entry)]);
    await kv.cmd(["LTRIM", "pay_debug", "0", "49"]);
  } catch (_) {}
}

module.exports = async (req, res) => {
  const SITE = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  const SANDBOX = req.query && (req.query.sandbox === "1" || req.query.sandbox === "true");
  const dbg = { at: new Date().toISOString(), method: req.method, ct: req.headers["content-type"] || "", sandbox: !!SANDBOX };

  try {
    const ENC_KEY = SANDBOX ? SANDBOX_KEYS.ENC : process.env.HSB_ENCRYPTION_KEY;
    const IV_KEY  = SANDBOX ? SANDBOX_KEYS.IV  : process.env.HSB_IV_KEY;

    const body = await readRawBody(req);
    const data = extractData(req, body);
    dbg.hasData = !!data;
    dbg.dataLen = data ? String(data).length : 0;

    if (!data) {
      dbg.decision = "failed:no_data";
      await logDebug(dbg);
      return res.redirect(302, `${SITE}/?payment=failed`);
    }

    let decrypted;
    try { decrypted = decrypt(data, ENC_KEY, IV_KEY); }
    catch (err) {
      dbg.decision = "failed:decrypt"; dbg.err = err.message;
      await logDebug(dbg);
      return res.redirect(302, `${SITE}/?payment=failed`);
    }

    let json;
    try { json = JSON.parse(decrypted); }
    catch (err) {
      dbg.decision = "failed:parse"; dbg.sample = String(decrypted).slice(0, 120);
      await logDebug(dbg);
      return res.redirect(302, `${SITE}/?payment=failed`);
    }

    // بنية Hesabe المعتادة: { status, response: { data: {...} } } — مع تسامح للبدائل
    const r = (json.response && json.response.data) ? json.response.data
            : (json.data && typeof json.data === "object") ? json.data
            : json;
    const code = String(r.resultCode || r.result || "").toUpperCase();
    const statusOk = json.status === true || json.status === "true" || json.status === 1;
    const ok = statusOk && ["CAPTURED", "ACCEPT", "SUCCESS", "PAID"].includes(code);

    dbg.status = json.status;
    dbg.resultCode = code;
    dbg.paymentId = r.paymentId || "";
    dbg.amount = r.amount || "";
    dbg.ref = r.orderReferenceNumber || r.variable1 || "";
    dbg.decision = ok ? "success" : "failed:result";
    await logDebug(dbg);

    const ref    = encodeURIComponent(r.orderReferenceNumber || r.variable1 || "");
    const payId  = encodeURIComponent(r.paymentId || "");
    const amount = encodeURIComponent(r.amount || "");

    if (ok) return res.redirect(302, `${SITE}/?payment=success&ref=${ref}&pid=${payId}&amt=${amount}`);
    return res.redirect(302, `${SITE}/?payment=failed&ref=${ref}`);
  } catch (e) {
    dbg.decision = "failed:exception"; dbg.err = e.message;
    await logDebug(dbg);
    return res.redirect(302, `${SITE}/?payment=failed`);
  }
};
