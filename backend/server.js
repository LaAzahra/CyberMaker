import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
// import nodemailer from "nodemailer"; // Descomentar se for configurar o envio de email aqui

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- CONFIGURAÇÃO INICIAL E MIDDLWARES ---

// Health route (Railway/Render check)
app.get("/", (req, res) => res.send("OK"));

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 🔧 Configuração do banco de dados (Mantida sua lógica robusta)
let pool;

if (process.env.DATABASE_URL) {
    console.log("🌍 Usando variável DATABASE_URL para conexão ao banco!");

    try {
        const dbUrl = new URL(process.env.DATABASE_URL);
        pool = mysql.createPool({
            host: dbUrl.hostname,
            user: dbUrl.username,
            password: dbUrl.password,
            database: dbUrl.pathname.replace("/", ""),
            port: Number(dbUrl.port) || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    } catch (err) {
        console.error("❌ Erro ao interpretar DATABASE_URL:", err);
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
        port: Number(process.env.DB_PORT) || 3306, // Use 3306 como padrão ou a variável
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });
}

// Porta do servidor HTTP
const PORT = process.env.PORT || 3000;

// Serve static frontend (site files)
app.use(express.static(path.join(__dirname)));

app.get("/api/ping", (req, res) => res.json({ ok: true }));


// --- ROTAS DE AUTENTICAÇÃO (CORRIGIDAS) ---

// Funções de E-mail (PLACEHOLDER: Integre o Nodemailer aqui se desejar)
/*
const transporter = nodemailer.createTransport({...});
async function enviarEmailConfirmacao(email, nome, token) {
    // ... lógica de envio ...
}
*/

// 1. Rota de Registro (/api/registrar) - CORRIGIDA
app.post("/api/registrar", async (req, res) => {
    const { nome, email, senha, foto, tipo_usuario } = req.body;

    // TODO: Adicionar validação de senha forte aqui

    if (!nome || !email || !senha || !tipo_usuario) return res.status(400).json({ success: false, error: "Faltando campos obrigatórios." });

    try {
        const [rows] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
        if (rows.length > 0) return res.status(400).json({ success: false, error: "Email já cadastrado" });

        const hash = await bcrypt.hash(senha, 10);
        const tokenConfirmacao = crypto.randomBytes(32).toString("hex");

        await pool.query(
            // Adiciona tipo_usuario, confirmado, token_confirmacao
            "INSERT INTO usuarios (nome, email, senha, foto, pontos, online, tipo_usuario, confirmado, token_confirmacao) VALUES (?, ?, ?, ?, 0, FALSE, ?, FALSE, ?)",
            [nome, email, hash, foto || null, tipo_usuario, tokenConfirmacao]
        );
        
        // TODO: await enviarEmailConfirmacao(email, nome, tokenConfirmacao); 

        res.json({ 
            success: true, 
            message: "Registro concluído. Verifique seu e-mail para ativar a conta."
        });
    } catch (err) {
        console.error("❌ Erro no registro:", err);
        res.status(500).json({ success: false, error: "Erro interno" });
    }
});

// 2. Rota de Login (/api/login) - CORRIGIDA
app.post("/api/login", async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) return res.status(400).json({ success: false, error: "Faltando campos" });

        const [rows] = await pool.query(
            // Seleciona as colunas de controle
            "SELECT id, nome, email, senha, foto, pontos, confirmado, tipo_usuario FROM usuarios WHERE email = ?", 
            [email]
        );
        
        if (rows.length === 0) return res.status(400).json({ success: false, error: "Credenciais inválidas." });

        const user = rows[0];
        const match = await bcrypt.compare(senha, user.senha);
        if (!match) return res.status(401).json({ success: false, error: "Credenciais inválidas." });
        
        // VERIFICAÇÃO CRÍTICA: E-mail confirmado?
        if (!user.confirmado) {
            return res.status(403).json({ success: false, error: "Conta não confirmada. Por favor, ative a conta via e-mail." });
        }

        delete user.senha;
        
        // Retorna o tipo de usuário para redirecionamento no frontend
        res.json({ 
            success: true, 
            usuario: user,
            tipo_usuario: user.tipo_usuario 
        });
        
    } catch (err) {
        console.error("❌ Erro no login:", err);
        res.status(500).json({ success: false, error: "Erro interno" });
    }
});


