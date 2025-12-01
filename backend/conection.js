import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT)
});

pool.getConnection()
  .then(() => console.log("✅ MySQL conectado"))
  .catch(err => console.error("❌ Erro MySQL:", err.message));

export default pool;
