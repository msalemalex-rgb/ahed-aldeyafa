// /api/menu — GET: يرجّع المنيو والإعدادات (يزرع الافتراضي أول مرة) | POST: تحديث (أدمن)
const { cmd } = require("../lib/kv");

const IMG = (u) => `https://images.unsplash.com/${u}?w=700&q=80&auto=format&fit=crop`;

const DEFAULT_DATA = {
  settings: { whatsapp: "96566348608", currency: "د.ك", directDiscount: 0.10, logo: "" },
  menu: [
    {cat:"المجبوس والبرياني", items:[
      {id:1, name:"مجبوس لحم استرالي", desc:"Australian Meat Majboos", price:4.500, img:IMG("photo-1631292784640-2b24be784d5d")},
      {id:2, name:"مجبوس لحم عربي", desc:"Arabic Meat Majboos", price:6.000, img:IMG("photo-1547928576-b822bc410bdf")},
      {id:3, name:"مجبوس دجاج", desc:"Chicken Majboos", price:2.750, img:IMG("photo-1633945274405-b6c8069047b0")},
      {id:4, name:"برياني لحم استرالي", desc:"Australian Meat Biryani", price:4.750, img:IMG("photo-1631292784640-2b24be784d5d")},
      {id:5, name:"برياني دجاج", desc:"Chicken Biryani", price:3.000, img:IMG("photo-1633945274405-b6c8069047b0")},
    ]},
    {cat:"المطبق والروبيان", items:[
      {id:6, name:"مطبق زبيدي", desc:"Mutabbaq Zubaidi", price:4.750, img:IMG("photo-1604908176997-125f25cc6f3d")},
      {id:7, name:"مطبق زبيدي ملكي", desc:"Mutabbaq Zubaidi Royal", price:6.250, img:IMG("photo-1604908176997-125f25cc6f3d")},
      {id:8, name:"مطبق سيباس", desc:"Mutabbaq Seabas", price:4.500, img:IMG("photo-1535140728325-a4d3707eee61")},
      {id:9, name:"مطبق سيباس ملكي", desc:"Mutabbaq Seabas Royal", price:6.000, img:IMG("photo-1535140728325-a4d3707eee61")},
      {id:10, name:"مربين روبيان طري", desc:"Tender Shrimp", price:4.250, img:IMG("photo-1574484284002-952d92456975")},
      {id:11, name:"مموش روبيان يابس", desc:"Mamoush Dry Shrimp", price:3.250, img:IMG("photo-1565299624946-b28f40a0ae38")},
      {id:12, name:"مموش روبيان طري", desc:"Mamoush Tender Shrimp", price:4.500, img:IMG("photo-1574484284002-952d92456975")},
    ]},
    {cat:"التشاريب والأطباق الشعبية", items:[
      {id:13, name:"تشريب لحم استرالي", desc:"Australian Meat Impregnation", price:3.250, img:IMG("photo-1455619452474-d2be8b1e70cd")},
      {id:14, name:"تشريب بدون لحم", desc:"Impregnation without Meat", price:1.500, img:IMG("photo-1547592166-23ac45744acd")},
      {id:15, name:"قبوط لحم", desc:"Meat Qaboot", price:3.250, img:IMG("photo-1596797038530-2c107229654b")},
      {id:16, name:"مرقوق خضار", desc:"Vegetable Margog", price:1.750, img:IMG("photo-1547592166-23ac45744acd")},
      {id:17, name:"مشخول / عيش + مرق لحم", desc:"Mashkoul / Rice + Meat Broth", price:3.750, img:IMG("photo-1565958011703-44f9829ba187")},
      {id:18, name:"معكرونة الطيبين باللحم", desc:"Taybeen Macaroni with Meat", price:2.250, img:IMG("photo-1621996346565-e3dbc646d9a9")},
      {id:19, name:"كبه برغل باللحم (٦ قطع)", desc:"Meat Bulgur Kibbeh (6 pcs)", price:1.750, img:IMG("photo-1625944525533-473f1a3d54e7")},
      {id:20, name:"كبه بطاطا باللحم (٦ قطع)", desc:"Meat Potato Kibbeh (6 pcs)", price:2.000, img:IMG("photo-1625944525533-473f1a3d54e7")},
      {id:21, name:"الهريس", desc:"Groats (Hareis)", price:1.750, img:IMG("photo-1455619452474-d2be8b1e70cd")},
      {id:22, name:"الجريش", desc:"Jerish", price:1.750, img:IMG("photo-1565958011703-44f9829ba187")},
    ]},
    {cat:"السلطات", items:[
      {id:23, name:"سلطة خضار", desc:"Vegetable Salad", price:1.250, img:IMG("photo-1512621776951-a57141f2eefd")},
      {id:24, name:"سلطة جرجير", desc:"Arugula Salad", price:1.250, img:IMG("photo-1540420773420-3366772f4999")},
      {id:25, name:"روب خيار", desc:"Rob & Cucumber", price:1.000, img:IMG("photo-1488477181946-6428a0291777")},
      {id:26, name:"سلطة شمندر", desc:"Beetroot Salad", price:1.250, img:IMG("photo-1546069901-ba9599a7e63c")},
      {id:27, name:"سلطة جرجير وشمندر", desc:"Arugula & Beetroot Salad", price:1.500, img:IMG("photo-1512621776951-a57141f2eefd")},
    ]},
    {cat:"الشوربات", items:[
      {id:28, name:"شوربة عدس", desc:"Lentil Soup", price:1.000, img:IMG("photo-1547592166-23ac45744acd")},
      {id:29, name:"شوربة دجاج", desc:"Chicken Soup", price:1.000, img:IMG("photo-1604908176997-125f25cc6f3d")},
    ]},
    {cat:"الإضافات", items:[
      {id:30, name:"دبل لحم عربي", desc:"Arabic Double Meat", price:4.750, img:IMG("photo-1547928576-b822bc410bdf")},
      {id:31, name:"دبل دجاج", desc:"Chicken Double", price:1.750, img:IMG("photo-1633945274405-b6c8069047b0")},
      {id:32, name:"دبل روبيان طري", desc:"Soft Shrimp Double", price:3.250, img:IMG("photo-1574484284002-952d92456975")},
      {id:33, name:"دبل روبيان يابس", desc:"Double Dry Shrimp", price:2.250, img:IMG("photo-1565299624946-b28f40a0ae38")},
      {id:34, name:"دبل زبيدي / سيباس", desc:"Double Seabas / Zubaidi", price:3.750, img:IMG("photo-1535140728325-a4d3707eee61")},
      {id:35, name:"دبل لحم استرالي", desc:"Australian Double Meat", price:3.250, img:IMG("photo-1547928576-b822bc410bdf")},
      {id:36, name:"عيش مجبوس خالي", desc:"Empty Mahboos Rice", price:1.000, img:IMG("photo-1516684732162-798a0062be99")},
      {id:37, name:"عيش سمك / روبيان خالي", desc:"Empty Fish/Shrimp Rice", price:1.000, img:IMG("photo-1516684732162-798a0062be99")},
      {id:38, name:"عيش مموش خالي", desc:"Empty Mamoush Rice", price:1.250, img:IMG("photo-1516684732162-798a0062be99")},
      {id:39, name:"مرق / دقوس / دقوس صبار", desc:"Broth / Dakus", price:0.250, img:IMG("photo-1455619452474-d2be8b1e70cd")},
    ]},
    {cat:"الحلويات", items:[
      {id:40, name:"كريم كراميل", desc:"Creme Caramel", price:0.500, img:IMG("photo-1488477181946-6428a0291777")},
      {id:41, name:"مهلبية", desc:"Pudding", price:0.500, img:IMG("photo-1488477181946-6428a0291777")},
      {id:42, name:"جيلي", desc:"Jelly", price:0.500, img:IMG("photo-1551024601-bec78aea704b")},
    ]},
    {cat:"العصائر والمشروبات", items:[
      {id:43, name:"عصير برتقال / ليمون", desc:"Orange / Lemon Juice", price:1.000, img:IMG("photo-1600271886742-f049cd451bba")},
      {id:44, name:"عصير ليمون ونعناع", desc:"Lemon & Mint Juice", price:1.000, img:IMG("photo-1622597467836-f3285f2131b8")},
      {id:45, name:"مشروب غازي", desc:"Soft Drink", price:0.150, img:IMG("photo-1581636625402-29b2a704ef13")},
      {id:46, name:"لبن فرش", desc:"Fresh Laban", price:0.150, img:IMG("photo-1563636619-e9143da7973b")},
      {id:47, name:"لبن اكتيفيا", desc:"Activia Laban", price:0.200, img:IMG("photo-1563636619-e9143da7973b")},
      {id:48, name:"روب", desc:"Yogurt", price:0.200, img:IMG("photo-1488477181946-6428a0291777")},
      {id:49, name:"ماء صحة صغير", desc:"Small Water", price:0.200, img:IMG("photo-1523362628745-0c100150b504")},
    ]},
  ],
};

