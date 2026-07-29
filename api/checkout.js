// POST /api/checkout — ينشئ طلب دفع Hesabe ويرجّع رابط صفحة الدفع
// (وضع تجربة: أضف ?sandbox=1 لاستخدام مفاتيح Hesabe التجريبية العامة)
const { encrypt, decrypt } = require("../lib/hesabeCrypt");
let kvOrders = null;
try { kvOrders = require("../lib/kv"); } catch (_) {}

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

  // GET = تسخين: يوقظ الدالة ويفتح اتصال TLS مع بوابة الدفع وقاعدة البيانات
  // قبل ما يضغط الزبون "ادفع"، فيختفي زمن البدء البارد من رحلة الدفع نفسها.
  if (req.method === "GET") {
    const B = (process.env.HSB_BASE_URL || "https://api.hesabe.com").trim().replace(/\/+$/, "");
    const t0 = Date.now();
    try {
      await Promise.race([
        Promise.all([
          fetch(B + "/", { method: "GET" }).then((r) => r.arrayBuffer()).catch(() => {}),
          kvOrders && kvOrders.cmd ? kvOrders.cmd(["PING"]).catch(() => {}) : null,
        ]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (_) {}
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ warm: 1, ms: Date.now() - t0 });
  }

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
    // في وضع التجربة نمرر sandbox=1 للـ callback ليفك التشفير بمفاتيح التجربة
    const CB = `${SITE}/api/callback${SANDBOX ? "?sandbox=1" : ""}`;

    if (!MERCHANT || !ACCESS || !ENC_KEY || !IV_KEY || !SITE)
      return res.status(500).json({ error: "Missing env" });

    const body = await readBody(req);
    // طريقة الدفع: knet (مباشر) | other (صفحة حسابة بكل الطرق المفعلة في الحساب)
    const METHOD_MAP = { knet: "1", other: "0", card: "2", amex: "7", applepay: "9" };
    const PAY_TYPE = METHOD_MAP[String(body.method || "").toLowerCase()] || (process.env.HSB_PAYMENT_TYPE || "1").trim();
    const amountNum = Number(body.amount);
    if (!amountNum || amountNum < 0.1 || amountNum > 100000)
      return res.status(400).json({ error: "Invalid amount", got: body.amount });
    const amount = amountNum.toFixed(3);

    // رقم الطلب يُولَّد محلياً قبل أي كتابة، فنقدر نبدأ طلب بوابة الدفع فوراً
    // بدل ما ننتظر قاعدة البيانات — الاتنين بيشتغلوا بالتوازي.
    const willCreate = !!(!body.orderRef && body.order && kvOrders && kvOrders.addOrder);
    const orderRef = (
      body.orderRef ||
      (willCreate && kvOrders.newId ? kvOrders.newId("ORD") : "AHD-" + Date.now())
    ).toString().slice(0, 40);

    const payload = {
      merchantCode: MERCHANT, amount, currency: "KWD", paymentType: PAY_TYPE, version: "2.0",
      orderReferenceNumber: orderRef, responseUrl: CB, failureUrl: CB, variable1: orderRef,
    };

    const encrypted = encrypt(JSON.stringify(payload), ENC_KEY, IV_KEY);
    const hesabeP = fetch(`${BASE}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", accessCode: ACCESS },
      body: new URLSearchParams({ data: encrypted }).toString(),
    }).then(async (rr) => ({ status: rr.status, raw: (await rr.text()).trim() }));

    const orderP = willCreate
      ? (async () => {
          const b = body.order;
          return kvOrders.addOrder({
            items: b.items, total: Number(b.total) || amountNum, channel: "knet",
            name: b.name || "", phone: b.phone || "", note: b.note || "",
            deliveryType: b.deliveryType || "", area: b.area || "", address: b.address || "",
            deliveryFee: Number(b.deliveryFee) || 0, deliveryTime: b.deliveryTime || "",
            mapUrl: b.mapUrl || "", scheduledFor: b.scheduledFor || "",
            lines: Array.isArray(b.lines) ? b.lines : [],
            itemsSubtotal: Number(b.itemsSubtotal) || 0, discountPct: Number(b.discountPct) || 0,
            status: "pending",
          }, orderRef);
        })().catch(() => null)
      : Promise.resolve(null);

    const _t0 = Date.now();
    let _tHesabe = 0, _tOrder = 0;
    hesabeP.then(() => { _tHesabe = Date.now() - _t0; }).catch(() => {});
    orderP.then(() => { _tOrder = Date.now() - _t0; }).catch(() => {});
    const [hres, createdOrder] = await Promise.all([hesabeP, orderP]);
    const r = { status: hres.status };
    const raw = hres.raw;
    const timings = { gatewayMs: _tHesabe, orderSaveMs: _tOrder, totalMs: Date.now() - _t0 };

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
    const out = {
      paymentUrl: `${BASE}/payment?data=${encodeURIComponent(token)}`,
      orderRef,
      orderNo: createdOrder ? createdOrder.no : undefined,
    };
    // ?debug=1 يرجّع تفصيل الزمن لتشخيص أي بطء لاحق
    if (req.query && (req.query.debug === "1" || req.query.debug === "true")) out.timings = timings;
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
};
