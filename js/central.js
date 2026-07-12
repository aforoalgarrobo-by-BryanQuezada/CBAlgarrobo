/* =========================================================
   CBA SUITE - CENTRAL OPERATIVA
========================================================= */

let primeraCargaCentral = true;
let ultimoEventoVisto = null;
let centralActualizando = false;

/* =========================================================
   SISTEMA DE AUDIO
========================================================= */

let contextoAudio = null;
let sonidoHabilitado = false;

/*
 * Los navegadores no permiten reproducir sonidos automáticos
 * hasta que el usuario haga clic o toque la pantalla al menos
 * una vez.
 */
async function habilitarSonido() {
  if (sonidoHabilitado) {
    return;
  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) {
    console.warn("Este navegador no permite generar sonidos.");
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
 * Se activa con el primer clic o toque realizado en la Central.
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

  const inicio = contextoAudio.currentTime;

  /*
   * Primer tono.
   */
  crearTono(
    frecuencia,
    inicio,
    0.18,
    0.16
  );

  /*
   * Segundo tono corto para que suene como timbre.
   */
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
  oscilador.stop(inicio + duracion + 0.03);
}

/* =========================================================
   CARGA DE LA CENTRAL
========================================================= */

async function cargarCentral() {
  /*
   * Evita que se realicen dos consultas simultáneas.
   */
  if (centralActualizando) {
    return;
  }

  centralActualizando = true;

  try {
    const data = await api("action=central");

    if (!data.ok) {
      mostrarToast(
        data.mensaje ||
        "No se pudo cargar la Central",
        "rojo"
      );

      return;
    }

    renderCentral(data.resumen);

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
   DIBUJAR CUARTELES Y UNIDADES
========================================================= */

function renderCentral(resumen) {
  const contenedor =
    document.getElementById("contenedor");

  if (!contenedor) {
    return;
  }

  contenedor.innerHTML = "";

  resumen.forEach(cuartel => {
    const fila =
      document.createElement("div");

    fila.className = "fila-cuartel";

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
          CONFIG.CUARTELES[cuartel.cuartel] ||
          cuartel.cuartel
        )}
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
    <div class="unidad ${claseEstadoUnidad(
      unidad.estado
    )}">

      <strong>
        ${escaparHTML(unidad.unidad)}
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

    /*
     * En la primera carga no mostramos eventos antiguos.
     * Solo guardamos el último evento existente.
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
        Number(a.id) -
        Number(b.id)
      );

    nuevosEventos.forEach(evento => {
      mostrarToast(
        construirTextoEvento(evento),
        colorEvento(evento),
        true
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

/* =========================================================
   COLOR DE LOS AVISOS
========================================================= */

function colorEvento(evento) {
  const tipo =
    normalizarTexto(evento.tipo);

  const detalle =
    normalizarTexto(evento.detalle);

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

/* =========================================================
   AVISOS EMERGENTES
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

  toast.textContent = texto;

  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("saliendo");
  }, 6000);

  setTimeout(() => {
    toast.remove();
  }, 6500);
}

/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

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

/*
 * La Central consulta cambios cada cinco segundos.
 */
setInterval(
  cargarCentral,
  5000
);
