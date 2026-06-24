// POST /api/checkout — ينشئ طلب دفع Hesabe ويرجّع رابط صفحة الدفع
// (وضع تجربة: أضف ?sandbox=1 لاستخدام مفاتيح Hesabe التجريبية العامة)
const { encrypt, decrypt } = require("../lib/hesabeCrypt");

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SANDBOX = req.query && (req.query.sandbox === "1" || req.query.sandbox === "true");

  try {
    let MERCHANT, ACCESS, ENC_KEY, IV_KEY, BASE;
    if (SANDBOX) {
      // مفاتيح Hesabe التجريبية العامة (منشورة في التوثيق الرسمي)
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
    // في وضع التجربة نمرر sandbox=1 للـ callback ليفك التشفير بمفاتيح التجربة
    const CB = `${SITE}/api/callback${SANDBOX ? "?sandbox=1" : ""}`;

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
      orderReferenceNumber: orderRef, responseUrl: CB, failureUrl: CB, variable1: orderRef,
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
    catch (err) { return res.status(502).json({ error: "decrypt_failed", hesabeStatus: r.status, rawSample: raw.slice(0, 400) }); }

    let json;
    try { json = JSON.parse(decrypted); }
    catch (err) { return res.status(502).json({ error: "decrypted_not_json", hesabeStatus: r.status, decryptedSample: decrypted.slice(0, 200) }); }

    if (!json.status || !json.response || !json.response.data)
      return res.status(400).json({ error: "hesabe_error", message: json.message, details: json });

    const token = json.response.data;
    return res.status(200).json({ paymentUrl: `${BASE}/payment?data=${encodeURIComponent(token)}`, orderRef });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
