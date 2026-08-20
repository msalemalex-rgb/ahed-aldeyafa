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
  ["صينية مجبوس دجاج تكفي 5 (غير مصنف)", "Chicken Majboos Tray (serves 5)"],
  ["صينية سيباس تكفي 3 (غير مصنف)", "Seabass Tray (serves 3)"],
  ["ربع دجاجة", "Quarter Chicken"],
  ["كبدة عربي", "Arabic Lamb Liver"],
  ["راس عربي", "Arabic Lamb Head"],
  ["نصف قوزي عربي", "Half Arabic Ghuzi"],
  ["ربع قوزي عربي يد و جنب", "Quarter Arabic Ghuzi (Shoulder & Ribs)"],
  ["ربع قوزي عربي فخذ", "Quarter Arabic Ghuzi (Leg)"],
  ["رع قوزي عربي فخذ", "Quarter Arabic Ghuzi (Leg)"],
  ["صينية استيل ملكية", "Royal Steel Tray"],
  ["ربع قوزي طلي صغير", "Quarter Small Lamb Ghuzi"],
  ["طبخ ربع قوزي كبير", "Cooking Service: Quarter Large Ghuzi"],
  ["طبخ نصف قوزي طلي صغير", "Cooking Service: Half Small Lamb Ghuzi"],
  ["طبخ نصف قوزي كبير", "Cooking Service: Half Large Ghuzi"],
  ["طبخ شخص واحد", "Cooking Service (per person)"],
  ["شخص مرق سمك طبخ", "Fish Broth Cooking (per person)"],
  ["وجبة عمال", "Staff Meal"],
  ["صينية قصدير تكفي شخصين", "Foil Tray (serves 2)"],
  ["صينية لحم استرالي قصدير تكفي ثلاث اشخاص", "Australian Meat Foil Tray (serves 3)"],
  ["صينية لحم استرالي قصدير تكفي اربع اشخاص", "Australian Meat Foil Tray (serves 4)"],
  ["صينية لحم استرالي قصدير تكفي خمس اشخاص", "Australian Meat Foil Tray (serves 5)"],
  ["صينية لحم استرالي استيل تكفي سبعة اشخاص", "Australian Meat Steel Tray (serves 7)"],
  ["صينية لحم استرالي استيل تكفي عشر اشخاص", "Australian Meat Steel Tray (serves 10)"],
  ["صينية قصدير مجبوس دجاج تكفي شخصين", "Chicken Majboos Foil Tray (serves 2)"],
  ["صينية قصدير مجبوس دجاج تكفي اربع اشخاص", "Chicken Majboos Foil Tray (serves 4)"],
  ["صينية قصدير مجبوس دجاج تكفي خمسة اشخاص", "Chicken Majboos Foil Tray (serves 5)"],
  ["صينية استيل مجبوس دجاج تكفي سبعة اشخاص", "Chicken Majboos Steel Tray (serves 7)"],
  ["صينية استيل مجبوس دجاج تكفي عشر اشخاص", "Chicken Majboos Steel Tray (serves 10)"],
  ["صينية قصدير برياني لحم تكفي شخصين", "Meat Biryani Foil Tray (serves 2)"],
  ["صينية قصدير ثلاث اشخاص برياني لحم تكفي ثلاث اشخاص", "Meat Biryani Foil Tray (serves 3)"],
  ["صينية قصدير برياني لحم تكفي اربع اشخاص", "Meat Biryani Foil Tray (serves 4)"],
  ["صينية قصدير برياني لحم تكفي خمس اشخاص", "Meat Biryani Foil Tray (serves 5)"],
  ["صينية قصدير برياني دجاج تكفي شخصين", "Chicken Biryani Foil Tray (serves 2)"],
  ["صينية قصدير برياني دجاج تكفي ثلاث اشخاص", "Chicken Biryani Foil Tray (serves 3)"],
  ["صينية قصدير برياني دجاج تكفي اربع اشخاص", "Chicken Biryani Foil Tray (serves 4)"],
  ["صينية قصدير برياني دجاج تكفي خمسة اشخاص", "Chicken Biryani Foil Tray (serves 5)"],
  ["صينية استيل برياني دجاج تكفي سبعة اشخاص", "Chicken Biryani Steel Tray (serves 7)"],
  ["صينية قصدير تكفي شخصين مموش روبيان يابس", "Dry Shrimp Mamoush Foil Tray (serves 2)"],
  ["صينية قصدير تكفي ثلاث اشخاص مموش روبيان يابس", "Dry Shrimp Mamoush Foil Tray (serves 3)"],
  ["صينية قصدير تكفي اربع اشخاص مموش روبيان يابس", "Dry Shrimp Mamoush Foil Tray (serves 4)"],
  ["صينية قصدير مموش روبيان يابس تكفي خمسة اشخاص", "Dry Shrimp Mamoush Foil Tray (serves 5)"],
  ["صينية استيل تكفي سبعة اشخاص مموش روبيان يابس", "Dry Shrimp Mamoush Steel Tray (serves 7)"],
  ["صينية قصدير مربين ربيان طري تكفي شخصين", "Murabbin Tender Shrimp Foil Tray (serves 2)"],
  ["صينية قصدير مربين ربيان طري تكفي ثلاث اشخاص", "Murabbin Tender Shrimp Foil Tray (serves 3)"],
  ["صينية قصدير مربين ربيان طري تكفي اربع اشخاص", "Murabbin Tender Shrimp Foil Tray (serves 4)"],
  ["صينية قصدير مربين ربيان طري تكفي خمس اشخاص", "Murabbin Tender Shrimp Foil Tray (serves 5)"],
  ["صينية استيل مربين روبيان طري تكفي سبعة اشخاص", "Murabbin Tender Shrimp Steel Tray (serves 7)"],
  ["صينية قصدير مموش روبيان طري تكفي شخصين", "Tender Shrimp Mamoush Foil Tray (serves 2)"],
  ["صينية قصدير مموش روبيان طري تكفي ثلاث اشخاص", "Tender Shrimp Mamoush Foil Tray (serves 3)"],
  ["صينية قصدير مموش روبيان طري تكفي اربع اشخاص", "Tender Shrimp Mamoush Foil Tray (serves 4)"],
  ["صينية قصدير مموش روبيان طري تكفي خمس اشخاص", "Tender Shrimp Mamoush Foil Tray (serves 5)"],
  ["صينية استيل مموش روبيان طري تكفي سبعة اشخاص", "Tender Shrimp Mamoush Steel Tray (serves 7)"],
  ["صينية قصدير مطبق سيباس تكفي شخصين", "Mutabbaq Seabass Foil Tray (serves 2)"],
  ["صينية قصدير مطبق سيباس تكفي ثلاث اشخاص", "Mutabbaq Seabass Foil Tray (serves 3)"],
  ["صينية قصدير مطبق سيباس تكفي اربع اشخاص", "Mutabbaq Seabass Foil Tray (serves 4)"],
  ["صينية قصدير مطبق سيباس تكفي خمس اشخاص", "Mutabbaq Seabass Foil Tray (serves 5)"],
  ["صينية استيل مطبق سيباس تكفي سبع اشخاص", "Mutabbaq Seabass Steel Tray (serves 7)"],
  ["ربع قوزي استرالي فخذ", "Quarter Australian Ghuzi (Leg)"],
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
  ["قوزي عربي", "Arabic Ghuzi"],
  ["طبخ قوازي", "Ghuzi Cooking Service"],
  ["طبخ دجاج من عند العميل", "Customer's Chicken Cooking"],
  ["طبخ سمك من عند العميل", "Customer's Fish Cooking"],
  ["طبخ روبيان من عند العميل", "Customer's Shrimp Cooking"],
  ["وجبات عمال", "Staff Meals"],
  ["أصناف مستوردة (كيتا - مراجعة)", "Imported Items"],
  ["صواني مجبوس الدجاج", "Chicken Majboos Trays"],
  ["صواني برياني اللحم", "Meat Biryani Trays"],
  ["صواني برياني الدجاج", "Chicken Biryani Trays"],
  ["صواني مموش روبيان يابس", "Dry Shrimp Mamoush Trays"],
  ["صينية مربين روبيان طري", "Murabbin Tender Shrimp Trays"],
  ["صينية مموش روبيان طري", "Tender Shrimp Mamoush Trays"],
  ["صواني مطبق سيباس", "Mutabbaq Seabass Trays"],
];
const CMAP = {};
for (const [a, e] of RAW_CATS) CMAP[norm(a)] = e;


