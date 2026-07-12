/* =========================================================
   CBA SUITE - CENTRAL OPERATIVA
========================================================= */

let primeraCargaCentral = true;
let ultimoEventoVisto = null;
let centralActualizando = false;

let ultimoResumenCentral = null;
let resumenCentralActual = [];

let historialEventos = [];

/* =========================================================
   AUDIO
========================================================= */

let contextoAudio = null;
let sonidoHabilitado = false;

async function habilitarSonido() {
  if (sonidoHabilitado) {
    return;
  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) {
    console.warn(
      "Este navegador no permite generar sonidos."
    );

    return;
  }

  try {
    contextoAudio = new AudioContext();

    if (contextoAudio.state === "suspended") {
      await contextoAudio.resume();
    }

    sonidoHabilitado = true;

    mostrarToast(
      "Sonido de avisos activado",
      "azul",
      false
    );

  } catch (error) {
    console.error(
      "No se pudo activar el sonido:",
      error
    );
  }
}

/*
 * El navegador exige una interacción del usuario
 * antes de permitir audio automático.
 */
document.addEventListener(
  "pointerdown",
  habilitarSonido,
  { once: true }
);

function reproducirTimbre(tipo = "verde") {
  if (
    !sonidoHabilitado ||
    !contextoAudio
  ) {
    return;
  }

  const frecuencias = {
    verde: 880,
    azul: 760,
    amarillo: 620,
    naranja: 520,
    rojo: 420
  };

  const frecuencia =
    frecuencias[tipo] ||
    frecuencias.verde;

  const inicio =
    contextoAudio.currentTime;

  crearTono(
    frecuencia,
    inicio,
    0.18,
    0.16
  );

  crearTono(
    frecuencia * 1.15,
    inicio + 0.22,
    0.18,
    0.13
  );
}

function crearTono(
  frecuencia,
  inicio,
  duracion,
  volumenMaximo
) {
  const oscilador =
    contextoAudio.createOscillator();

  const volumen =
    contextoAudio.createGain();

  oscilador.type = "sine";

  oscilador.frequency.setValueAtTime(
    frecuencia,
    inicio
  );

  volumen.gain.setValueAtTime(
    0.0001,
    inicio
  );

  volumen.gain.exponentialRampToValueAtTime(
    volumenMaximo,
    inicio + 0.02
  );

  volumen.gain.exponentialRampToValueAtTime(
    0.0001,
    inicio + duracion
  );

  oscilador.connect(volumen);
  volumen.connect(contextoAudio.destination);

  oscilador.start(inicio);

  oscilador.stop(
    inicio + duracion + 0.03
  );
}

/* =========================================================
   CARGA PRINCIPAL
========================================================= */

async function cargarCentral() {
  if (centralActualizando) {
    return;
  }

  centralActualizando = true;

  try {
    const data = await api(
      "action=central"
    );

    if (!data.ok) {
      mostrarToast(
        data.mensaje ||
        "No se pudo cargar la Central",
        "rojo"
      );

      return;
    }

    const resumenNuevo =
      Array.isArray(data.resumen)
        ? data.resumen
        : [];

    detectarCuartelesSinPersonal(
      ultimoResumenCentral,
      resumenNuevo
    );

    resumenCentralActual =
      resumenNuevo;

    renderCentral(
      resumenCentralActual
    );

    ultimoResumenCentral =
      JSON.parse(
        JSON.stringify(
          resumenCentralActual
        )
      );

    await revisarEventos();

  } catch (error) {
    console.error(
      "Error cargando la Central:",
      error
    );

    mostrarToast(
      "Sin conexión con la base de datos",
      "rojo"
    );

  } finally {
    centralActualizando = false;
  }
}

/* =========================================================
   ALERTA: CUARTEL SIN PERSONAL DISPONIBLE
========================================================= */

function detectarCuartelesSinPersonal(
  resumenAnterior,
  resumenActual
) {
  if (
    !Array.isArray(resumenAnterior) ||
    !Array.isArray(resumenActual)
  ) {
    return;
  }

  resumenActual.forEach(
    cuartelActual => {
      const cuartelAnterior =
        resumenAnterior.find(
          item =>
            String(item.cuartel) ===
            String(cuartelActual.cuartel)
        );

      if (!cuartelAnterior) {
        return;
      }

      const disponiblesAntes =
        Number(
          cuartelAnterior.disponibles || 0
        );

      const disponiblesAhora =
        Number(
          cuartelActual.disponibles || 0
        );

      /*
       * La alerta aparece solo cuando pasa
       * desde 1 o más disponibles a 0.
       */
      if (
        disponiblesAntes > 0 &&
        disponiblesAhora === 0
      ) {
        const nombreCuartel =
          CONFIG.CUARTELES[
            cuartelActual.cuartel
          ] ||
          cuartelActual.cuartel;

        const texto =
          `${nombreCuartel} sin personal disponible`;

        mostrarToast(
          texto,
          "rojo",
          true
        );

        agregarEventoHistorial({
          id: `alerta-${Date.now()}-${cuartelActual.cuartel}`,
          hora: obtenerHoraActual(),
          detalle: texto,
          tipo: "Alerta sin personal"
        });
      }
    }
  );
}

