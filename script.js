const btnPagar = document.getElementById("btnPagar");
const btnReset = document.getElementById("btnReset");
const mensaje = document.getElementById("mensaje");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

// Setear fecha mínima
(function setMinDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  fechaInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);
})();

// Función de mensaje
function mostrarMensaje(texto, tipo = "wait") {
  mensaje.textContent = texto;
  mensaje.className = "msg " + tipo;

  setTimeout(() => {
    mensaje.textContent = "";
  }, 4000);
}

// Resetear formulario
btnReset.addEventListener('click', () => {
  document.getElementById('reservaForm').reset();
  mostrarMensaje('Formulario limpiado', 'wait');
});

// BOTÓN PRINCIPAL — SOLO WHATSAPP
btnPagar.addEventListener('click', function () {
  const nombre = document.getElementById('nombre').value.trim();
  const fecha = fechaInput.value;
  const hora = horaSelect.value;
  const tipo = document.getElementById('tipo').value;

  if (!nombre || !fecha || !hora || !tipo) {
    mostrarMensaje('Completá todos los campos.', 'error');
    return;
  }

  // Enviar a WhatsApp directamente
  enviarWhatsapp(nombre, fecha, hora, tipo);
});

// FUNCIÓN QUE REDIRIGE A WHATSAPP
function enviarWhatsapp(nombre, fecha, hora, tipo) {
  const numero = "5491131709430"; // Tu número

  const mensaje =
    "Nueva reserva%0A" +
    "Nombre: " + encodeURIComponent(nombre) + "%0A" +
    "Fecha: " + encodeURIComponent(fecha) + "%0A" +
    "Horario: " + encodeURIComponent(hora) + "%0A" +
    "Servicio: " + encodeURIComponent(tipo);

  const url = `https://wa.me/${numero}?text=${mensaje}`;

  window.open(url, "_blank");
}
