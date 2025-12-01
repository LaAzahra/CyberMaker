function carregarIdeias() {
  arena.innerHTML = "";
  if (ideias.length === 0) {
    const vazio = document.createElement("div");
    vazio.style.gridColumn = "1 / -1";
    vazio.style.textAlign = "center";
    vazio.style.padding = "2rem";
    vazio.style.background = "rgba(30,0,0,0.8)";
    vazio.style.border = "2px dashed #a30000";
    vazio.style.borderRadius = "15px";
    vazio.style.color = "#ff8080";
    vazio.style.fontFamily = "'Cinzel', serif";
    vazio.style.fontSize = "1.3rem";
    vazio.textContent = "Nenhuma ideia foi registrada ainda... 🌑";
    arena.appendChild(vazio);
    return;
  }

  ideias.forEach((ideia, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${ideia.img || 'https://via.placeholder.com/300x150/550000/ffffff?text=Ideia'}" alt="imagem ideia">
      <h3>${ideia.titulo}</h3>
      <p>${ideia.descricao}</p>
      <button class="concluir-btn" onclick="abrirModal(${index})">Concluir</button>
    `;
    arena.appendChild(card);
  });
}

// Botões
// Navegação
document.getElementById("btn-inicio").onclick = () => window.location.href = " ../assets/html/index.html";
document.getElementById("btn-diario").onclick = () => window.location.href = "../assets/html/diario.html";

const btnLogin = document.getElementById("btn-login");
const btnRegistrar = document.getElementById("btn-registrar");
const btnLogout = document.getElementById("btn-logout");
const nomeUsuario = document.getElementById("nome-usuario");
const fotoPerfil = document.getElementById("foto-perfil");

function atualizarHeader() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

  if (usuarioLogado) {
    nomeUsuario.textContent = usuarioLogado.nome;
    fotoPerfil.src = usuarioLogado.foto || "default.png";
    btnLogin.style.display = "none";
    btnRegistrar.style.display = "none";
    btnLogout.style.display = "inline-block";
  } else {
    nomeUsuario.textContent = "CyberMaker";
    fotoPerfil.src = "default.png";
    btnLogin.style.display = "inline-block";
    btnRegistrar.style.display = "inline-block";
    btnLogout.style.display = "none";
  }
}

btnLogout.addEventListener("click", () => {
  localStorage.removeItem("usuarioLogado");
  atualizarHeader();
});

atualizarHeader();
async function buscarIdeias() {
  try {
    const res = await fetch("/api/ideias");
    const data = await res.json();
    ideias = data;
    carregarIdeias();
  } catch (err) {
    console.error("Erro ao buscar ideias:", err);
  }
}
buscarIdeias();