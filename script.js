import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import multer from "multer";
import sharp from "sharp";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // Limite controlado

// Configuração do banco
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

// Configuração do multer (upload temporário)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Rota de registro com compressão
app.post("/registrar", upload.single("foto"), async (req, res) => {
  try {
    const { nome, email, senha, foto } = req.body;
    let fotoBase64Final = null;

    if (foto) {
      // Buffer a partir do Base64 recebido do front
      const base64Data = foto.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Compressão final com sharp (ainda menor)
      const bufferCompactado = await sharp(buffer)
        .resize({ width: 300 })
        .jpeg({ quality: 60 })
        .toBuffer();

      fotoBase64Final = `data:image/jpeg;base64,${bufferCompactado.toString("base64")}`;
    }

    await db.execute(
      "INSERT INTO usuarios (nome, email, senha, foto) VALUES (?, ?, ?, ?)",
      [nome, email, senha, fotoBase64Final]
    );

    res.json({ mensagem: "Usuário registrado com sucesso!" });
  } catch (erro) {
    console.error("Erro ao registrar:", erro);
    res.status(500).json({ mensagem: "Erro no servidor." });
  }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