/* =========================================================
   CENTRAL
========================================================= */

function renderCentral(resumen) {
  const contenedor =
    document.getElementById(
      "contenedor"
    );

  if (!contenedor) {
    return;
  }

  contenedor.innerHTML = "";

  resumen.forEach(cuartel => {
    const fila =
      document.createElement("div");

    fila.className =
      "fila-cuartel";

    /*
     * Orden:
     * 1. Disponible
     * 2. Sin conductor
     * 3. Fuera de servicio
     */
    const unidadesOrdenadas =
      ordenarUnidades(
        cuartel.unidades || []
      );

    const unidadesHTML =
      unidadesOrdenadas.length > 0
        ? unidadesOrdenadas
            .map(crearUnidadHTML)
            .join("")
        : `
          <div class="sin-unidades">
            Sin unidades registradas
          </div>
        `;

    fila.innerHTML = `
      <div class="nombre-cuartel">
        ${escaparHTML(
          CONFIG.CUARTELES[
            cuartel.cuartel
          ] ||
          cuartel.cuartel
        )}
      </div>

      <button
        class="disponibles-box"
        type="button"
        onclick="abrirModalPersonal('${escaparAtributo(
          cuartel.cuartel
        )}')"
        title="Ver personal presente"
      >
        <div class="disponibles-num">
          ${Number(
            cuartel.disponibles || 0
          )}
        </div>

        <div class="disponibles-txt">
          DISPONIBLES
        </div>

        <div class="presentes-txt">
          ${Number(
            cuartel.presentesCantidad ||
            (
              Array.isArray(cuartel.personal)
                ? cuartel.personal.length
                : 0
            )
          )} presentes
        </div>
      </button>

      <div class="unidades-linea">
        ${unidadesHTML}
      </div>
    `;

    contenedor.appendChild(fila);
  });
}

function ordenarUnidades(unidades) {
  const ordenEstados = {
    "Disponible": 1,
    "Sin conductor": 2,
    "Fuera de servicio": 3
  };

  return [...unidades].sort(
    (a, b) => {
      const ordenA =
        ordenEstados[a.estado] || 99;

      const ordenB =
        ordenEstados[b.estado] || 99;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      return String(a.unidad || "")
        .localeCompare(
          String(b.unidad || ""),
          "es",
          {
            numeric: true,
            sensitivity: "base"
          }
        );
    }
  );
}

/* =========================================================
   TARJETAS DE UNIDADES
========================================================= */

function crearUnidadHTML(unidad) {
  const estado =
    unidad.estado ||
    "Sin conductor";

  const icono =
    iconoEstadoUnidad(estado);

  const clase =
    claseEstadoUnidad(estado);

  return `
    <div class="unidad ${clase}">

      <div class="unidad-titulo">
        <span
          class="unidad-icono"
          aria-hidden="true"
        >
          ${icono}
        </span>

        <strong>
          ${escaparHTML(
            unidad.unidad
          )}
        </strong>
      </div>

      <div class="estado">
        ${escaparHTML(estado)}
      </div>

      <div class="conductores">
        <b>Principal:</b>
        ${escaparHTML(
          unidad.principalNombre ||
          "-"
        )}

        <br>

        <b>Secundario:</b>
        ${escaparHTML(
          unidad.secundarioNombre ||
          "-"
        )}
      </div>

    </div>
  `;
}

function iconoEstadoUnidad(estado) {
  if (estado === "Disponible") {
    return "●";
  }

  if (estado === "Sin conductor") {
    return "⚠";
  }

  if (estado === "Fuera de servicio") {
    return "●";
  }

  return "●";
}

/* =========================================================
   MODAL DE PERSONAL
========================================================= */

