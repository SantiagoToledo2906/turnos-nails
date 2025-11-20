// Front-end JS para la opción semiautomática de reserva con pago por seña
const btnPagar = document.getElementById("btnPagar");
const btnReset = document.getElementById("btnReset");
const mensaje = document.getElementById("mensaje");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const overlay = document.getElementById("overlay");
const aliasPago = document.getElementById("aliasPago");  // Nuevo elemento para mostrar el alias

const RES_EXPIRATION_MIN = 30; // Tiempo en minutos hasta que el turno expire si no se paga

(function setMinDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  fechaInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);
})();

function mostrarMensaje(texto, tipo = "wait") {
  mensaje.textContent = texto;
  mensaje.classList.remove('success', 'error', 'wait');
  if (tipo === 'success') mensaje.classList.add('success');
  else if (tipo === 'error') mensaje.classList.add('error');
  else mensaje.classList.add('wait');

  mensaje.style.opacity = 1;
  setTimeout(() => { mensaje.style.opacity = 0.95 }, 10);

  clearTimeout(mostrarMensaje._t);
  mostrarMensaje._t = setTimeout(() => { mensaje.textContent = ''; mensaje.style.opacity = 0 }, 6000);
}

function showLoader() { overlay.classList.add('show'); }
function hideLoader() { overlay.classList.remove('show'); }

btnReset.addEventListener('click', () => {
  document.getElementById('reservaForm').reset();
  for (let o of horaSelect.options) { o.disabled = false; o.style.color = 'black'; }
  mostrarMensaje('Formulario limpiado', 'wait');
});

btnPagar.addEventListener('click', async function () {
  const nombre = document.getElementById('nombre').value.trim();
  const fecha = fechaInput.value;
  const hora = horaSelect.value;
  const tipo = document.getElementById('tipo').value;

  if (!nombre || !fecha || !hora || !tipo) {
    mostrarMensaje('Completá todos los campos.', 'error');
    return;
  }

  // Deshabilitar botones y mostrar loader
  btnPagar.disabled = true;
  btnReset.disabled = true;
  showLoader();

  try {
    // Crear pago y obtener el link de MercadoPago (seña pendiente)
    const resp = await fetch('/api/crearPago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, fecha, hora, tipo })
    });

    const respuesta = await resp.text();
    hideLoader();
    btnPagar.disabled = false;
    btnReset.disabled = false;

    if (respuesta === "error_fecha") {
      mostrarMensaje("No se puede reservar una fecha pasada.", "error");
      return;
    }

    if (respuesta === "occupied") {
      mostrarMensaje("Ese turno ya fue reservado.", "error");
      fechaInput.dispatchEvent(new Event('change'));
      return;
    }

    if (respuesta === "error") {
      mostrarMensaje("Error al generar el pago. Intentá otra vez.", "error");
      return;
    }

    // Mostrar el alias de pago
    aliasPago.style.display = 'block';
    aliasPago.textContent = `Por favor, realiza el pago utilizando este alias: ${respuesta}`;
    mostrarMensaje("Link generado. Completá el pago para confirmar tu turno.", "success");

    // 📌 ***AGREGADO: Abrir WhatsApp con los datos del turno***
    enviarWhatsapp(nombre, fecha, hora, tipo);

    // Aquí seguiría guardando en la base de datos si corresponde…

  } catch (e) {
    hideLoader();
    btnPagar.disabled = false;
    btnReset.disabled = false;
    mostrarMensaje('Error de conexión. Revisá tu internet.', 'error');
  }
});


// ======================================================
//   📌 FUNCIÓN NUEVA — ENVÍA INFORMACIÓN A WHATSAPP
// ======================================================
function enviarWhatsapp(nombre, fecha, hora, tipo) {
  const numero = "5491131709430"; // Tu número

  const mensaje = 
    "Nueva reserva%0A" +
    "Nombre: " + encodeURIComponent(nombre) + "%0A" +
    "Fecha: " + encodeURIComponent(fecha) + "%0A" +
    "Horario: " + encodeURIComponent(hora) + "%0A" +
    "Servicio: " + encodeURIComponent(tipo);

  const url = `https://wa.me/${numero}?text=${mensaje}`;

  // Abrir WhatsApp
  window.open(url, "_blank");
}
