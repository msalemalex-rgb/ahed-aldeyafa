// =====================================================================
//  /api/callback   (responseUrl + failureUrl)
//  Receives Hesabe result (encrypted in `data`), decrypts, verifies,
//  and redirects the user to a success/failure page on the site.
//  - Robust body reading (POST form / GET / raw stream).
//  - Deep search for result fields regardless of Hesabe response nesting.
//  - Diagnostics stored in KV (pay_debug) incl. a sample of the decrypted
//    payload to reveal its real structure.
//  - Links the payment result to the order in the dashboard
//    (paid -> new, failed -> failed).
//  - Sandbox mode (?sandbox=1) uses Hesabe public test keys.
// =====================================================================
const { decrypt } = require("../lib/hesabeCrypt");
let kv = null;
try { kv = require("../lib/kv"); } catch (_) {}
let push = null;
try { push = require("../lib/push"); } catch (_) {}

const SANDBOX_KEYS = { ENC: "PkW64zMe5NVdrlPVNnjo2Jy9nOb7v1Xg", IV: "5NVdrlPVNnjo2Jy9" };

async function readRawBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") return req.body;
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
    req.on("error", () => resolve(""));
  });
}

function extractData(req, body) {
  if (req.query && req.query.data) return req.query.data;
  if (body && typeof body === "object" && body.data) return body.data;
  if (typeof body === "string" && body.length) {
    try { const p = new URLSearchParams(body); if (p.get("data")) return p.get("data"); } catch (_) {}
    if (/^[0-9a-fA-F]{32,}$/.test(body.trim())) return body.trim();
  }
  return null;
}

// Deep search: first non-object value for any of the given keys, at any depth
function deepFind(obj, keyNames) {
  const targets = keyNames.map((k) => k.toLowerCase());
  const out = {};
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const lk = k.toLowerCase();
      const v = o[k];
      if (targets.includes(lk) && out[lk] === undefined && (v === null || typeof v !== "object")) out[lk] = v;
      if (v && typeof v === "object") walk(v);
    }
  })(obj);
  return out;
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
      dbg.decision = "failed:parse"; dbg.sample = String(decrypted).slice(0, 200);
      await logDebug(dbg);
      return res.redirect(302, `${SITE}/?payment=failed`);
    }

    // Deep search for result fields regardless of response structure
    const f = deepFind(json, ["resultcode", "result", "paymentid", "amount", "orderreferencenumber", "variable1", "paymenttoken", "code", "message"]);
    const code = String(f.resultcode || f.result || "").toUpperCase();
    const statusOk = json.status === true || json.status === "true" || json.status === 1;
    const SUCCESS_CODES = ["CAPTURED", "ACCEPT", "ACCEPTED", "SUCCESS", "PAID", "APPROVED"];
    // Strict success: require an explicit Hesabe resultCode (avoid marking a failed payment as paid)
    const ok = statusOk && SUCCESS_CODES.includes(code);

    const orderId = f.orderreferencenumber || f.variable1 || "";

    // Detailed diagnostics (sample of decrypted payload to learn real structure)
    dbg.status = json.status;
    dbg.resultCode = code;
    dbg.paymentId = f.paymentid || "";
    dbg.amount = f.amount || "";
    dbg.ref = orderId;
    dbg.jsonKeys = Object.keys(json);
    dbg.respType = json.response == null ? "none" : (typeof json.response === "object" ? "obj" : typeof json.response);
    dbg.foundFields = f;
    dbg.decrypted = String(decrypted).slice(0, 700);
    dbg.decision = ok ? "success" : "failed:result";
    await logDebug(dbg);

    // Link payment result to the order in the dashboard
    if (orderId && kv && kv.setOrderStatus) {
      try { await kv.setOrderStatus(orderId, ok ? "new" : "failed"); } catch (_) {}
    }

    // إشعار دفع (Push) لكل أجهزة لوحة التحكم — حتى لو التطبيق مقفول
    if (push && push.sendPush) {
      try {
        if (ok) await push.sendPush({ title: "\uD83D\uDD14 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u2014 \u0639\u0647\u062F \u0627\u0644\u0636\u064A\u0627\u0641\u0629", body: "\u0648\u0635\u0644\u0643 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0645\u062F\u0641\u0648\u0639 \u2014 \u062A\u0627\u0628\u0639\u0647 \u0645\u0646 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", url: "/admin.html" });
        else await push.sendPush({ title: "\uD83D\uDCB3 \u0645\u062D\u0627\u0648\u0644\u0629 \u062F\u0641\u0639 \u0641\u0627\u0634\u0644\u0629", body: "\u0639\u0645\u064A\u0644 \u062D\u0627\u0648\u0644 \u0627\u0644\u062F\u0641\u0639 \u0648\u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u2014 \u0642\u062F \u062A\u062D\u062A\u0627\u062C \u0645\u062A\u0627\u0628\u0639\u062A\u0647", url: "/admin.html" });
      } catch (_) {}
    }

    const ref    = encodeURIComponent(orderId);
    const payId  = encodeURIComponent(f.paymentid || "");
    const amount = encodeURIComponent(f.amount || "");

    if (ok) return res.redirect(302, `${SITE}/?payment=success&ref=${ref}&pid=${payId}&amt=${amount}`);
    return res.redirect(302, `${SITE}/?payment=failed&ref=${ref}`);
  } catch (e) {
    dbg.decision = "failed:exception"; dbg.err = e.message;
    await logDebug(dbg);
    return res.redirect(302, `${SITE}/?payment=failed`);
  }
};
