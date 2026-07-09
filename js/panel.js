const params = new URLSearchParams(window.location.search);
const CUARTEL = params.get("cuartel") || "2";
let unidadSeleccionada = null;
let tipoConductorSeleccionado = "principal";

document.getElementById("titulo").innerText = CONFIG.CUARTELES[CUARTEL] || "Control de Cuartel";
document.getElementById("inputIngreso").addEventListener("keydown", e => { if (e.key === "Enter") registrar(); });

async function cargarPanel() {
  try {
    const data = await api("action=panel&cuartel=" + encodeURIComponent(CUARTEL));
    if (!data.ok) { mensaje("Error al cargar panel", "red"); return; }
    document.getElementById("contadorDisponibles").innerText = data.disponibles;
    renderUnidades(data.unidades);
    renderBomberos(data.bomberos);
  } catch (error) { mensaje("Sin conexión con la base de datos", "red"); }
}
async function registrar() {
  const input = document.getElementById("inputIngreso");
  const valor = input.value.trim();
  if (!valor) return;
  mensaje("Procesando...", "#444");
  const data = await api("action=registrar&input=" + encodeURIComponent(valor) + "&cuartel=" + encodeURIComponent(CUARTEL));
  mensaje(data.mensaje, data.ok ? "green" : "red");
  input.value = ""; input.focus(); cargarPanel();
}
async function cambiarEstadoBombero(registro) {
  const card = document.querySelector(`[data-registro="${registro}"]`);
  if (!card) return;
  const estadoDiv = card.querySelector(".estado");
  const actual = estadoDiv.innerText.trim();
  const index = CONFIG.ESTADOS_BOMBERO.indexOf(actual);
  const nuevo = CONFIG.ESTADOS_BOMBERO[(index + 1) % CONFIG.ESTADOS_BOMBERO.length];
  card.className = "bombero " + claseEstadoBombero(nuevo);
  estadoDiv.innerText = nuevo;
  actualizarContadorLocal();
  const data = await api("action=cambiarEstadoBombero&registro=" + encodeURIComponent(registro));
  if (!data.ok) { mensaje(data.mensaje, "red"); cargarPanel(); return; }
  mensaje("Estado actualizado", "green");
  if (nuevo !== "Disponible") cargarPanel();
}
function renderBomberos(bomberos) {
  const cont = document.getElementById("personal"); cont.innerHTML = "";
  bomberos.forEach(b => {
    const div = document.createElement("div");
    div.className = "bombero " + claseEstadoBombero(b.estado);
    div.dataset.registro = b.registro;
    div.onclick = () => cambiarEstadoBombero(b.registro);
    div.innerHTML = `<img src="${b.foto || CONFIG.FOTO_DEFAULT}" onerror="this.src='${CONFIG.FOTO_DEFAULT}'"><div class="bombero-info"><div class="nombre">${b.nombre}</div><div class="cargo">${b.cargo || ""}</div><div class="estado">${b.estado}</div></div>`;
    cont.appendChild(div);
  });
}
function renderUnidades(unidades) {
  const cont = document.getElementById("unidades"); cont.innerHTML = "";
  unidades.forEach(u => {
    const div = document.createElement("div");
    div.className = "unidad " + claseEstadoUnidad(u.estado);
    div.onclick = () => abrirModalUnidad(u);
    div.innerHTML = `<h2>${u.unidad}</h2><div class="estado-unidad">${u.estado}</div><div class="conductores"><strong>Principal:</strong><br>${u.principalNombre || "-"}<br><strong>Secundario:</strong><br>${u.secundarioNombre || "-"}</div>`;
    cont.appendChild(div);
  });
}
function abrirModalUnidad(unidad) {
  unidadSeleccionada = unidad;
  document.getElementById("modalTitulo").innerText = unidad.unidad + " - " + unidad.estado;
  document.getElementById("listaConductores").style.display = "none";
  document.getElementById("listaConductores").innerHTML = "";
  document.getElementById("modalFondo").style.display = "flex";
}
function cerrarModal() { document.getElementById("modalFondo").style.display = "none"; unidadSeleccionada = null; }
async function mostrarConductores(tipo) {
  tipoConductorSeleccionado = tipo;
  if (!unidadSeleccionada) return;
  if (unidadSeleccionada.estado === "Fuera de servicio") { mensaje("La unidad está fuera de servicio", "red"); return; }
  const lista = document.getElementById("listaConductores");
  lista.style.display = "block"; lista.innerHTML = "Cargando conductores habilitados...";
  const data = await api("action=conductoresDisponibles&unidad=" + encodeURIComponent(unidadSeleccionada.unidad) + "&cuartel=" + encodeURIComponent(CUARTEL));
  if (!data.ok || data.conductores.length === 0) { lista.innerHTML = "<strong>No hay conductores disponibles habilitados para esta unidad.</strong>"; return; }
  lista.innerHTML = "";
  data.conductores.forEach(c => {
    const item = document.createElement("div"); item.className = "conductor-item"; item.onclick = () => asignarConductor(c.registro);
    item.innerHTML = `<img src="${c.foto || CONFIG.FOTO_DEFAULT}" onerror="this.src='${CONFIG.FOTO_DEFAULT}'"><div><strong>${c.nombre}</strong><br><small>${c.cargo || ""}</small></div>`;
    lista.appendChild(item);
  });
}
async function asignarConductor(registro) {
  if (!unidadSeleccionada) return;
  const data = await api("action=asignarConductor&unidad=" + encodeURIComponent(unidadSeleccionada.unidad) + "&registro=" + encodeURIComponent(registro) + "&tipo=" + encodeURIComponent(tipoConductorSeleccionado));
  mensaje(data.mensaje, data.ok ? "green" : "red"); cerrarModal(); cargarPanel();
}
async function quitarConductorModal(tipo) {
  if (!unidadSeleccionada) return;
  const data = await api("action=quitarConductor&unidad=" + encodeURIComponent(unidadSeleccionada.unidad) + "&tipo=" + encodeURIComponent(tipo));
  mensaje(data.mensaje, data.ok ? "green" : "red"); cerrarModal(); cargarPanel();
}
async function marcarFueraServicio() {
  if (!unidadSeleccionada) return;
  if (!confirm("¿Marcar " + unidadSeleccionada.unidad + " fuera de servicio?")) return;
  const data = await api("action=cambiarEstadoUnidad&unidad=" + encodeURIComponent(unidadSeleccionada.unidad) + "&estado=" + encodeURIComponent("Fuera de servicio"));
  mensaje(data.mensaje, data.ok ? "green" : "red"); cerrarModal(); cargarPanel();
}
async function habilitarSinConductor() {
  if (!unidadSeleccionada) return;
  const data = await api("action=cambiarEstadoUnidad&unidad=" + encodeURIComponent(unidadSeleccionada.unidad) + "&estado=" + encodeURIComponent("Sin conductor"));
  mensaje(data.mensaje, data.ok ? "green" : "red"); cerrarModal(); cargarPanel();
}
function actualizarContadorLocal() {
  const disponibles = Array.from(document.querySelectorAll(".bombero .estado")).map(e => e.innerText.trim()).filter(e => e === "Disponible").length;
  document.getElementById("contadorDisponibles").innerText = disponibles;
}
iniciarReloj(); cargarPanel(); setInterval(cargarPanel, 15000);
