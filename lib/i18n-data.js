// lib/i18n-data.js — قاموس الأسماء الإنجليزية + منطق التنظيف (مشترك بين menu وi18n-fix)
// تطبيع عربي للمطابقة: إزالة تشكيل/تطويل، توحيد الألف والتاء المربوطة، مسافات
function norm(s) {
  return String(s || "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[()،,.\/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const latinOnly = (s) => !!s && /[A-Za-z]/.test(s) && !/[؀-ۿ]/.test(s);

// تصحيحات لترجمات غلط/غير متسقة (تطبق على أي قيمة إنجليزية تمر من هنا)
const FIX = {
  "australian meat impregnation": "Australian Meat Tashreeb",
  "impregnation without meat": "Tashreeb without Meat",
  "mutabbaq seabas": "Mutabbaq Seabass",
  "mutabbaq seabas royal": "Royal Mutabbaq Seabass",
  "double seabas / zubaidi": "Double Seabass / Zubaidi",
  "empty mahboos rice": "Plain Majboos Rice",
  "empty fish/shrimp rice": "Plain Fish/Shrimp Rice",
  "empty mamoush rice": "Plain Mamoush Rice",
  "groats (hareis)": "Harees",
  "pudding": "Muhallabia",
  "rob & cucumber": "Yogurt & Cucumber",
  "rob and cucumber": "Yogurt & Cucumber",
  "broth / dakus": "Broth / Daqoos",
  "vegetable margog": "Vegetable Margoog",
  "vegetable marqoq": "Vegetable Margoog",
  "tender shrimp": "Murabbin Tender Shrimp",
  "soft shrimp double": "Double Tender Shrimp",
  "chicken double": "Double Chicken",
  "arabic double meat": "Double Arabic Meat",
  "australian double meat": "Double Australian Meat",
  "double  zubaidi": "Double Zubaidi",
  "double dry shrimp": "Double Dry Shrimp",
  "big dakoos": "Large Daqoos",
  "big broth": "Large Broth",
  "miranda orange": "Mirinda Orange",
  "red rooster": "Abu Deek Daqoos Bottle",
  "stuffing bowl": "Stuffing Bowl",
  "double vegetables": "Double Vegetables",
  "double pickles": "Double Pickles",
  "adani ghee": "Adani Ghee",
  "double sea bass": "Double Seabass",
};
function fixEn(v) {
  const t = String(v || "").replace(/\s+/g, " ").trim();
  const f = FIX[t.toLowerCase()];
  return f || t;
}

// قاموس qonsole: الاسم العربي (مطبّع) → الاسم الإنجليزي
const RAW_MAP = [
  ["مجبوس لحم استرالي", "Australian Meat Majboos"],
  ["مجبوس لحم عربي", "Arabic Meat Majboos"],
  ["مجبوس دجاج", "Chicken Majboos"],
  ["برياني لحم استرالي", "Australian Meat Biryani"],
  ["برياني دجاج", "Chicken Biryani"],
  ["مطبق زبيدي", "Mutabbaq Zubaidi"],
  ["مطبق زبيدي ملكي", "Royal Mutabbaq Zubaidi"],
  ["مطبق سيباس", "Mutabbaq Seabass"],
  ["مطبق سيباس ملكي", "Royal Mutabbaq Seabass"],
  ["مربين روبيان طري", "Murabbin Tender Shrimp"],
  ["مموش روبيان يابس", "Mamoush Dry Shrimp"],
  ["مموش روبيان طري", "Mamoush Tender Shrimp"],
  ["تشريب لحم استرالي", "Australian Meat Tashreeb"],
  ["تشريب بدون لحم", "Tashreeb without Meat"],
  ["قبوط لحم", "Meat Qaboot"],
  ["قبوط بدون لحم", "Qaboot without Meat"],
  ["مرقوق خضار", "Vegetable Margoog"],
  ["مرقوق", "Vegetable Margoog"],
  ["مشخول / عيش + مرق لحم", "Mashkoul / Rice + Meat Broth"],
  ["معكرونة الطيبين باللحم", "Taybeen Macaroni with Meat"],
  ["كبه برغل باللحم (6 قطع)", "Meat Bulgur Kibbeh (6 pcs)"],
  ["كبه برغل باللحم (٦ قطع)", "Meat Bulgur Kibbeh (6 pcs)"],
  ["كبه بطاطا باللحم (6 قطع)", "Meat Potato Kibbeh (6 pcs)"],
  ["كبه بطاطا باللحم (٦ قطع)", "Meat Potato Kibbeh (6 pcs)"],
  ["كبة بطاط باللحم", "Meat Potato Kibbeh"],
  ["الهريس", "Harees"],
  ["هريس لحم", "Meat Harees"],
  ["الجريش", "Jereesh"],
  ["سلطة خضار", "Vegetable Salad"],
  ["سلطة جرجير", "Arugula Salad"],
  ["روب خيار", "Yogurt & Cucumber"],
  ["روب و خيار", "Yogurt & Cucumber"],
  ["سلطة شمندر", "Beetroot Salad"],
  ["سلطة جرجير وشمندر", "Arugula & Beetroot Salad"],
  ["شوربة عدس", "Lentil Soup"],
  ["شوربة دجاج", "Chicken Soup"],
  ["دبل لحم عربي", "Double Arabic Meat"],
  ["دبل دجاج", "Double Chicken"],
  ["دبل روبيان طري", "Double Tender Shrimp"],
  ["دبل روبيان يابس", "Double Dry Shrimp"],
  ["دبل زبيدي", "Double Zubaidi"],
  ["دبل زبيدي / سيباس", "Double Zubaidi / Seabass"],
  ["دبل سيباس", "Double Seabass"],
  ["دبل لحم استرالي", "Double Australian Meat"],
  ["عيش مجبوس خالي", "Plain Majboos Rice"],
  ["عيش سمك / روبيان خالي", "Plain Fish/Shrimp Rice"],
  ["عيش مموش خالي", "Plain Mamoush Rice"],
  ["مرق", "Broth"],
  ["مرق لحم", "Meat Broth"],
  ["مرق كبير", "Large Broth"],
  ["مرق / دقوس / دقوس صبار", "Broth / Daqoos"],
  ["معبوج احمر", "Red Mabooj"],
  ["معبوج اخضر", "Green Mabooj"],
  ["ماعون حشو", "Stuffing Bowl"],
  ["دبل خضار", "Double Vegetables"],
  ["دبل خضرة", "Double Vegetables"],
  ["دهن عداني", "Adani Ghee"],
  ["دبل اجار", "Double Pickles"],
  ["دقوس", "Daqoos Sauce"],
  ["دقوس كبير", "Large Daqoos"],
  ["دقوس صبار", "Cactus Daqoos"],
  ["بطل دقوس أبو ديك", "Abu Deek Daqoos Bottle"],
  ["بطل دقوس ابو ديك", "Abu Deek Daqoos Bottle"],
  ["صينية قصدير", "Foil Tray"],
  ["صينية استيل", "Steel Tray"],
  ["كريم كراميل", "Creme Caramel"],
  ["مهلبية", "Muhallabia"],
  ["جيلي", "Jelly"],
  ["عصير برتقال", "Orange Juice"],
  ["عصير برتقال / ليمون", "Orange / Lemon Juice"],
  ["عصير ليمون ونعناع", "Lemon & Mint Juice"],
  ["عصير ليمون", "Lemon Juice"],
  ["مشروب غازي", "Soft Drink"],
  ["بيبسي", "Pepsi"],
  ["بيبسي دايت", "Diet Pepsi"],
  ["سفن اب", "7Up"],
  ["سفن اب دايت", "Diet 7Up"],
  ["ميرندا", "Mirinda"],
  ["ميرندا برتقال", "Mirinda Orange"],
  ["شاني", "Shani"],
  ["شاني فواكه", "Shani Fruits"],
  ["ديو", "Mountain Dew"],
  ["ماونتن ديو", "Mountain Dew"],
  ["لبن فرش", "Fresh Laban"],
  ["لبن اكتيفيا", "Activia Laban"],
  ["روب", "Yogurt"],
  ["ماء صحة صغير", "Small Water"],
  ["سيباس ملكي", "Royal Seabass"],
  ["ربع قوزي استرالي يد و جنب", "Quarter Australian Ghuzi (Shoulder & Ribs)"],
  ["نصف قوزي استرالي", "Half Australian Ghuzi"],
  ["قوزي استرالي كامل", "Whole Australian Ghuzi"],
  ["مجبوس ربع دجاجة", "Quarter Chicken Majboos"],
  ["مجبوس لحم 1 قطعة", "Meat Majboos (1 pc)"],
  ["صينية مجبوس لحم استرالي قصدير تكفي شخصين", "Australian Meat Majboos Foil Tray (serves 2)"],
  ["صينية قصدير مجبوس لحم استرالي تكفي ثلاث اشخاص", "Australian Meat Majboos Foil Tray (serves 3)"],
  ["صينية قصدير مجبوس لحم استرالي تكفي اربع اشخاص", "Australian Meat Majboos Foil Tray (serves 4)"],
  ["صينية قصدير مجبوس لحم استرالي تكفي خمس اشخاص", "Australian Meat Majboos Foil Tray (serves 5)"],
  ["صينية استيل تكفي سبعة اشخاص", "Steel Tray (serves 7)"],
  ["صينية استيل تكفي عشر اشخاص", "Steel Tray (serves 10)"],
  ["صينية قصدير مجبوس دجاج تكفي ثلاث اشخاص", "Chicken Majboos Foil Tray (serves 3)"],
  ["صينية قصدير مجبوس دجاج تكفي 4 اشخاص مع الشوربة و اللبن", "Chicken Majboos Foil Tray (serves 4) with Soup & Laban"],
];
const PMAP = {};
for (const [a, e] of RAW_MAP) PMAP[norm(a)] = e;

// أسماء الأقسام
const RAW_CATS = [
  ["المجبوس والبرياني", "Majboos & Biryani"],
  ["المطبق والروبيان", "Mutabbaq & Shrimp"],
  ["التشاريب والأطباق الشعبية", "Tashreeb & Traditional Dishes"],
  ["السلطات", "Salads"],
  ["الشوربات", "Soups"],
  ["الإضافات", "Add-ons"],
  ["الحلويات", "Desserts"],
  ["العصائر والمشروبات", "Juices & Drinks"],
  ["صواني مجبوس اللحم الاسترالي", "Australian Meat Majboos Trays"],
  ["الصواني", "Trays"],
  ["قوزي استرالي", "Australian Ghuzi"],
  ["ضيافة", "Hospitality"],
];
const CMAP = {};
for (const [a, e] of RAW_CATS) CMAP[norm(a)] = e;


// يطبّق التنظيف على بيانات المنيو (in-place) ويرجّع تقرير
function applyI18nFix(data){
  const rep={cats:[],fromDesc:[],fromQonsole:[],fixedExisting:[],alreadyOk:0,stillMissing:[]};
  for(const c of (data.menu||[])){
    if(!c.catEn){const m=CMAP[norm(c.cat)];if(m){c.catEn=m;rep.cats.push({ar:c.cat,en:m});}}
    for(const it of (c.items||[])){
      const before=it.nameEn||"";
      if(it.nameEn){
        const f=fixEn(it.nameEn);
        if(f!==it.nameEn){it.nameEn=f;rep.fixedExisting.push({ar:it.name,from:before,to:f});}
        else rep.alreadyOk++;
      }else if(latinOnly(it.desc)){
        it.nameEn=fixEn(it.desc);it.desc="";
        rep.fromDesc.push({ar:it.name,en:it.nameEn});
      }else{
        const m=PMAP[norm(it.name)];
        if(m){it.nameEn=m;rep.fromQonsole.push({ar:it.name,en:m});}
        else rep.stillMissing.push(it.name);
      }
    }
  }
  return rep;
}
module.exports={norm,latinOnly,fixEn,PMAP,CMAP,applyI18nFix};
