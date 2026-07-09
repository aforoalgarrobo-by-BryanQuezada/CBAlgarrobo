function reloj() {
  const ahora = new Date();
  const el = document.getElementById("hora");
  if (el) el.innerText = ahora.toLocaleString("es-CL");
}
function iniciarReloj() { reloj(); setInterval(reloj, 1000); }
function claseEstadoBombero(estado) {
  if (estado === "Disponible") return "disponible";
  if (estado === "No disponible") return "no-disponible";
  if (estado === "En capacitación") return "en-capacitacion";
  if (estado === "En emergencia") return "en-emergencia";
  return "";
}
function claseEstadoUnidad(estado) {
  if (estado === "Disponible") return "disponible";
  if (estado === "Sin conductor") return "sin-conductor";
  if (estado === "Fuera de servicio") return "fuera-de-servicio";
  return "";
}
function mensaje(texto, color) {
  const div = document.getElementById("mensaje");
  if (!div) return;
  div.innerText = texto || "";
  div.style.color = color || "#222";
  setTimeout(() => { div.innerText = ""; }, 3500);
}
