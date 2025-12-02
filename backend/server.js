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

// Health route (Render check)
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
// arena_frontend.js (Para ser linkado em arena.html)

const API_BASE = (location.hostname.includes("localhost"))
    ? "http://localhost:3000"
    : "https://cybermaker-1-n7a7.onrender.com";

async function listarDesafios() {
    const listaContainer = document.getElementById('lista-desafios');
    listaContainer.innerHTML = 'Carregando desafios...';

    try {
        const url = `${API_BASE}/api/desafios`;
        const res = await fetch(url);
        const data = await res.json();

        if (res.ok && data.success) {
            listaContainer.innerHTML = ''; // Limpa a mensagem de carregamento

            if (data.desafios.length === 0) {
                listaContainer.innerHTML = '<p>Nenhum desafio disponível no momento.</p>';
                return;
            }

            data.desafios.forEach(desafio => {
                const desafioDiv = document.createElement('div');
                desafioDiv.className = 'desafio-card';
                desafioDiv.innerHTML = `
                    <h3>${desafio.titulo} (${desafio.area})</h3>
                    <p>${desafio.descricao.substring(0, 150)}...</p>
                    <small>Postado por: ${desafio.nome_recrutador}</small><br>
                    <button onclick="submeterSolucao(${desafio.id})">Submeter Solução</button>
                `;
                listaContainer.appendChild(desafioDiv);
            });
        } else {
            listaContainer.innerHTML = `<p>Erro ao carregar desafios: ${data.error}</p>`;
        }
    } catch (err) {
        listaContainer.innerHTML = `<p>Erro de conexão com o servidor de desafios.</p>`;
        console.error(err);
    }
}

// Chame a função ao carregar a página
document.addEventListener('DOMContentLoaded', listarDesafios);

// NOTE: A função submeterSolucao deve ser implementada para usar POST /api/atividades/submeter
// Rota para Usuário listar desafios na Arena 
app.get("/api/desafios", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                d.id, d.titulo, d.descricao, d.area, d.data_postagem,
                u.nome AS nome_recrutador
            FROM desafios d
            JOIN usuarios u ON d.recrutador_id = u.id
            ORDER BY d.data_postagem DESC
        `);

        res.json({ success: true, desafios: rows });

    } catch (err) {
        console.error("❌ Erro ao listar desafios:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

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

// Rota para Usuário postar no Diário
app.post("/api/diario", async (req, res) => {
    const { usuario_id, titulo, conteudo } = req.body;

    if (!usuario_id || !conteudo) {
        return res.status(400).json({ success: false, error: "ID do usuário e Conteúdo do Diário são obrigatórios." });
    }

    try {
        await pool.query(
            "INSERT INTO posts_diario (usuario_id, titulo, conteudo) VALUES (?, ?, ?)",
            [usuario_id, titulo || null, conteudo] // 'titulo' é opcional
        );

        res.status(201).json({ 
            success: true, 
            message: "Postagem no Diário registrada com sucesso!" 
        });

    } catch (err) {
        console.error("❌ Erro ao postar no Diário:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

// Rota para Usuário listar seus posts no Diário
app.get("/api/diario/:usuario_id", async (req, res) => {
    const { usuario_id } = req.params;

    try {
        const [rows] = await pool.query(
            // Seleciona todos os posts APENAS para o ID do usuário fornecido
            "SELECT id, titulo, conteudo, data_postagem FROM posts_diario WHERE usuario_id = ? ORDER BY data_postagem DESC",
            [usuario_id]
        );

        if (rows.length === 0) {
            return res.json({ success: true, posts: [], message: "Nenhum registro encontrado no seu Diário." });
        }

        res.json({ success: true, posts: rows });

    } catch (err) {
        console.error("❌ Erro ao buscar Diário:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

// Rota para Visualizar o Perfil de um Usuário (incluindo dados do ranking)
app.get("/api/perfil/:usuario_alvo_id", async (req, res) => {
    const { usuario_alvo_id } = req.params;

    try {
        // 1. Buscar dados principais e pontuação
        const [userData] = await pool.query(
            "SELECT id, nome, email, foto, pontos, data_criacao FROM usuarios WHERE id = ?",
            [usuario_alvo_id]
        );

        if (userData.length === 0) {
            return res.status(404).json({ success: false, error: "Usuário não encontrado." });
        }
        
        const usuario = userData[0];

        // 2. Buscar posts recentes do Diário deste usuário (opcional, mas útil para recrutadores)
        const [diarioPosts] = await pool.query(
            "SELECT id, titulo, data_postagem FROM posts_diario WHERE usuario_id = ? ORDER BY data_postagem DESC LIMIT 5",
            [usuario_alvo_id]
        );

        // 3. Buscar submissões (atividades) deste usuário
        const [atividades] = await pool.query(
            `
            SELECT a.link_submissao, a.status, d.titulo AS desafio_titulo
            FROM atividades a
            JOIN desafios d ON a.desafio_id = d.id
            WHERE a.usuario_id = ?
            ORDER BY a.data_submissao DESC
            `,
            [usuario_alvo_id]
        );

        res.json({ 
            success: true, 
            perfil: {
                ...usuario,
                diario_recente: diarioPosts,
                historico_atividades: atividades
            }
        });

    } catch (err) {
        console.error("❌ Erro ao buscar perfil:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});

// Rota para Recrutador iniciar Contato com um Usuário
app.post("/api/contato", async (req, res) => {
    // O recrutador_id deve vir da sessão/token do recrutador logado
    const { recrutador_id, usuario_alvo_id, mensagem } = req.body; 

    if (!recrutador_id || !usuario_alvo_id || !mensagem) {
        return res.status(400).json({ success: false, error: "Faltando IDs ou a mensagem." });
    }

    try {
        // 1. Verificação de Autorização (Obrigatório para segurança!)
        const [userCheck] = await pool.query(
            "SELECT tipo_usuario FROM usuarios WHERE id = ?",
            [recrutador_id]
        );
        
        if (userCheck.length === 0 || userCheck[0].tipo_usuario !== 'recrutador') {
            return res.status(403).json({ success: false, error: "Apenas recrutadores podem iniciar contato." });
        }

        // 2. Inserção na tabela 'contatos'
        const [result] = await pool.query(
            "INSERT INTO contatos (recrutador_id, usuario_alvo_id, mensagem) VALUES (?, ?, ?)",
            [recrutador_id, usuario_alvo_id, mensagem]
        );

        // TODO: Opcional: Enviar e-mail de notificação para o usuário_alvo

        res.status(201).json({ 
            success: true, 
            message: "Contato registrado com sucesso.",
            contato_id: result.insertId
        });

    } catch (err) {
        console.error("❌ Erro ao registrar contato:", err);
        res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});