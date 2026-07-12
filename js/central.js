let primeraCargaCentral = true;
let ultimoEventoVisto = null;
let centralActualizando = false;

async function cargarCentral() {
  if (centralActualizando) {
    return;
  }

  centralActualizando = true;

  try {
    const data = await api("action=central");

    if (!data.ok) {
      mostrarToast(
        data.mensaje || "No se pudo cargar la Central",
        "rojo"
      );

      return;
    }

    renderCentral(data.resumen);

    await revisarEventos();

  } catch (error) {
    console.error(error);

    mostrarToast(
      "Sin conexión con la base de datos",
      "rojo"
    );

  } finally {
    centralActualizando = false;
  }
}

function renderCentral(resumen) {
  const contenedor =
    document.getElementById("contenedor");

  contenedor.innerHTML = "";

  resumen.forEach(cuartel => {
    const fila = document.createElement("div");

    fila.className = "fila-cuartel";

    const unidadesHTML =
      cuartel.unidades.length > 0
        ? cuartel.unidades
            .map(crearUnidadHTML)
            .join("")
        : `
          <div class="sin-unidades">
            Sin unidades registradas
          </div>
        `;

    fila.innerHTML = `
      <div class="nombre-cuartel">
        ${
          escaparHTML(
            CONFIG.CUARTELES[cuartel.cuartel] ||
            cuartel.cuartel
          )
        }
      </div>

      <div class="disponibles-box">
        <div class="disponibles-num">
          ${Number(cuartel.disponibles || 0)}
        </div>

        <div class="disponibles-txt">
          DISPONIBLES
        </div>
      </div>

      <div class="unidades-linea">
        ${unidadesHTML}
      </div>
    `;

    contenedor.appendChild(fila);
  });
}

function crearUnidadHTML(unidad) {
  return `
    <div class="unidad ${claseEstadoUnidad(unidad.estado)}">

      <strong>
        ${escaparHTML(unidad.unidad)}
      </strong>

      <div class="estado">
        ${
          escaparHTML(
            unidad.estado || "Sin conductor"
          )
        }
      </div>

      <div class="conductores">
        <b>Principal:</b>
        ${
          escaparHTML(
            unidad.principalNombre || "-"
          )
        }

        <br>

        <b>Secundario:</b>
        ${
          escaparHTML(
            unidad.secundarioNombre || "-"
          )
        }
      </div>

    </div>
  `;
}

async function revisarEventos() {
  try {
    const data = await api(
      "action=eventosRecientes&limite=20"
    );

    if (
      !data.ok ||
      !Array.isArray(data.eventos) ||
      data.eventos.length === 0
    ) {
      return;
    }

    const eventoMasReciente = data.eventos[0];

    /*
     * En la primera carga no se muestran eventos antiguos.
     * Solo se almacena el último evento existente.
     */
    if (primeraCargaCentral) {
      ultimoEventoVisto =
        Number(eventoMasReciente.id);

      primeraCargaCentral = false;

      return;
    }

    const nuevosEventos = data.eventos
      .filter(evento =>
        Number(evento.id) >
        Number(ultimoEventoVisto || 0)
      )
      .sort((a, b) =>
        Number(a.id) - Number(b.id)
      );

    nuevosEventos.forEach(evento => {
      mostrarToast(
        construirTextoEvento(evento),
        colorEvento(evento)
      );
    });

    ultimoEventoVisto =
      Number(eventoMasReciente.id);

  } catch (error) {
    console.error(
      "Error consultando eventos:",
      error
    );
  }
}

function construirTextoEvento(evento) {
  const hora = evento.hora
    ? `${evento.hora} · `
    : "";

  const detalle =
    evento.detalle ||
    evento.tipo ||
    "Nuevo evento";

  return hora + detalle;
}

function colorEvento(evento) {
  const tipo = normalizarTexto(evento.tipo);
  const detalle = normalizarTexto(evento.detalle);

  if (
    detalle.includes("fuera de servicio") ||
    tipo.includes("fuera de servicio")
  ) {
    return "rojo";
  }

  if (
    detalle.includes("conductor") ||
    tipo.includes("asignar conductor") ||
    tipo.includes("quitar conductor")
  ) {
    return "azul";
  }

  if (
    detalle.includes("en emergencia")
  ) {
    return "naranja";
  }

  if (
    tipo.includes("salida") ||
    detalle.includes("salio del cuartel") ||
    detalle.includes("sin conductor")
  ) {
    return "amarillo";
  }

  return "verde";
}

function mostrarToast(
  texto,
  tipo = "verde"
) {
  const contenedor =
    document.getElementById("toastContainer");

  if (!contenedor) {
    return;
  }

  const toast = document.createElement("div");

  toast.className = `toast ${tipo}`;
  toast.textContent = texto;

  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("saliendo");
  }, 6000);

  setTimeout(() => {
    toast.remove();
  }, 6500);
}

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

iniciarReloj();
cargarCentral();

setInterval(
  cargarCentral,
  5000
);
