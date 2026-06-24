// =====================================================================
//  Hesabe Encryption helper  (AES-256-CBC, hex output)
//  مطابق لمكتبة HesabeCrypt الرسمية (encrypt / decrypt)
//  - encryptionKey : 32 حرف (256-bit)
//  - ivKey         : 16 حرف (128-bit)
//
//  ملاحظة مهمة: Hesabe يستخدم حشو (padding) بحجم بلوك 32 بايت ويزيله
//  يدوياً (OPENSSL_ZERO_PADDING). لذلك نعطّل الإزالة التلقائية في Node
//  (التي تفترض بلوك 16 وترفض أي pad أكبر من 16 بخطأ "bad decrypt")
//  ونزيل الحشو يدوياً. هذا ما كان يسبب فشل فك تشفير رد الـ callback
//  بينما ينجح فك تشفير رد الـ checkout (الذي صادف أن padding ≤ 16).
// =====================================================================
const crypto = require("crypto");

function encrypt(plainText, key, iv) {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv, "utf8")
  );
  let enc = cipher.update(plainText, "utf8", "hex");
  enc += cipher.final("hex");
  return enc; // hex string
}

function decrypt(encryptedHex, key, iv) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv, "utf8")
  );
  decipher.setAutoPadding(false); // نزيل الحشو يدوياً (Hesabe يحشو لبلوك 32)
  let buf = Buffer.concat([
    decipher.update(Buffer.from(String(encryptedHex).trim(), "hex")),
    decipher.final(),
  ]);
  // إزالة حشو PKCS: آخر بايت = عدد بايتات الحشو (1..32)
  if (buf.length) {
    const pad = buf[buf.length - 1];
    if (pad > 0 && pad <= 32 && pad <= buf.length) {
      let valid = true;
      for (let i = buf.length - pad; i < buf.length; i++) {
        if (buf[i] !== pad) { valid = false; break; }
      }
      if (valid) buf = buf.slice(0, buf.length - pad);
    }
  }
  return buf.toString("utf8");
}

module.exports = { encrypt, decrypt };
