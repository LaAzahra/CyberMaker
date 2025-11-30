import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Health route for Railway
app.get("/", (req, res) => res.send("OK"));

app.use(express.json());
app.use(cors());
app.use(cors());
app.use(express.json({ limit: "10mb" })); // allow image uploads as base64

// 🔧 Configuração do banco de dados
// Se DB_POST existir, usa ele (Railway); senão usa as variáveis locais
let pool;

if (process.env.DB_POST) {
  console.log("🌍 Usando variável DB_POST para conexão ao banco do Railway!");

  try {
    const dbUrl = new URL(process.env.DB_POST);

    pool = mysql.createPool({
      host: dbUrl.hostname,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.replace("/", ""),
      port: Number(dbUrl.port) || 51980,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  } catch (err) {
    console.error("❌ Erro ao interpretar DB_POST:", err);
  }
} else {
  console.log("💻 Usando variáveis locais para conexão ao banco!");

  const DB_HOST = process.env.DB_HOST || "localhost";
  const DB_USER = process.env.DB_USER || "root";
  const DB_PASSWORD = process.env.DB_PASSWORD || "Automata";
  const DB_NAME = process.env.DB_NAME || "CyberMaker";

  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: 51980,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

// Porta do servidor HTTP (não confundir com a porta do banco)
const PORT = process.env.PORT || 3000;

// Serve static frontend (the site files)
app.use(express.static(path.join(__dirname)));

app.get("/api/ping", (req, res) => res.json({ ok: true }));

// Register user
app.post("/api/registrar", async (req, res) => {
  try {
    const { nome, email, senha, foto } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ success: false, error: "Faltando campos" });

    const [rows] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (rows.length > 0) return res.status(400).json({ success: false, error: "Email já cadastrado" });

    const hash = await bcrypt.hash(senha, 10);
    const fotoVal = foto || null;
    const [result] = await pool.query(
      "INSERT INTO usuarios (nome, email, senha, foto, pontos, online) VALUES (?, ?, ?, ?, 0, FALSE)",
      [nome, email, hash, fotoVal]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ success: false, error: "Faltando campos" });

    const [rows] = await pool.query("SELECT id, nome, email, senha, foto, pontos FROM usuarios WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(400).json({ success: false, error: "Usuário não encontrado" });

    const user = rows[0];
    const match = await bcrypt.compare(senha, user.senha);
    if (!match) return res.status(401).json({ success: false, error: "Senha incorreta" });

    delete user.senha;
    res.json({ success: true, usuario: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// Mark online
app.post("/api/usuarios/online", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    if (!usuario_id) return res.status(400).json({ success: false, error: "ID ausente" });
    await pool.query("UPDATE usuarios SET online = TRUE WHERE id = ?", [usuario_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// Mark offline
app.post("/api/usuarios/offline", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    if (!usuario_id) return res.status(400).json({ success: false, error: "ID ausente" });
    await pool.query("UPDATE usuarios SET online = FALSE WHERE id = ?", [usuario_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// Ranking
app.get("/api/ranking", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nome, foto, pontos FROM usuarios ORDER BY pontos DESC LIMIT 100");
    res.json({ success: true, ranking: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

// ROTA: adicionar pontos ao concluir uma tarefa
app.post("/api/concluir", async (req, res) => {
  try {
    const { usuario_id } = req.body;
    if (!usuario_id) return res.status(400).json({ success: false, error: "ID ausente" });

    // Garante que pontos não sejam NULL e soma 1000
    const sqlUpdate = `
      UPDATE usuarios
      SET pontos = COALESCE(pontos, 0) + 1000
      WHERE id = ?
    `;
    const [result] = await pool.query(sqlUpdate, [usuario_id]);

    // Opcional: verifica se a linha foi alterada
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Usuário não encontrado" });
    }

    // Retorna o usuário atualizado (id, nome, pontos)
    const [rows] = await pool.query("SELECT id, nome, pontos, foto FROM usuarios WHERE id = ?", [usuario_id]);
    const usuario = rows[0] || null;

    res.json({ success: true, usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});


// Ideas (diário / arena)
app.get("/api/ideias", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM ideias ORDER BY id DESC LIMIT 200");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

app.get("/api/ideias/:usuario_id", async (req, res) => {
  try {
    const usuario_id = req.params.usuario_id;
    const [rows] = await pool.query("SELECT * FROM ideias WHERE usuario_id = ? ORDER BY id DESC", [usuario_id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

app.post("/api/ideias", async (req, res) => {
  try {
    const { usuario_id, titulo, texto } = req.body;
    if (!usuario_id || !titulo) return res.status(400).json({ success: false, error: "Faltando campos" });
    const [result] = await pool.query("INSERT INTO ideias (usuario_id, titulo, texto, created_at) VALUES (?, ?, ?, NOW())", [usuario_id, titulo, texto || ""]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

//histórico de conclusões
app.get("/api/historico", async (req, res) => {
  try {
    const [dados] = await db.execute(
      "SELECT * FROM conclusoes ORDER BY data DESC"
    );
    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Falha ao buscar histórico" });
  }
});


// Fallback para index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando na porta", PORT);
});


// Salvar conclusão da arena
app.post("/api/conclusoes", async (req, res) => {
  try {
    const { ideia, video, imagem, descrição } = req.body;

    if (!ideia || !video || !imagem || !descrição) {
      return res.status(400).json({ success: false, error: "Campos incompletos" });
    }

    const [result] = await pool.query(
      "INSERT INTO conclusoes (ideia, video, imagem, descrição, data) VALUES (?, ?, ?, ?, NOW())",
      [ideia, video, imagem, descrição]
    );

    res.json({ success: true, id: result.insertId });

  } catch (err) {
    console.error("Erro ao salvar conclusão:", err);
    res.status(500).json({ success: false, error: "Erro interno no servidor" });
  }
});
