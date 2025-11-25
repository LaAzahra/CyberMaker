// Função para compactar a imagem antes de enviar
async function compressImage(file, maxWidth = 300, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = error => reject(error);
    };
  });
}

document.getElementById("formRegistro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome").value;
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  const foto = document.getElementById("foto").files[0];

  let fotoBase64 = null;

  if (foto) {
    fotoBase64 = await compressImage(foto);
  }

  const dados = { nome, email, senha, foto: fotoBase64 };

  const resposta = await fetch("/registrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  });

  const resultado = await resposta.json();
  document.getElementById("mensagem").textContent = resultado.mensagem;
});
