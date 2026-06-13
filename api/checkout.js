// =====================================================================
//  POST /api/checkout
//  ينشئ طلب دفع في Hesabe ويرجّع رابط صفحة الدفع
//  Body (JSON): { amount, orderRef, name?, mobile?, email? }
//  المفاتيح تُقرأ من Environment Variables في Vercel (مش في الكود)
// =====================================================================
const { encrypt, decrypt } = require("../lib/hesabeCrypt");

module.exports = async (req, res) => {
  // CORS (لو الموقع على دومين تاني)
  res.setHeader("Access-Control-Allow-Origin", process.env.SITE_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const MERCHANT  = process.env.HSB_MERCHANT_CODE;
    const ACCESS    = process.env.HSB_ACCESS_CODE;
    const ENC_KEY   = process.env.HSB_ENCRYPTION_KEY;
    const IV_KEY    = process.env.HSB_IV_KEY;
    const BASE      = process.env.HSB_BASE_URL || "https://api.hesabe.com"; // production
    const SITE      = process.env.SITE_URL;     // مثال: https://ahedaldeyafa.com
    const PAY_TYPE  = process.env.HSB_PAYMENT_TYPE || "1"; // 1 = KNET

    if (!MERCHANT || !ACCESS || !ENC_KEY || !IV_KEY || !SITE) {
      return res.status(500).json({ error: "Missing Hesabe environment variables" });
    }

    // قراءة الـ body
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const amountNum = Number(body.amount);
    if (!amountNum || amountNum < 0.1 || amountNum > 100000) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const amount   = amountNum.toFixed(3);
    const orderRef = (body.orderRef || ("AHD-" + Date.now())).toString().slice(0, 40);

    // بناء بيانات الطلب
    const payload = {
      merchantCode: MERCHANT,
      amount: amount,
      currency: "KWD",
      paymentType: PAY_TYPE,
      version: "2.0",
      orderReferenceNumber: orderRef,
      responseUrl: `${SITE}/api/callback`,
      failureUrl:  `${SITE}/api/callback`,
      variable1: orderRef,
    };
    if (body.name)   payload.name = String(body.name).slice(0, 60);
    if (body.mobile) payload.mobile_number = String(body.mobile).replace(/\D/g, "").slice(0, 8);
    if (body.email)  payload.email = String(body.email).slice(0, 80);

    // تشفير + إرسال لـ Hesabe
    const encrypted = encrypt(JSON.stringify(payload), ENC_KEY, IV_KEY);
    const r = await fetch(`${BASE}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        accessCode: ACCESS,
      },
      body: new URLSearchParams({ data: encrypted }).toString(),
    });

    const raw = (await r.text()).trim();

    // الرد قد يكون نص مشفّر مباشرة، أو JSON يحوي الحقل المشفّر
    let encResp = raw;
    try {
      const j = JSON.parse(raw);
      encResp = j.response || j.data || raw;
    } catch (_) { /* raw is the encrypted hex */ }

    const decrypted = decrypt(encResp, ENC_KEY, IV_KEY);
    const json = JSON.parse(decrypted);

    if (!json.status || !json.response || !json.response.data) {
      return res.status(400).json({ error: json.message || "Checkout failed", details: json });
    }

    const token = json.response.data;
    const paymentUrl = `${BASE}/payment?data=${encodeURIComponent(token)}`;
    return res.status(200).json({ paymentUrl, orderRef });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
