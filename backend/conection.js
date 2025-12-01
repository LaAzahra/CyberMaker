import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Teste automático de conexão ao iniciar
pool.getConnection()
  .then(conn => {
    console.log("✅ MySQL conectado com sucesso");
    conn.release();
  })
  .catch(err => {
    console.error("❌ Erro MySQL:", err.message);
  });

export default pool;