// ترجمة الأوصاف العربية الحقيقية (مفتاح البحث: نص الوصف مطبّع)
const RAW_DESC = [
  ["اربع قطع من اللحم الاسترالي المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Four pieces of Australian meat cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["ست قطع من اللحم الاسترالي المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Six pieces of Australian meat cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["ثمان قطع من اللحم الاسترالي المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Eight pieces of Australian meat cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["عشر قطع من اللحم الاسترالي المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Ten pieces of Australian meat cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["اربعة عشر قطعة من اللحم الاسترالي المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Fourteen pieces of Australian meat cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["عشرون قطعة من اللحم الاسترالي المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Twenty pieces of Australian meat cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["قطعتين من الدجاج مقلية و المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Two pieces of fried chicken cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["ثلاث قطع من الدجاج مقلية و المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Three pieces of fried chicken cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["اربع قطع من الدجاج مقلية و المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Four pieces of fried chicken cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["خمس قطع من الدجاج مقلية و المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Five pieces of fried chicken cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["سبع قطع من الدجاج مقلية و المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Seven pieces of fried chicken cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["عشر قطع من الدجاج مقلية و المطبوخ بالطريقة الكويتية مع العيش البسمتي المحضر بالتوابل الشهية",
   "Ten pieces of fried chicken cooked the Kuwaiti way, served over basmati rice prepared with rich aromatic spices"],
  ["أرز البسمتي الفاخر مع نصف دجاجة مقلية و الحشو الكويتي بالإضافة إلى المرق أو الدقوس اختياري مع السرفيس",
   "Premium basmati rice with half a fried chicken and Kuwaiti stuffing, with your choice of broth or daqoos, served with sides"],
  ["قطع من الدجاج مع العظم مع الأرز الفاخر محضرة بالتوابل الشهية بالإضافة إلى المرق أو الدقوس اختياري مع السرفيس",
   "Bone-in chicken pieces with premium rice prepared with rich spices, with your choice of broth or daqoos, served with sides"],
  ["أرز البسمتي الفاخر مع الماش و الروبيان المجفف المحضر بطريقة شهية بالإضافة إلى الدقوس أو دقوس صبار مع السرفيس",
   "Premium basmati rice with mung beans and dried shrimp prepared to perfection, with daqoos or cactus daqoos, served with sides"],
  ["حبات من الروبيان حجم وسط تقدم مع الارز الفاخر و الحشو المتميز بالتوابل الخاصة بالاضافة الى الدقوس او دقوس صبار مع السيرفيس",
   "Medium-size shrimp served with premium rice and our signature stuffing seasoned with special spices, with daqoos or cactus daqoos, served with sides"],
  ["حبات من الروبيان حجم وسط يقدم مع الارز الفاخر و الماش و الحشو المتميز بالتوابل الخاصة بالاضافة الى الدقوس و دقوس صبار مع السرفيس",
   "Medium-size shrimp served with premium rice, mung beans and our signature stuffing seasoned with special spices, with daqoos and cactus daqoos, served with sides"],
  ["اثنين سمكة وسط محضرة بالتوابل الشهية مع الأرز الفاخر بالإضافة إلى الدقوس مع السرفيس",
   "Two medium seabass prepared with rich spices, served with premium rice and daqoos, plus sides"],
  ["ثلاث سمكات وسط محضرة بالتوابل الشهية مع الأرز الفاخر بالإضافة إلى الدقوس مع السرفيس",
   "Three medium seabass prepared with rich spices, served with premium rice and daqoos, plus sides"],
  ["اربع سمكات وسط محضرة بالتوابل الشهية مع الأرز الفاخر بالإضافة إلى الدقوس مع السرفيس",
   "Four medium seabass prepared with rich spices, served with premium rice and daqoos, plus sides"],
  ["خمس سمكات وسط محضرة بالتوابل الشهية مع الأرز الفاخر بالإضافة إلى الدقوس مع السرفيس",
   "Five medium seabass prepared with rich spices, served with premium rice and daqoos, plus sides"],
  ["سبع سمكات وسط محضرة بالتوابل الشهية مع الأرز الفاخر بالإضافة إلى الدقوس مع السرفيس",
   "Seven medium seabass prepared with rich spices, served with premium rice and daqoos, plus sides"],
];
const DESC_TR = {};
for (const [a, e] of RAW_DESC) DESC_TR[norm(a)] = e;

// أسماء مجموعات الاختيارات واختياراتها بالإنجليزية.
// الاختيارات كانت تُحفَظ بالعربية وحدها، فتظهر عربية على المنيو الإنجليزي وعلى
// الفاتورة. المفتاح هنا مطبّع، فالفروق في الهمزة والتاء المربوطة والمسافة
// الزائدة («حشو خارجي » بمسافة في آخرها) تُطابَق كلها على نفس المدخل.
const RAW_OPT_GROUPS = [
  ["اختيارات الوجبة", "Meal Options"],
  ["اختيارك من الحشو", "Choose Your Stuffing"],
  ["المرق", "Broth"],
  ["الحشو", "Stuffing"],
  ["الدقوس", "Daqoos"],
  ["اختيار", "Choice"],
];
const RAW_OPT_CHOICES = [
  ["مرق بامية مع بطاط", "Okra & Potato Stew"],
  ["مرق بطاط مع بامية", "Potato & Okra Stew"],
  ["مرق و دقوس", "Broth & Daqoos"],
  ["دقوس", "Daqoos"],
  ["دقوس طماط", "Tomato Daqoos"],
  ["دقوس صبار", "Cactus Daqoos"],
  ["بدون حشو", "No Stuffing"],
  ["حشو خارجي", "Stuffing on the Side"],
];
const OGMAP = {};
for (const [a, e] of RAW_OPT_GROUPS) OGMAP[norm(a)] = e;
const OCMAP = {};
for (const [a, e] of RAW_OPT_CHOICES) OCMAP[norm(a)] = e;

// أسماء مناطق الكويت بالإنجليزية — تُستخدم على المنيو الإنجليزي وعلى الفاتورة،
// فالسائق الذي لا يقرأ العربية يعرف الوجهة من الورقة نفسها.
const RAW_AREAS = [
  ["الفردوس", "Firdous"],
  ["الشرق", "Sharq"],
  ["المرقاب", "Mirqab"],
  ["القبلة", "Qibla"],
  ["الدسمة", "Dasma"],
  ["الدعية", "Daiya"],
  ["المنصورية", "Mansouriya"],
  ["الفيحاء", "Faiha"],
  ["الشامية", "Shamiya"],
  ["الروضة", "Rawda"],
  ["العديلية", "Adailiya"],
  ["الخالدية", "Khaldiya"],
  ["قرطبة", "Qortuba"],
  ["السرة", "Surra"],
  ["اليرموك", "Yarmouk"],
  ["الشويخ", "Shuwaikh"],
  ["كيفان", "Kaifan"],
  ["النزهة", "Nuzha"],
  ["عبدالله السالم", "Abdullah Al-Salem"],
  ["الدوحة", "Doha"],
  ["النهضة", "Nahda"],
  ["غرناطة", "Granada"],
  ["الصليبخات", "Sulaibikhat"],
  ["جابر الأحمد", "Jaber Al-Ahmad"],
  ["الصوابر", "Sawaber"],
  ["ضاحية عبدالله السالم", "Abdullah Al-Salem Suburb"],
  ["حولي", "Hawally"],
  ["السالمية", "Salmiya"],
  ["الرميثية", "Rumaithiya"],
  ["الجابرية", "Jabriya"],
  ["مشرف", "Mishref"],
  ["بيان", "Bayan"],
  ["سلوى", "Salwa"],
  ["البدع", "Bidaa"],
  ["النقرة", "Nugra"],
  ["حطين", "Hitteen"],
  ["الشعب", "Shaab"],
  ["السلام", "Salam"],
  ["الزهراء", "Zahra"],
  ["الصديق", "Siddeeq"],
  ["الشهداء", "Shuhada"],
  ["الصالحية", "Salhiya"],
  ["الفروانية", "Farwaniya"],
  ["خيطان", "Khaitan"],
  ["العمرية", "Omariya"],
  ["الرابية", "Rabiya"],
  ["الأندلس", "Andalous"],
  ["جليب الشيوخ", "Jleeb Al-Shuyoukh"],
  ["الرقعي", "Riggae"],
  ["العارضية", "Ardiya"],
  ["صباح الناصر", "Sabah Al-Nasser"],
  ["إشبيلية", "Ishbiliya"],
  ["الرحاب", "Rehab"],
  ["الضجيج", "Dhajeej"],
  ["عبدالله المبارك", "Abdullah Al-Mubarak"],
  ["الري", "Rai"],
  ["جنوب عبدالله المبارك", "South Abdullah Al-Mubarak"],
  ["الأحمدي", "Ahmadi"],
  ["الفحيحيل", "Fahaheel"],
  ["المنقف", "Mangaf"],
  ["أبو حليفة", "Abu Halifa"],
  ["المهبولة", "Mahboula"],
  ["الفنطاس", "Fintas"],
  ["العقيلة", "Egaila"],
  ["الصباحية", "Sabahiya"],
  ["الرقة", "Riqqa"],
  ["هدية", "Hadiya"],
  ["جابر العلي", "Jaber Al-Ali"],
  ["فهد الأحمد", "Fahad Al-Ahmad"],
  ["الظهر", "Dhaher"],
  ["سعد العبدالله", "Saad Al-Abdullah"],
  ["القيروان", "Qairawan"],
  ["مبارك الكبير", "Mubarak Al-Kabeer"],
  ["أبو فطيرة", "Abu Ftaira"],
  ["العدان", "Adan"],
  ["القصور", "Qusour"],
  ["صباح السالم", "Sabah Al-Salem"],
  ["المسيلة", "Messila"],
  ["المسايل", "Masayel"],
  ["الفنيطيس", "Funaitees"],
  ["صبحان", "Subhan"],
  ["القرين", "Qurain"],
];
const AMAP = {};
for (const [a, e] of RAW_AREAS) AMAP[norm(a)] = e;
function areaEn(nm){ return AMAP[norm(nm)] || ""; }

// يطبّق التنظيف على بيانات المنيو (in-place) ويرجّع تقرير
function applyI18nFix(data){
  const rep={cats:[],fromDesc:[],fromQonsole:[],fixedExisting:[],alreadyOk:0,stillMissing:[],descTranslated:[],descMissing:[],catMissing:[],opts:[],optsMissing:[]};
  for(const a of ((data.settings&&data.settings.areas)||[])){
    if(a && a.name && !a.nameEn){ const m=areaEn(a.name); if(m)a.nameEn=m; else rep.optsMissing.push("area:"+a.name); }
  }
  for(const c of (data.menu||[])){
    if(!c.catEn){const m=CMAP[norm(c.cat)];if(m){c.catEn=m;rep.cats.push({ar:c.cat,en:m});}else rep.catMissing.push(c.cat);}
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
      // ترجمة الوصف العربي الحقيقي للنسخة الإنجليزية
      if(it.desc && !latinOnly(it.desc) && !it.descEn){
        const t=DESC_TR[norm(it.desc)];
        if(t){it.descEn=t;rep.descTranslated.push({ar:it.name,en:t});}
        else rep.descMissing.push({item:it.name,desc:it.desc});
      }
      // مجموعات الاختيارات واختياراتها
      for(const g of (it.options||[])){
        if(g && g.label && !g.labelEn){
          const m=OGMAP[norm(g.label)];
          if(m){g.labelEn=m;rep.opts.push({ar:g.label,en:m});}
          else rep.optsMissing.push(g.label);
        }
        const chs=(g&&g.choices)||[];
        for(let i=0;i<chs.length;i++){
          const ch=chs[i];
          // الاختيار المحفوظ كنص وحده لا يتّسع لاسم إنجليزي، فنحوّله لكائن أولاً
          if(typeof ch==='string'){ chs[i]={name:ch,price:0}; }
          const c=chs[i];
          if(!c || !c.name || c.nameEn) continue;
          const m=OCMAP[norm(c.name)];
          if(m){c.nameEn=m;rep.opts.push({ar:c.name,en:m});}
          else rep.optsMissing.push(c.name);
        }
      }
    }
  }
  return rep;
}
const I18N_FIX_V = 5; // زوّد الرقم مع أي تحسين للقاموس عشان يتطبق تلقائياً
module.exports={norm,latinOnly,fixEn,PMAP,CMAP,DESC_TR,OGMAP,OCMAP,AMAP,areaEn,applyI18nFix,I18N_FIX_V};
