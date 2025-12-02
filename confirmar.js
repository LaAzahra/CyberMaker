// confirmar.js (ou rota GET /confirmar-email)

import express from 'express';
import pool from './conection.js';

const router = express.Router();

// Esta rota recebe o token de confirmação da URL (Ex: /confirmar/a1b2c3d4e5f6...)
router.get('/:token', async (req, res) => {
    const { token } = req.params;

    if (!token) {
        // Redireciona para uma página de erro ou envia uma mensagem
        return res.status(400).send('Token de confirmação ausente.');
    }

    try {
        // 1. Executa a atualização no banco de dados
        // - Define 'confirmado' como TRUE
        // - Limpa o 'token_confirmacao' (por segurança, o token é descartado)
        // - Garante que apenas contas não confirmadas sejam atualizadas
        const sql = `
            UPDATE usuarios 
            SET confirmado = TRUE, token_confirmacao = NULL 
            WHERE token_confirmacao = ? AND confirmado = FALSE
        `;
        
        const [result] = await pool.query(sql, [token]);

        // 2. Verifica se a atualização foi bem-sucedida
        if (result.affectedRows === 0) {
            // Se 0 linhas foram afetadas, o token é inválido, expirou ou a conta já está confirmada
            return res.status(400).send('Erro: O link de confirmação é inválido ou já foi utilizado.');
        }

        // 3. Sucesso: Redireciona o usuário
        // O ideal é redirecionar para a página de Login do seu FRONTEND 
        // com uma mensagem de sucesso.
        const loginUrl = `${process.env.FRONTEND_URL}/login.html?status=success`;
        
        console.log(`✅ Conta confirmada com sucesso para o token: ${token}`);
        res.redirect(loginUrl); 

    } catch (error) {
        console.error('❌ Erro na confirmação de e-mail:', error);
        res.status(500).send('Erro interno do servidor ao confirmar a conta.');
    }
});

export default router;