// /api/i18n-report — تقرير عام للقراءة فقط: إيه اللي لسه ناقص ترجمة في المنيو
// مفيهوش أي بيانات حساسة (نفس المعلومات الظاهرة أصلاً في /api/menu العام)
const { cmd } = require("../lib/kv");
const { norm, latinOnly, CMAP, PMAP, DESC_TR } = require("../lib/i18n-data");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  try {
    const raw = await cmd(["GET", "menu_data"]);
    if (!raw) return res.status(404).json({ error: "no menu" });
    const data = JSON.parse(raw);
    const catMissing = [], itemMissing = [], descMissing = [];
    for (const c of (data.menu || [])) {
      if (!c.catEn && !CMAP[norm(c.cat)]) catMissing.push(c.cat);
      for (const it of (c.items || [])) {
        if (!it.nameEn && !PMAP[norm(it.name)] && !latinOnly(it.desc)) itemMissing.push(it.name);
        if (it.desc && !latinOnly(it.desc) && !it.descEn && !DESC_TR[norm(it.desc)]) descMissing.push({ item: it.name, desc: it.desc });
      }
    }
    const cats = (data.menu || []).map(c => ({ ar: c.cat, en: c.catEn || CMAP[norm(c.cat)] || null }));
    return res.status(200).json({ fixVersion: data._i18nFixV || 0, cats, catMissing, itemMissing, descMissing });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
