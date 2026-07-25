// /api/i18n-fix — تقرير/إعادة تشغيل تنظيف أسماء المنيو الإنجليزية (أدمن فقط)
// ملاحظة: التنظيف بيحصل تلقائياً مرة واحدة عند أول تحميل للمنيو (شوف api/menu.js)
// الأداة دي للمعاينة أو لإعادة التشغيل بعد إضافة أصناف جديدة.
// GET ?key=ADMIN_PASSWORD            → تقرير تجريبي (Dry Run) بدون حفظ
// GET ?key=ADMIN_PASSWORD&apply=1    → تنفيذ فعلي وحفظ
const { cmd } = require("../lib/kv");
const { applyI18nFix } = require("../lib/i18n-data");

function isAdmin(req) {
  const k = (req.query && req.query.key) || req.headers["x-admin-key"];
  return process.env.ADMIN_PASSWORD && k === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized — أضف ?key=كلمة سر الأدمن" });
  const apply = req.query && (req.query.apply === "1" || req.query.apply === "true");
  try {
    const raw = await cmd(["GET", "menu_data"]);
    if (!raw) return res.status(404).json({ error: "menu_data not found" });
    const data = JSON.parse(raw);
    const rep = applyI18nFix(data);
    rep.mode = apply ? "APPLIED ✅ تم الحفظ" : "DRY-RUN 👀 معاينة فقط — أضف &apply=1 للتنفيذ";
    if (apply) { data._i18nFixed = 1; await cmd(["SET", "menu_data", JSON.stringify(data)]); }
    rep.summary = {
      "أقسام اتسمّت إنجليزي": rep.cats.length,
      "أصناف اتنقل اسمها من الوصف": rep.fromDesc.length,
      "أصناف اتجاب اسمها من qonsole": rep.fromQonsole.length,
      "أسماء اتصلّحت": rep.fixedExisting.length,
      "كانت سليمة من الأول": rep.alreadyOk,
      "لسه ناقصة (كمّلها من لوحة التحكم)": rep.stillMissing.length,
    };
    return res.status(200).json(rep);
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
