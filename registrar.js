import express from "express";
import bcrypt from "bcryptjs";
import pool from "./conection.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

const router = express.Router();

// Configuração do Nodemailer (SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Função para validar senha forte
function validarSenha(senha) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(senha);
}

// Função para enviar email de confirmação
async function enviarEmailConfirmacao(email, nome, token) {
  const link = `${process.env.FRONTEND_URL}/confirmar-email.html?token=${token}`;

  await transporter.sendMail({
    from: `"CyberMaker" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Confirme seu email",
    html: `<p>Olá ${nome},</p>
           <p>Obrigado por se registrar! Clique no link abaixo para ativar sua conta:</p>
           <a href="${link}">Confirmar email</a>`
  });

  console.log(`✅ Email de confirmação enviado para ${email}`);
}

router.post("/", async (req, res) => {
  const { nome, email, senha, tipo_usuario, foto } = req.body;

  if (!validarSenha(senha)) {
    return res.status(400).json({ error: "Senha fraca! Use mínimo 8 caracteres, letras maiúsculas/minúsculas, números e caracteres especiais." });
  }

  try {
    const [existe] = await pool.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (existe.length > 0) return res.status(400).json({ error: "Email já cadastrado!" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const token = crypto.randomBytes(32).toString("hex");

    await pool.query(
      "INSERT INTO usuarios (nome, email, senha, tipo_usuario, foto, token_confirmacao) VALUES (?, ?, ?, ?, ?, ?)",
      [nome, email, senhaHash, tipo_usuario, foto || null, token]
    );

    await enviarEmailConfirmacao(email, nome, token);

    res.json({ success: "Registrado com sucesso! Confira seu email para ativar a conta." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

export default router;
