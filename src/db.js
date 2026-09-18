const Database = require("better-sqlite3");
const db = new Database(process.env.DB_FILE || "data/shop.db");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  name TEXT NOT NULL,
  amount TEXT NOT NULL,
  price INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

const count = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
if (!count) {
  const ins = db.prepare("INSERT INTO products (game,name,amount,price) VALUES (?,?,?,?)");
  const seed = db.transaction(() => {
    [
      ["PUBG MOBILE","60 UC","60 UC",55],
      ["PUBG MOBILE","325 UC","325 UC",250],
      ["PUBG MOBILE","660 UC","660 UC",490],
      ["Free Fire","100 Diamonds","100 Diamonds",45],
      ["Free Fire","310 Diamonds","310 Diamonds",125],
      ["Free Fire","520 Diamonds","520 Diamonds",195]
    ].forEach(x => ins.run(...x));
  });
  seed();
}
module.exports = db;
