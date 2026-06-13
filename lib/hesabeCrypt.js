// =====================================================================
//  Hesabe Encryption helper  (AES-256-CBC, hex output)
//  مطابق لمكتبة HesabeCrypt الرسمية (encrypt / decrypt)
//  - encryptionKey : 32 حرف (256-bit)
//  - ivKey         : 16 حرف (128-bit)
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
  let dec = decipher.update(String(encryptedHex).trim(), "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

module.exports = { encrypt, decrypt };