function readBody(req){
  if(req.body&&typeof req.body==="object")return Promise.resolve(req.body);
  if(typeof req.body==="string"){try{return Promise.resolve(JSON.parse(req.body||"{}"));}catch{return Promise.resolve({});}}
  return new Promise(r=>{let d="";req.on("data",c=>d+=c);req.on("end",()=>{try{r(JSON.parse(d||"{}"));}catch{r({});}});});
}
function isAdmin(req){const k=(req.query&&req.query.key)||req.headers["x-admin-key"];return process.env.ADMIN_PASSWORD&&k===process.env.ADMIN_PASSWORD;}

module.exports = async (req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, x-admin-key");
  if(req.method==="OPTIONS")return res.status(200).end();
  try{
    if(req.method==="GET"){
      let raw=await cmd(["GET","menu_data"]);
      if(!raw){ await cmd(["SET","menu_data",JSON.stringify(DEFAULT_DATA)]); raw=JSON.stringify(DEFAULT_DATA); }
      res.setHeader("Cache-Control","no-store");
      return res.status(200).json(JSON.parse(raw));
    }
    if(req.method==="POST"){
      if(!isAdmin(req))return res.status(401).json({error:"unauthorized"});
      const b=await readBody(req);
      const cur = JSON.parse((await cmd(["GET","menu_data"]))||JSON.stringify(DEFAULT_DATA));
      const next = { menu: b.menu||cur.menu, settings: Object.assign({},cur.settings,b.settings||{}) };
      await cmd(["SET","menu_data",JSON.stringify(next)]);
      return res.status(200).json({ok:true});
    }
    return res.status(405).json({error:"method"});
  }catch(e){return res.status(500).json({error:e.message});}
};
