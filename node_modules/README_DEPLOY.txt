Deployment notes
- This package was prepared to be hosted on any Node.js hosting (Heroku, Render, Railway, DigitalOcean App Platform, VPS).
- Configure environment variables:
  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, PORT (optional)
- The server serves static frontend files and provides API endpoints under /api.
- Ensure your MySQL database has tables 'usuarios' and 'ideias'. Example schema:
  CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(200),
    email VARCHAR(200) UNIQUE,
    senha VARCHAR(255),
    foto TEXT,
    pontos INT DEFAULT 0,
    online BOOLEAN DEFAULT FALSE
  );
  CREATE TABLE ideias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    titulo VARCHAR(255),
    texto TEXT,
    created_at DATETIME,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );
- To deploy quickly with Docker, create a Dockerfile and use container-based hosting.
