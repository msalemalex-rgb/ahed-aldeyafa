// /api/img?id=<itemId> — يخدم صورة الصنف المخزّنة في KV (img:<id>) مع تخزين مؤقت طويل
// الصور تُخزَّن كـ data URL (base64) ويُعاد إرسالها كصورة ثنائية لتقليل الحجم والتحميل الكسول.
const { cmd } = require("../lib/kv");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  const id = req.query && req.query.id;
  if (!id) return res.status(400).end();

  let dataUrl;
  try { dataUrl = await cmd(["GET", "img:" + String(id)]); }
  catch (_) { return res.status(500).end(); }
  if (!dataUrl) return res.status(404).end();

  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  let ct = "image/jpeg", b64 = dataUrl;
  if (m) { ct = m[1]; b64 = m[2]; }

  let buf;
  try { buf = Buffer.from(b64, "base64"); }
  catch (_) { return res.status(500).end(); }

  res.setHeader("Content-Type", ct);
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.setHeader("Content-Length", buf.length);
  res.status(200);
  return res.end(buf);
};