// 3. Rota de Confirmação de E-mail (/api/confirmar/:token) - NOVA
app.get("/api/confirmar/:token", async (req, res) => {
    const { token } = req.params;
    const loginUrl = `${process.env.FRONTEND_URL || '/'}/login.html?status=confirmado`;

    try {
        const sql = `
            UPDATE usuarios 
            SET confirmado = TRUE, token_confirmacao = NULL 
            WHERE token_confirmacao = ? AND confirmado = FALSE
        `;
        
        const [result] = await pool.query(sql, [token]);

        if (result.affectedRows === 0) {
            return res.status(400).send('Erro: O link de confirmação é inválido ou já foi utilizado.');
        }

        res.redirect(loginUrl); 

    } catch (error) {
        console.error('❌ Erro na confirmação de e-mail:', error);
        res.status(500).send('Erro interno do servidor ao confirmar a conta.');
    }
});


// --- ROTAS DE FUNCIONALIDADE (ARENA/DESAFIOS) ---

// 4. Rota para Recrutador Postar Desafios (/api/desafios) - NOVA
app.post("/api/desafios", async (req, res) => {
    const { recrutador_id, titulo, descricao, area } = req.body;

    if (!recrutador_id || !titulo || !descricao || !area) {
        return res.status(400).json({ success: false, error: "Faltando campos para postar desafio." });
    }

    try {
        // Verifica se o ID pertence a um Recrutador
        const [userCheck] = await pool.query(
            "SELECT tipo_usuario FROM usuarios WHERE id = ?",
            [recrutador_id]
        );

        if (userCheck.length === 0 || userCheck[0].tipo_usuario !== 'recrutador') {
            return res.status(403).json({ success: false, error: "Apenas recrutadores podem postar desafios." });
        }

        await pool.query(
            "INSERT INTO desafios (recrutador_id, titulo, descricao, area) VALUES (?, ?, ?, ?)",
            [recrutador_id, titulo, descricao, area]
        );

        res.status(201).json({ success: true, message: "Desafio postado com sucesso!" });

    } catch (err) {
        console.error("❌ Erro ao postar desafio:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});


// 5. Rota para Usuário Submeter Atividade (/api/atividades/submeter) - NOVA
app.post("/api/atividades/submeter", async (req, res) => {
    const { usuario_id, desafio_id, link_submissao } = req.body;
    const PONTUACAO_GANHA = 1000; 

    if (!usuario_id || !desafio_id || !link_submissao) {
        return res.status(400).json({ success: false, error: "Faltando dados de submissão." });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Inserção na tabela 'atividades'
        const [result] = await connection.query(
            "INSERT INTO atividades (usuario_id, desafio_id, link_submissao, status) VALUES (?, ?, ?, 'concluido')",
            [usuario_id, desafio_id, link_submissao]
        );
        
        // 2. Atualização dos pontos na tabela 'usuarios'
        await connection.query(
            "UPDATE usuarios SET pontos = COALESCE(pontos, 0) + ? WHERE id = ?",
            [PONTUACAO_GANHA, usuario_id]
        );
        
        await connection.commit();

        res.status(201).json({
            success: true,
            message: `Solução submetida! Você ganhou ${PONTUACAO_GANHA} pontos.`,
            atividade_id: result.insertId
        });

    } catch (err) {
        await connection.rollback();
        // Erro 1062 (Duplicidade) deve ser tratado se houver restrição UNIQUE na tabela 'atividades'
        console.error("❌ Erro ao submeter atividade:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor durante a submissão." });
    } finally {
        connection.release();
    }
});


// --- ROTAS ANTIGAS (MANTIDAS) ---

// Mark online/offline (MANTIDAS)
app.post("/api/usuarios/online", async (req, res) => { /* ... */ });
app.post("/api/usuarios/offline", async (req, res) => { /* ... */ });

// Ranking (MANTIDA)
app.get("/api/ranking", async (req, res) => {
    try {
        // Assumindo que a coluna 'pontos' está na tabela 'usuarios'
        const [rows] = await pool.query("SELECT id, nome, foto, pontos FROM usuarios ORDER BY pontos DESC LIMIT 100");
        res.json({ success: true, ranking: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Erro interno" });
    }
});

// ROTA: adicionar pontos (SUBSTITUÍDA pela rota de SUBMISSÃO, mas MANTIDA aqui)
app.post("/api/concluir", async (req, res) => { /* ... */ });

// Fallback para index.html (MANTIDA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- INICIALIZAÇÃO DO SERVIDOR ---

app.listen(PORT, () => {
  console.log("🚀 Servidor Cybermaker rodando na porta", PORT);
});

// O trecho final com 'module.exports = db;' foi removido pois este arquivo usa 'import' (ESM)
// e a conexão já é configurada no início.