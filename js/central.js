let ultimoResumen = null;
let primeraCarga = true;
async function cargarCentral() {
  try {
    const data = await api("action=central");
    if (!data.ok) return;
    if (!primeraCarga) detectarCambios(ultimoResumen, data.resumen);
    ultimoResumen = JSON.parse(JSON.stringify(data.resumen));
    primeraCarga = false;
    renderCentral(data.resumen);
  } catch (error) { mostrarToast("Sin conexión con la base de datos", "rojo"); }
}
function renderCentral(resumen) {
  const cont = document.getElementById("contenedor"); cont.innerHTML = "";
  resumen.forEach(c => {
    const fila = document.createElement("div"); fila.className = "fila-cuartel";
    let unidadesHTML = "";
    c.unidades.forEach(u => {
      unidadesHTML += `<div class="unidad ${claseEstadoUnidad(u.estado)}"><strong>${u.unidad}</strong><div class="estado">${u.estado}</div><div class="conductores">Principal: ${u.principalNombre || "-"}<br>Secundario: ${u.secundarioNombre || "-"}</div></div>`;
    });
    fila.innerHTML = `<div class="nombre-cuartel">${CONFIG.CUARTELES[c.cuartel] || c.cuartel}</div><div class="disponibles-box"><div class="disponibles-num">${c.disponibles}</div><div class="disponibles-txt">DISPONIBLES</div></div><div class="unidades-linea">${unidadesHTML || '<div class="sin-unidades">Sin unidades registradas</div>'}</div>`;
    cont.appendChild(fila);
  });
}
function detectarCambios(anterior, actual) {
  if (!anterior || !actual) return;
  actual.forEach(cActual => {
    const cAnterior = anterior.find(x => x.cuartel === cActual.cuartel); if (!cAnterior) return;
    if (cActual.disponibles > cAnterior.disponibles) mostrarToast(`${CONFIG.CUARTELES[cActual.cuartel]} aumentó disponibles: ${cActual.disponibles}`, "verde");
    if (cActual.disponibles < cAnterior.disponibles) mostrarToast(`${CONFIG.CUARTELES[cActual.cuartel]} bajó disponibles: ${cActual.disponibles}`, "amarillo");
    cActual.unidades.forEach(uActual => {
      const uAnterior = cAnterior.unidades.find(x => x.unidad === uActual.unidad); if (!uAnterior) return;
      if (uActual.estado !== uAnterior.estado) {
        const color = uActual.estado === "Fuera de servicio" ? "rojo" : uActual.estado === "Disponible" ? "verde" : "amarillo";
        mostrarToast(`${uActual.unidad} cambió a ${uActual.estado}`, color);
      }
      if (uActual.principalNombre !== uAnterior.principalNombre && uActual.principalNombre) mostrarToast(`${uActual.unidad}: principal ${uActual.principalNombre}`, "azul");
      if (uActual.secundarioNombre !== uAnterior.secundarioNombre && uActual.secundarioNombre) mostrarToast(`${uActual.unidad}: secundario ${uActual.secundarioNombre}`, "azul");
    });
  });
}
function mostrarToast(texto, tipo) {
  const cont = document.getElementById("toastContainer");
  const div = document.createElement("div"); div.className = "toast " + (tipo || ""); div.innerText = texto; cont.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}
iniciarReloj(); cargarCentral(); setInterval(cargarCentral, 10000);
