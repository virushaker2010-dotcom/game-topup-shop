const express = require("express");
const helmet = require("helmet");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

function admin(req,res,next){
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return res.status(401).set("WWW-Authenticate",'Basic realm="Admin"').json({error:"Unauthorized"});
  const decoded = Buffer.from(h.slice(6),"base64").toString();
  const i = decoded.indexOf(":");
  if (i < 0 || decoded.slice(0,i) !== ADMIN_USER || decoded.slice(i+1) !== ADMIN_PASSWORD)
    return res.status(401).set("WWW-Authenticate",'Basic realm="Admin"').json({error:"Unauthorized"});
  next();
}

app.get("/api/products", (req,res)=>{
  const game = req.query.game;
  const rows = game
    ? db.prepare("SELECT * FROM products WHERE active=1 AND game=? ORDER BY price").all(game)
    : db.prepare("SELECT * FROM products WHERE active=1 ORDER BY game, price").all();
  res.json(rows);
});

app.post("/api/orders", (req,res)=>{
  const {game, productId, playerId, customerName, customerPhone, paymentMethod} = req.body || {};
  if (!game || !productId || !playerId || !paymentMethod) return res.status(400).json({error:"بيانات الطلب غير مكتملة"});
  if (!["PUBG MOBILE","Free Fire"].includes(game)) return res.status(400).json({error:"لعبة غير صحيحة"});
  const p = db.prepare("SELECT * FROM products WHERE id=? AND game=? AND active=1").get(productId,game);
  if (!p) return res.status(400).json({error:"الباقة غير متاحة"});
  if (String(playerId).length > 100) return res.status(400).json({error:"Player ID غير صحيح"});
  const r = db.prepare(`INSERT INTO orders(game,product_id,product_name,price,player_id,customer_name,customer_phone,payment_method)
    VALUES (?,?,?,?,?,?,?,?)`).run(game,p.id,p.name,p.price,String(playerId).trim(),customerName||"",customerPhone||"",paymentMethod);
  res.json({ok:true, orderId:r.lastInsertRowid, status:"pending", message:"تم إنشاء الطلب. أكمل الدفع ثم راجع حالة الطلب."});
});

app.get("/api/orders/:id", (req,res)=>{
  const row = db.prepare("SELECT id,game,product_name,price,player_id,payment_method,status,created_at FROM orders WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({error:"الطلب غير موجود"});
  res.json(row);
});

app.get("/api/admin/orders", admin, (req,res)=>{
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 500").all());
});
app.get("/api/admin/products", admin, (req,res)=>{
  res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all());
});
app.post("/api/admin/products", admin, (req,res)=>{
  const {game,name,amount,price} = req.body || {};
  if (!game || !name || !amount || !Number.isInteger(Number(price))) return res.status(400).json({error:"بيانات الباقة غير صحيحة"});
  const r=db.prepare("INSERT INTO products(game,name,amount,price) VALUES(?,?,?,?)").run(game,name,amount,Number(price));
  res.json({ok:true,id:r.lastInsertRowid});
});
app.patch("/api/admin/products/:id", admin, (req,res)=>{
  const {name,amount,price,active} = req.body || {};
  db.prepare("UPDATE products SET name=COALESCE(?,name), amount=COALESCE(?,amount), price=COALESCE(?,price), active=COALESCE(?,active) WHERE id=?")
    .run(name,amount,price==null?null:Number(price),active==null?null:Number(active),req.params.id);
  res.json({ok:true});
});
app.patch("/api/admin/orders/:id", admin, (req,res)=>{
  const allowed=["pending","paid","processing","completed","failed","cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({error:"حالة غير صحيحة"});
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
  res.json({ok:true});
});

app.listen(PORT,()=>console.log(`Game TopUp running on http://localhost:${PORT}`));
