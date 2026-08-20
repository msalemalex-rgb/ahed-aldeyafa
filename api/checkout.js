// POST /api/checkout — ينشئ طلب دفع Hesabe ويرجّع رابط صفحة الدفع
// وضع التجربة: متغيّر البيئة HSB_SANDBOX=1 فقط (مش من الرابط — الرابط كان يسمح بتزوير الدفع)
const { encrypt, decrypt } = require("../lib/hesabeCrypt");
let kvOrders = null;
try { kvOrders = require("../lib/kv"); } catch (_) {}

const { money, priceOrder } = require("../lib/pricing");

// أسعار المنيو تُحتفظ في ذاكرة الدالة لمدة قصيرة، عشان التحقّق ما يضيفش
// رحلة لقاعدة البيانات على مسار الدفع. لو الحساب مش مطابق، نعيد القراءة
// طازجة ونتحقّق تاني قبل أي رفض — فما فيش رفض بسبب سعر قديم في الذاكرة.
const MENU_TTL_MS = 45000;
let _menu = { at: 0, data: null };
async function loadMenu(fresh) {
  if (!fresh && _menu.data && Date.now() - _menu.at < MENU_TTL_MS) return _menu.data;
  const raw = await kvOrders.cmd(["GET", "menu_data"]);
  const data = raw ? JSON.parse(raw) : null;
  if (data) _menu = { at: Date.now(), data };
  return data;
}

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
          // نحمّل الأسعار للذاكرة كمان، فالتحقّق وقت الدفع ما يحتاجش رحلة إضافية
          kvOrders && kvOrders.cmd ? loadMenu(true).catch(() => {}) : null,
        ]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (_) {}
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ warm: 1, ms: Date.now() - t0 });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SANDBOX = String(process.env.HSB_SANDBOX || "") === "1";  // من البيئة فقط — مش من الرابط

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
    const CB = `${SITE}/api/callback`;   // الطرفان يقرآن نفس متغيّر البيئة

    if (!MERCHANT || !ACCESS || !ENC_KEY || !IV_KEY || !SITE)
      return res.status(500).json({ error: "Missing env" });

    const body = await readBody(req);
    // طريقة الدفع: knet (مباشر) | other (صفحة حسابة بكل الطرق المفعلة في الحساب)
    const METHOD_MAP = { knet: "1", other: "0", card: "2", amex: "7", applepay: "9" };
    const PAY_TYPE = METHOD_MAP[String(body.method || "").toLowerCase()] || (process.env.HSB_PAYMENT_TYPE || "1").trim();
    const asked = Number(body.amount);
    if (!asked || asked < 0.1 || asked > 100000)
      return res.status(400).json({ error: "Invalid amount", got: body.amount });

    if (!kvOrders || !kvOrders.cmd)
      return res.status(503).json({ error: "store_unavailable" });

    // ===== المبلغ يتحدد على السيرفر، مش من المتصفح =====
    let amountNum, serverPrice = null, existing = null;
    const reuseRef = String(body.orderRef || "").trim();

    if (reuseRef) {
      // إعادة دفع لطلب قائم: لازم يكون موجود ولسه مستني الدفع، والمبلغ يساوي إجماليه
      let raw = null;
      try { raw = await kvOrders.cmd(["GET", "order:" + reuseRef.slice(0, 60)]); }
      catch (_) { return res.status(503).json({ error: "store_unavailable" }); }
      if (!raw) return res.status(404).json({ error: "order_not_found" });
      try { existing = JSON.parse(raw); } catch (_) { return res.status(500).json({ error: "order_unreadable" }); }
      const st = String(existing.status || "");
      if (st !== "pending" && st !== "failed")
        return res.status(409).json({ error: "order_not_payable", status: st });
      amountNum = Number(existing.total) || 0;
      if (!(amountNum >= 0.1)) return res.status(409).json({ error: "order_total_invalid" });
    } else {
      if (!body.order) return res.status(400).json({ error: "missing_order" });
      const matches = (p) => p && p.ok && Math.abs(p.total - asked) <= 0.0015;
      let usedFresh = false, data = null;
      try {
        data = await loadMenu(false);                      // المسار السريع: من الذاكرة
        if (data) serverPrice = priceOrder(data, body.order);
        if (!matches(serverPrice)) {                       // أي اختلاف → نتأكد من أسعار طازجة
          usedFresh = true;
          data = await loadMenu(true);
          serverPrice = data ? priceOrder(data, body.order) : null;
        }
      } catch (_) { return res.status(503).json({ error: "store_unavailable" }); }
      if (!data) return res.status(503).json({ error: "menu_unavailable" });
      if (!serverPrice || !serverPrice.ok)
        return res.status(400).json({ error: "price_check_failed", reason: serverPrice ? serverPrice.reason : "no_price", detail: serverPrice && serverPrice.detail });

      // فرق أكبر من فلس واحد = رفض. المبلغ المحصَّل هو حساب السيرفر دايماً.
      if (!matches(serverPrice))
        return res.status(409).json({ error: "amount_mismatch", expected: serverPrice.total, got: money(asked) });

      amountNum = serverPrice.total;
      if (usedFresh) { /* قرأنا طازج — الذاكرة اتحدّثت جوه loadMenu */ }
    }
    const amount = amountNum.toFixed(3);

    // رقم الطلب يُولَّد محلياً قبل أي كتابة، فنقدر نبدأ طلب بوابة الدفع فوراً
    // بدل ما ننتظر قاعدة البيانات — الاتنين بيشتغلوا بالتوازي.
    const willCreate = !!(!reuseRef && body.order && kvOrders.addOrder);
    const orderRef = (
      reuseRef ||
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
          const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
// خانات العنوان المنفصلة (قطعة/شارع/جادة/منزل/دور/شقة) — نقصّها ونخزّنها بجانب النص
const cutAddr = (a) => {
  if (!a || typeof a !== "object") return null;
  const o = { block: cut(a.block, 40), street: cut(a.street, 40), ave: cut(a.ave, 40),
              house: cut(a.house, 40), floor: cut(a.floor, 40), apt: cut(a.apt, 40), landmark: cut(a.landmark, 80) };
  return (o.block || o.street || o.house) ? o : null;
};
          // كل الأرقام المالية من حساب السيرفر — النصوص فقط هي اللي من المتصفح (بحد أقصى للطول)
          return kvOrders.addOrder({
            items: cut(b.items, 2000), total: amountNum, channel: "knet",
            name: cut(b.name, 80), phone: cut(b.phone, 25), note: cut(b.note, 300),
            deliveryType: b.deliveryType === "pickup" ? "pickup" : "delivery",
            area: cut(b.area, 60), address: cut(b.address, 300), addr: cutAddr(b.addr),
            deliveryFee: serverPrice ? serverPrice.fee : 0,
            deliveryTime: cut(b.deliveryTime, 60),
            mapUrl: cut(b.mapUrl, 300), scheduledFor: cut(b.scheduledFor, 40),
            lines: Array.isArray(b.lines) ? b.lines.slice(0, 60) : [],
            itemsSubtotal: serverPrice ? serverPrice.subtotal : 0,
            discountPct: serverPrice ? Math.round((1 - (serverPrice.net / (serverPrice.subtotal || 1))) * 100) : 0,
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
