const createUsersTable = `CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo_usuario ENUM('recrutador','usuario') NOT NULL DEFAULT 'usuario',
    
    -- Campos de Segurança (Confirmação de Email)
    token_confirmacao VARCHAR(255), 
    confirmado BOOLEAN DEFAULT FALSE, 

    -- Campos de Perfil/Ranking
    foto LONGTEXT,
    pontos INT DEFAULT 0,
    online BOOLEAN DEFAULT FALSE,
    
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

module.exports = createUsersTable;