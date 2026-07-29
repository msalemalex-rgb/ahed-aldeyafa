// حساب أسعار الطلب من المنيو المخزّن — مصدر واحد يستخدمه /api/checkout و /api/orders
// عشان ما يحصلش اختلاف بين المسارين مع الوقت.
// =====================================================================
//  إعادة حساب الإجمالي من أسعار المنيو المخزّنة على السيرفر.
//  المتصفح بيبعت الأصناف والكميات فقط — الأسعار كلها من عندنا، فما ينفعش
//  حد يعدّل المبلغ في المتصفح ويدفع أقل من قيمة الطلب.
// =====================================================================
const money = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

function norm(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}

function findItem(menu, id, name) {
  const wantId = String(id == null ? "" : id);
  for (const c of menu || []) {
    for (const it of c.items || []) {
      if (wantId && String(it.id) === wantId) return it;
    }
  }
  if (!name) return null;                      // ما نلجأ للاسم إلا لو مفيش id
  const wantName = norm(name);
  for (const c of menu || []) {
    for (const it of c.items || []) {
      if (norm(it.name) === wantName) return it;
    }
  }
  return null;
}

// سعر الاختيارات: نجيبه من تعريف الصنف نفسه، مش من اللي بعته المتصفح
function optionsPrice(item, sel) {
  let extra = 0;
  const groups = Array.isArray(item.options) ? item.options : [];
  for (const s of Array.isArray(sel) ? sel : []) {
    const label = norm(s && (s.l != null ? s.l : s.label));
    const choice = norm(s && (s.c != null ? s.c : s.choice));
    if (!choice) continue;
    let hit = null;
    for (const g of groups) {
      if (label && norm(g.label) && norm(g.label) !== label) continue;
      for (const ch of g.choices || []) {
        const cn = typeof ch === "string" ? ch : (ch && ch.name);
        if (norm(cn) === choice) { hit = ch; break; }
      }
      if (hit) break;
    }
    if (!hit) return { error: "unknown_option", choice };
    extra += typeof hit === "string" ? 0 : (Number(hit.price) || 0);
  }
  return { extra };
}

// يرجّع {ok:true,total,subtotal,fee} أو {ok:false,reason,detail}
function priceOrder(data, order) {
  const menu = (data && data.menu) || [];
  const st = (data && data.settings) || {};
  const lines = Array.isArray(order && order.lines) ? order.lines : [];
  if (!lines.length) return { ok: false, reason: "no_lines" };
  if (lines.length > 60) return { ok: false, reason: "too_many_lines" };

  let raw = 0;                       // بدون أي تقريب وسطي — زي حساب المتصفح بالحرف
  for (const l of lines) {
    const qty = Math.floor(Number(l && l.qty) || 0);
    if (!(qty >= 1 && qty <= 99)) return { ok: false, reason: "bad_qty", detail: l && l.name };
    const it = findItem(menu, l && l.id, l && l.name);
    if (!it) return { ok: false, reason: "unknown_item", detail: (l && l.name) || (l && l.id) };
    if (it.available === false) return { ok: false, reason: "item_unavailable", detail: it.name };
    const op = optionsPrice(it, l && l.sel);
    if (op.error) return { ok: false, reason: op.error, detail: it.name + " / " + op.choice };
    const unit = (Number(it.price) || 0) + op.extra;
    if (unit <= 0) return { ok: false, reason: "item_not_priced", detail: it.name };
    raw += unit * qty;
  }

  let disc = Number(st.directDiscount) || 0;
  if (disc > 1) disc = disc / 100;                       // اللوحة تحفظها كنسبة أو ككسر
  if (disc < 0 || disc >= 1) disc = 0;

  let fee = 0;
  if (String(order.deliveryType || "") === "delivery") {
    const areas = Array.isArray(st.areas) ? st.areas : [];
    const a = areas.find((x) => x && norm(x.name) === norm(order.area));
    if (!a) return { ok: false, reason: "unknown_area", detail: order.area };
    fee = Number(a.fee) || 0;
    const min = Number(a.minOrder) || 0;
    if (min > 0 && raw < min) return { ok: false, reason: "below_min", detail: a.name + " " + min };
  }

  // تقريب واحد في الآخر بنفس طريقة المتصفح (toFixed) — عشان الرقم اللي الزبون
  // شافه على الزر هو نفسه اللي يتحصّل بالمليم، بدون فرق فلس من تقريب وسطي.
  const total = Number((raw * (1 - disc) + fee).toFixed(3));
  return { ok: true, subtotal: Number(raw.toFixed(3)), net: Number((raw * (1 - disc)).toFixed(3)), fee: money(fee), total };
}


module.exports = { money, norm, findItem, optionsPrice, priceOrder };