function abrirModalPersonal(
  codigoCuartel
) {
  const cuartel =
    resumenCentralActual.find(
      item =>
        String(item.cuartel) ===
        String(codigoCuartel)
    );

  if (!cuartel) {
    mostrarToast(
      "No se encontró la información del cuartel",
      "rojo",
      false
    );

    return;
  }

  const nombreCuartel =
    CONFIG.CUARTELES[
      codigoCuartel
    ] ||
    codigoCuartel;

  const personal =
    Array.isArray(cuartel.personal)
      ? cuartel.personal
      : [];

  const titulo =
    document.getElementById(
      "modalPersonalTitulo"
    );

  const resumen =
    document.getElementById(
      "modalPersonalResumen"
    );

  const lista =
    document.getElementById(
      "listaPersonal"
    );

  titulo.textContent =
    nombreCuartel;

  resumen.textContent =
    `${personal.length} presentes · ${Number(
      cuartel.disponibles || 0
    )} disponibles`;

  lista.innerHTML = "";

  if (personal.length === 0) {
    lista.innerHTML = `
      <div class="sin-personal">
        No hay personal presente en este cuartel.
      </div>
    `;

  } else {
    const personalOrdenado =
      ordenarPersonal(personal);

    personalOrdenado.forEach(
      persona => {
        const item =
          document.createElement("div");

        item.className =
          `persona-item ${claseEstadoBombero(
            persona.estado
          )}`;

        const foto =
          persona.foto ||
          CONFIG.FOTO_DEFAULT;

        item.innerHTML = `
          <img
            src="${escaparAtributo(foto)}"
            alt="${escaparAtributo(
              persona.nombre
            )}"
            onerror="this.src='${escaparAtributo(
              CONFIG.FOTO_DEFAULT
            )}'"
          >

          <div class="persona-datos">

            <div class="persona-nombre">
              ${escaparHTML(
                persona.nombre
              )}
            </div>

            <div class="persona-cargo">
              ${escaparHTML(
                persona.cargo || ""
              )}
            </div>

            <div class="persona-estado">
              ${escaparHTML(
                persona.estado
              )}
            </div>

          </div>
        `;

        lista.appendChild(item);
      }
    );
  }

  document.getElementById(
    "modalPersonal"
  ).style.display = "flex";
}

function ordenarPersonal(personal) {
  const ordenEstado = {
    "Disponible": 1,
    "No disponible": 2,
    "En capacitación": 3,
    "En emergencia": 4
  };

  return [...personal].sort(
    (a, b) => {
      const ordenA =
        ordenEstado[a.estado] || 99;

      const ordenB =
        ordenEstado[b.estado] || 99;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      return String(a.nombre || "")
        .localeCompare(
          String(b.nombre || ""),
          "es"
        );
    }
  );
}

function cerrarModalPersonal() {
  const modal =
    document.getElementById(
      "modalPersonal"
    );

  if (modal) {
    modal.style.display = "none";
  }
}

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      cerrarModalPersonal();
    }
  }
);

document
  .getElementById("modalPersonal")
  .addEventListener(
    "click",
    event => {
      if (
        event.target.id ===
        "modalPersonal"
      ) {
        cerrarModalPersonal();
      }
    }
  );

/* =========================================================
   EVENTOS RECIENTES
========================================================= */

async function revisarEventos() {
  try {
    const data = await api(
      "action=eventosRecientes&limite=30"
    );

    if (
      !data.ok ||
      !Array.isArray(data.eventos)
    ) {
      return;
    }

    /*
     * Siempre cargamos el historial lateral,
     * incluso durante la primera carga.
     */
    cargarHistorialInicial(
      data.eventos
    );

    if (data.eventos.length === 0) {
      return;
    }

    const eventoMasReciente =
      data.eventos[0];

    /*
     * En la primera carga no aparecen toast
     * de eventos antiguos.
     */
    if (primeraCargaCentral) {
      ultimoEventoVisto =
        Number(
          eventoMasReciente.id
        );

      primeraCargaCentral = false;

      return;
    }

    const nuevosEventos =
      data.eventos
        .filter(
          evento =>
            Number(evento.id) >
            Number(
              ultimoEventoVisto || 0
            )
        )
        .sort(
          (a, b) =>
            Number(a.id) -
            Number(b.id)
        );

    nuevosEventos.forEach(
      evento => {
        mostrarToast(
          construirTextoEvento(
            evento
          ),
          colorEvento(
            evento
          ),
          true
        );

        agregarEventoHistorial(
          evento
        );
      }
    );

    ultimoEventoVisto =
      Number(
        eventoMasReciente.id
      );

  } catch (error) {
    console.error(
      "Error consultando eventos:",
      error
    );
  }
}

