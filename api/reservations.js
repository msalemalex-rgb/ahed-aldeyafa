// /api/reservations — POST: إنشاء حجز | GET: قائمة (أدمن) | PATCH: تحديث الحالة (أدمن)
const { addReservation, listReservations, cmd } = require("../lib/kv");

function readBody(req){
  if(req.body&&typeof req.body==="object")return Promise.resolve(req.body);
  if(typeof req.body==="string"){try{return Promise.resolve(JSON.parse(req.body||"{}"));}catch{return Promise.resolve({});}}
  return new Promise(r=>{let d="";req.on("data",c=>d+=c);req.on("end",()=>{try{r(JSON.parse(d||"{}"));}catch{r({});}});});
}
function isAdmin(req){const k=(req.query&&req.query.key)||req.headers["x-admin-key"];return process.env.ADMIN_PASSWORD&&k===process.env.ADMIN_PASSWORD;}

module.exports = async (req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, x-admin-key");
  if(req.method==="OPTIONS")return res.status(200).end();
  try{
    if(req.method==="POST"){
      const b=await readBody(req);
      if(!b.name||!b.date)return res.status(400).json({error:"missing name/date"});
      const r=await addReservation({name:b.name,phone:b.phone||"",type:b.type||"",count:b.count||"",date:b.date,time:b.time||"",notes:b.notes||""});
      return res.status(200).json({ok:true,id:r.id});
    }
    if(req.method==="GET"){
      if(!isAdmin(req))return res.status(401).json({error:"unauthorized"});
      return res.status(200).json({reservations:await listReservations(300)});
    }
    if(req.method==="PATCH"){
      if(!isAdmin(req))return res.status(401).json({error:"unauthorized"});
      const b=await readBody(req);
      const s=await cmd(["GET","rsv:"+b.id]);
      if(s){const o=JSON.parse(s);o.status=b.status;await cmd(["SET","rsv:"+b.id,JSON.stringify(o)]);return res.status(200).json({ok:true,reservation:o});}
      return res.status(404).json({error:"not found"});
    }
    return res.status(405).json({error:"method"});
  }catch(e){return res.status(500).json({error:e.message});}
};
