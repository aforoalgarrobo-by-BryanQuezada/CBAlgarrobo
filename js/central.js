/* =========================================================
   CBA SUITE - CENTRAL OPERATIVA
========================================================= */

let primeraCargaCentral = true;
let ultimoEventoVisto = null;
let centralActualizando = false;
let ultimoResumenCentral = null;
let resumenCentralActual = [];

/* =========================================================
   SISTEMA DE AUDIO
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
   CARGA DE CENTRAL
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

    detectarCuartelesSinPersonal(
      ultimoResumenCentral,
      data.resumen
    );

    resumenCentralActual =
      Array.isArray(data.resumen)
        ? data.resumen
        : [];

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
   ALERTA CUARTEL SIN PERSONAL DISPONIBLE
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
       * Solo alerta cuando pasa desde uno o más
       * disponibles a cero disponibles.
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

        mostrarToast(
          `${nombreCuartel} sin personal disponible`,
          "rojo",
          true
        );
      }
    }
  );
}

/* =========================================================
   RENDERIZAR CENTRAL
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

    const unidadesHTML =
      Array.isArray(cuartel.unidades) &&
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
            cuartel.presentesCantidad || 0
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

function crearUnidadHTML(unidad) {
  return `
    <div class="unidad ${claseEstadoUnidad(
      unidad.estado
    )}">

      <strong>
        ${escaparHTML(
          unidad.unidad
        )}
      </strong>

      <div class="estado">
        ${escaparHTML(
          unidad.estado ||
          "Sin conductor"
        )}
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

/* =========================================================
   MODAL DE PERSONAL PRESENTE
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
      [...personal].sort(
        (a, b) => {
          const ordenEstado = {
            "Disponible": 1,
            "No disponible": 2,
            "En capacitación": 3,
            "En emergencia": 4
          };

          const ordenA =
            ordenEstado[a.estado] || 99;

          const ordenB =
            ordenEstado[b.estado] || 99;

          if (ordenA !== ordenB) {
            return ordenA - ordenB;
          }

          return String(a.nombre)
            .localeCompare(
              String(b.nombre),
              "es"
            );
        }
      );

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

function cerrarModalPersonal() {
  document.getElementById(
    "modalPersonal"
  ).style.display = "none";
}

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      cerrarModalPersonal();
    }
  }
);

document.getElementById(
  "modalPersonal"
).addEventListener(
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
      "action=eventosRecientes&limite=20"
    );

    if (
      !data.ok ||
      !Array.isArray(data.eventos) ||
      data.eventos.length === 0
    ) {
      return;
    }

    const eventoMasReciente =
      data.eventos[0];

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
   AVISOS
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

/* =========================================================
   INICIO
========================================================= */

iniciarReloj();
cargarCentral();

setInterval(
  cargarCentral,
  5000
);