function construirTextoEvento(
  evento
) {
  const hora =
    evento.hora
      ? `${evento.hora} · `
      : "";

  const detalle =
    evento.detalle ||
    evento.tipo ||
    "Nuevo evento";

  return hora + detalle;
}

function colorEvento(evento) {
  const tipo =
    normalizarTexto(
      evento.tipo
    );

  const detalle =
    normalizarTexto(
      evento.detalle
    );

  if (
    detalle.includes(
      "fuera de servicio"
    ) ||
    tipo.includes(
      "fuera de servicio"
    )
  ) {
    return "rojo";
  }

  if (
    detalle.includes("conductor") ||
    tipo.includes(
      "asignar conductor"
    ) ||
    tipo.includes(
      "quitar conductor"
    )
  ) {
    return "azul";
  }

  if (
    detalle.includes(
      "en emergencia"
    )
  ) {
    return "naranja";
  }

  if (
    tipo.includes("salida") ||
    detalle.includes(
      "salio del cuartel"
    ) ||
    detalle.includes(
      "sin conductor"
    )
  ) {
    return "amarillo";
  }

  return "verde";
}

/* =========================================================
   HISTORIAL LATERAL
========================================================= */

function cargarHistorialInicial(eventos) {
  if (!Array.isArray(eventos)) {
    return;
  }

  const idsExistentes =
    new Set(
      historialEventos.map(
        evento =>
          String(evento.id)
      )
    );

  eventos.forEach(evento => {
    if (
      !idsExistentes.has(
        String(evento.id)
      )
    ) {
      historialEventos.push(
        evento
      );
    }
  });

  historialEventos.sort(
    (a, b) =>
      Number(b.id || 0) -
      Number(a.id || 0)
  );

  historialEventos =
    historialEventos.slice(0, 30);

  renderHistorial();
}

function agregarEventoHistorial(
  evento
) {
  if (!evento) {
    return;
  }

  const existe =
    historialEventos.some(
      item =>
        String(item.id) ===
        String(evento.id)
    );

  if (!existe) {
    historialEventos.unshift(
      evento
    );
  }

  historialEventos =
    historialEventos.slice(0, 30);

  renderHistorial();
}

function renderHistorial() {
  const lista =
    document.getElementById(
      "historialLista"
    );

  const cantidad =
    document.getElementById(
      "historialCantidad"
    );

  if (!lista || !cantidad) {
    return;
  }

  cantidad.textContent =
    `${historialEventos.length} ${
      historialEventos.length === 1
        ? "evento"
        : "eventos"
    }`;

  lista.innerHTML = "";

  if (historialEventos.length === 0) {
    lista.innerHTML = `
      <div class="historial-vacio">
        No hay eventos recientes.
      </div>
    `;

    return;
  }

  historialEventos.forEach(
    evento => {
      const item =
        document.createElement("div");

      const tipoColor =
        colorEvento(evento);

      item.className =
        `historial-item ${tipoColor}`;

      item.innerHTML = `
        <div class="historial-hora">
          ${escaparHTML(
            evento.hora ||
            ""
          )}
        </div>

        <div class="historial-detalle">
          ${escaparHTML(
            evento.detalle ||
            evento.tipo ||
            "Evento"
          )}
        </div>
      `;

      lista.appendChild(item);
    }
  );
}

function limpiarHistorialVisual() {
  historialEventos = [];
  renderHistorial();
}

/* =========================================================
   TOASTS
========================================================= */

function mostrarToast(
  texto,
  tipo = "verde",
  conSonido = true
) {
  const contenedor =
    document.getElementById(
      "toastContainer"
    );

  if (!contenedor) {
    return;
  }

  if (conSonido) {
    reproducirTimbre(tipo);
  }

  const toast =
    document.createElement("div");

  toast.className =
    `toast ${tipo}`;

  toast.textContent =
    texto;

  contenedor.appendChild(
    toast
  );

  setTimeout(() => {
    toast.classList.add(
      "saliendo"
    );
  }, 6000);

  setTimeout(() => {
    toast.remove();
  }, 6500);
}

/* =========================================================
   UTILIDADES
========================================================= */

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparAtributo(valor) {
  return escaparHTML(valor);
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}

function obtenerHoraActual() {
  return new Date().toLocaleTimeString(
    "es-CL",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}

/* =========================================================
   INICIO
========================================================= */

iniciarReloj();
cargarCentral();

setInterval(
  cargarCentral,
  5000
);
