// POST /api/checkout — ينشئ طلب دفع Hesabe ويرجّع رابط صفحة الدفع
// (وضع تجربة: أضف ?sandbox=1 لاستخدام مفاتيح Hesabe التجريبية العامة)
const { encrypt, decrypt } = require("../lib/hesabeCrypt");
const crypto = require("crypto");

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch { return {}; } }
    return req.body;
  }
  return await new Promise((resolve) => {
    let d = ""; req.on("data", c => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  // أداة تشخيص محميّة: تكشف طول المفاتيح وأول/آخر حرفين فقط (ليست القيمة الكاملة)
  if (req.query && req.query.fp === "1") {
    const key = (req.query.key) || req.headers["x-admin-key"];
    if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD)
      return res.status(401).json({ error: "unauthorized" });
    const k = process.env.HSB_ENCRYPTION_KEY || "";
    const iv = process.env.HSB_IV_KEY || "";
    const ac = process.env.HSB_ACCESS_CODE || "";
    const mc = process.env.HSB_MERCHANT_CODE || "";
    // اختبار ذاتي: نفكّ أول بلوك من رد حقيقي بمفاتيح البيئة — لو طلع JSON فالمفاتيح صح
    let selftest;
    try {
      const C1 = Buffer.from("c3b594ae55e0cb8dd7e304c76768b214", "hex");
      const dd = crypto.createDecipheriv("aes-256-cbc", Buffer.from(k, "utf8"), Buffer.from(iv, "utf8"));
      dd.setAutoPadding(false);
      selftest = dd.update(C1).toString("utf8");
    } catch (e) { selftest = "ERR:" + e.message; }
    return res.status(200).json({
      encLen: k.length, encFirst2: k.slice(0, 2), encLast2: k.slice(-2),
      ivLen: iv.length, ivFirst2: iv.slice(0, 2), ivLast2: iv.slice(-2),
      accessLen: ac.length, accessFirst4: ac.slice(0, 4),
      merchant: mc, base: (process.env.HSB_BASE_URL || ""), payType: (process.env.HSB_PAYMENT_TYPE || ""), site: (process.env.SITE_URL || ""),
      selftest: selftest, selftestOK: typeof selftest === "string" && selftest.indexOf('{"status') === 0
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SANDBOX = req.query && (req.query.sandbox === "1" || req.query.sandbox === "true");

  try {
    let MERCHANT, ACCESS, ENC_KEY, IV_KEY, BASE;
    if (SANDBOX) {
      MERCHANT = "842217";
      ACCESS   = "c333729b-d060-4b74-a49d-7686a8353481";
      ENC_KEY  = "PkW64zMe5NVdrlPVNnjo2Jy9nOb7v1Xg";
      IV_KEY   = "5NVdrlPVNnjo2Jy9";
      BASE     = "https://sandbox.hesabe.com";
    } else {
      MERCHANT = process.env.HSB_MERCHANT_CODE;
      ACCESS   = process.env.HSB_ACCESS_CODE;
      ENC_KEY  = process.env.HSB_ENCRYPTION_KEY;
      IV_KEY   = process.env.HSB_IV_KEY;
      BASE     = (process.env.HSB_BASE_URL || "https://api.hesabe.com").trim().replace(/\/+$/, "");
    }
    const SITE     = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
    const PAY_TYPE = (process.env.HSB_PAYMENT_TYPE || "1").trim();

    if (!MERCHANT || !ACCESS || !ENC_KEY || !IV_KEY || !SITE)
      return res.status(500).json({ error: "Missing env" });

    const body = await readBody(req);
    const amountNum = Number(body.amount);
    if (!amountNum || amountNum < 0.1 || amountNum > 100000)
      return res.status(400).json({ error: "Invalid amount", got: body.amount });
    const amount = amountNum.toFixed(3);
    const orderRef = (body.orderRef || ("AHD-" + Date.now())).toString().slice(0, 40);

    const payload = {
      merchantCode: MERCHANT, amount, currency: "KWD", paymentType: PAY_TYPE, version: "2.0",
      orderReferenceNumber: orderRef, responseUrl: `${SITE}/api/callback`, failureUrl: `${SITE}/api/callback`, variable1: orderRef,
    };

    const encrypted = encrypt(JSON.stringify(payload), ENC_KEY, IV_KEY);
    const r = await fetch(`${BASE}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", accessCode: ACCESS },
      body: new URLSearchParams({ data: encrypted }).toString(),
    });
    const raw = (await r.text()).trim();

    let encResp = raw;
    try { const j = JSON.parse(raw); encResp = j.response || j.data || raw; } catch (_) {}

    let decrypted;
    try { decrypted = decrypt(encResp, ENC_KEY, IV_KEY); }
    catch (err) {
      // محاولة بدون padding لقراءة النص الكامل وتشخيص المشكلة
      let nopad = "";
      try {
        const hex = String(encResp).trim().replace(/[^0-9a-fA-F]/g, "");
        const dd = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENC_KEY, "utf8"), Buffer.from(IV_KEY, "utf8"));
        dd.setAutoPadding(false);
        nopad = dd.update(Buffer.from(hex, "hex")).toString("utf8");
        // محاولة استخراج JSON صالح وإكمال التدفق
        const m = nopad.match(/\{.*\}/s);
        if (m) {
          try {
            const j2 = JSON.parse(m[0]);
            if (j2 && j2.response && j2.response.data) {
              return res.status(200).json({ paymentUrl: `${BASE}/payment?data=${encodeURIComponent(j2.response.data)}`, orderRef, recovered: true });
            }
            return res.status(400).json({ error: "hesabe_error", message: j2.message, details: j2 });
          } catch (_) {}
        }
      } catch (e2) { nopad = "nopaderr:" + e2.message; }
      return res.status(502).json({ error: "decrypt_failed", hesabeStatus: r.status, decErr: err.message, rawLen: raw.length, nopad: nopad.slice(0, 500) });
    }

    let json;
    try { json = JSON.parse(decrypted); }
    catch (err) { return res.status(502).json({ error: "decrypted_not_json", hesabeStatus: r.status, decryptedSample: decrypted.slice(0, 200) }); }

    if (!json.status || !json.response || !json.response.data)
      return res.status(400).json({ error: "hesabe_error", message: json.message, details: json });

    const token = json.response.data;
    return res.status(200).json({ paymentUrl: `${BASE}/payment?data=${encodeURIComponent(token)}`, orderRef });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
};
