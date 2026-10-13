import './estilo.css'
import {
  CONFIG,
  avisar,
  crearEstado,
  drenar,
  terminarTurno,
  type Estado,
  type Zona,
} from './juego'

const aplicacion = document.querySelector<HTMLDivElement>('#app')!

let estado: Estado | null = null
let zonaSeleccionada: number | null = null
let mensaje = ''

aplicacion.addEventListener('click', (evento: MouseEvent) => {
  const objetivo = evento.target
  if (!(objetivo instanceof Element)) return

  const boton = objetivo.closest<HTMLButtonElement>('button')
  if (!boton || !aplicacion.contains(boton)) return
  const foco = boton.dataset.foco

  if (boton.dataset.accion === 'nueva') {
    const semilla = new Uint32Array(1)
    crypto.getRandomValues(semilla)
    estado = crearEstado(semilla[0]!)
    zonaSeleccionada = null
    mensaje = ''
    dibujar('titulo-partida')
    return
  }

  if (!estado || estado.resultado !== 'enCurso') return

  if (boton.dataset.zona !== undefined) {
    zonaSeleccionada = Number(boton.dataset.zona)
    mensaje = ''
    dibujar(foco)
    return
  }

  if (boton.dataset.accion === 'avisar' && zonaSeleccionada !== null) {
    mensaje = avisar(estado, zonaSeleccionada)
      ? 'Aviso enviado. La zona está a salvo.'
      : 'No se pudo avisar esa zona.'
    dibujar(estado.resultado === 'enCurso' ? foco : 'titulo-final')
    return
  }

  if (boton.dataset.accion === 'drenar' && zonaSeleccionada !== null) {
    mensaje = drenar(estado, zonaSeleccionada)
      ? 'Drenaje abierto.'
      : 'No se pudo drenar esa zona.'
    dibujar(estado.resultado === 'enCurso' ? foco : 'titulo-final')
    return
  }

  if (boton.dataset.accion === 'turno') {
    const turnoTerminado = terminarTurno(estado)
    mensaje = !turnoTerminado
      ? 'No se pudo terminar el turno.'
      : estado.resultado === 'enCurso'
        ? `Turno ${estado.turno}. El agua subió; te quedan ${estado.accionesRestantes} acciones.`
        : ''
    zonaSeleccionada = null
    dibujar(
      estado.resultado === 'enCurso' ? 'turno' : 'titulo-final',
    )
  }
})

function dibujar(foco?: string): void {
  if (!estado) {
    dibujarInicio()
  } else if (estado.resultado === 'enCurso') {
    dibujarPartida(estado)
  } else {
    dibujarFinal(estado)
  }

  if (foco) {
    const elemento = Array.from(
      aplicacion.querySelectorAll<HTMLElement>('[data-foco]'),
    ).find((candidato) => candidato.dataset.foco === foco)
    elemento?.focus()
  }
}

function dibujarInicio(): void {
  aplicacion.innerHTML = `
    <main class="contenedor">
      <header class="encabezado">
        <p class="sobretitulo">El turno de la comunidad</p>
        <h1>Tormenta</h1>
      </header>
      <section class="panel inicio" aria-labelledby="titulo-inicio">
        <h2 id="titulo-inicio">El agua está subiendo</h2>
        <p>
          Tenés ${CONFIG.turnosTotales} turnos para salvar al menos
          el ${CONFIG.porcentajeMeta} % de las familias.
        </p>
        <p>
          En cada turno podés realizar ${CONFIG.accionesPorTurno} acciones:
          avisar para evacuar una zona o abrir un drenaje.
        </p>
        <button
          class="boton boton-principal"
          type="button"
          data-accion="nueva"
          data-foco="nueva"
          aria-label="Empezar una partida nueva de Tormenta"
        >
          Empezar partida
        </button>
      </section>
    </main>
  `
}

function dibujarPartida(partida: Estado): void {
  const zonas = partida.zonas
    .map((zona) => dibujarZona(zona, zona.id === zonaSeleccionada))
    .join('')
  const zonaElegida =
    zonaSeleccionada === null
      ? undefined
      : partida.zonas[zonaSeleccionada]

  aplicacion.innerHTML = `
    <main class="contenedor">
      <header class="encabezado encabezado-partida">
        <div>
          <p class="sobretitulo">El turno de la comunidad</p>
          <h1 id="titulo-partida" tabindex="-1" data-foco="titulo-partida">Tormenta</h1>
        </div>
        <p class="turno">Turno <strong>${partida.turno}</strong> de ${CONFIG.turnosTotales}</p>
      </header>

      <section class="resumen" aria-label="Resumen de la partida">
        <div class="dato"><span>Acciones</span><strong>${partida.accionesRestantes}</strong></div>
        <div class="dato"><span>A salvo</span><strong>${partida.familiasASalvo}</strong></div>
        <div class="dato"><span>En riesgo</span><strong>${partida.familiasEnRiesgo}</strong></div>
        <div class="dato"><span>Perdidas</span><strong>${partida.familiasPerdidas}</strong></div>
        <div class="dato dato-meta"><span>Meta ${CONFIG.porcentajeMeta} %</span><strong>${partida.porcentajeSalvado.toLocaleString('es', { maximumFractionDigits: 2 })} %</strong></div>
      </section>

      <section class="panel tablero-panel" aria-labelledby="titulo-tablero">
        <div class="titulo-tablero">
          <h2 id="titulo-tablero">Zonas</h2>
          <span class="etiqueta-quebrada">Fila inferior: quebrada</span>
        </div>
        <div class="tablero" role="group" aria-label="Tablero de 5 por 5 zonas">
          ${zonas}
        </div>
        <div class="leyenda" aria-label="Colores de las zonas">
          <span><i class="muestra azul"></i>Tranquila</span>
          <span><i class="muestra amarilla"></i>En riesgo</span>
          <span><i class="muestra roja"></i>A punto de inundarse</span>
          <span><i class="muestra gris"></i>Inundada</span>
          <span><i class="muestra verde"></i>Evacuada</span>
        </div>
      </section>

      <section class="panel acciones" aria-labelledby="titulo-acciones">
        <h2 id="titulo-acciones">Tus acciones</h2>
        ${
          zonaElegida
            ? `
              <p class="seleccion">
                Zona ${zonaElegida.fila + 1}, ${zonaElegida.columna + 1}:
                ${zonaElegida.familias} familias, nivel de agua ${zonaElegida.agua}.
              </p>
              <div class="botones-accion">
                <button
                  class="boton boton-aviso"
                  type="button"
                  data-accion="avisar"
                  data-foco="avisar"
                  aria-label="Avisar a las ${zonaElegida.familias} familias de la fila ${zonaElegida.fila + 1}, columna ${zonaElegida.columna + 1}"
                >
                  Avisar
                </button>
                <button
                  class="boton boton-drenaje"
                  type="button"
                  data-accion="drenar"
                  data-foco="drenar"
                  aria-label="Drenar la zona de la fila ${zonaElegida.fila + 1}, columna ${zonaElegida.columna + 1}, con nivel de agua ${zonaElegida.agua}"
                >
                  Drenar
                </button>
              </div>
            `
            : '<p class="ayuda">Elegí una zona del tablero para actuar.</p>'
        }
        <p class="mensaje" role="status" aria-live="polite">${mensaje}</p>
        <button
          class="boton boton-secundario"
          type="button"
          data-accion="turno"
          data-foco="turno"
          aria-label="Terminar el turno ${partida.turno}; quedan ${partida.accionesRestantes} acciones"
        >
          Terminar turno
        </button>
      </section>
    </main>
  `
}

function dibujarZona(zona: Zona, seleccionada: boolean): string {
  const clase = claseZona(zona)
  const estadoZona = estadoVisual(zona)
  const quebrada = zona.fila === CONFIG.filas - 1 ? ', quebrada' : ''
  const seleccion = seleccionada ? ' seleccionada' : ''
  const estadoSeleccion = seleccionada ? 'seleccionada' : 'no seleccionada'

  return `
    <button
      class="zona ${clase}${seleccion}"
      type="button"
      data-zona="${zona.id}"
      data-foco="zona-${zona.id}"
      aria-pressed="${seleccionada}"
      aria-label="Zona de la fila ${zona.fila + 1}, columna ${zona.columna + 1}${quebrada}: ${zona.familias} familias, nivel de agua ${zona.agua}, ${estadoZona}, ${estadoSeleccion}"
    >
      <span class="zona-coordenada">${zona.fila + 1}.${zona.columna + 1}</span>
      <strong>${zona.familias} fam.</strong>
      <span>${zona.agua} agua</span>
      <span class="zona-estado" aria-hidden="true">${simboloEstado(zona)} ${estadoZona}</span>
    </button>
  `
}

function estadoVisual(zona: Zona): string {
  if (zona.evacuada) return 'evacuada'
  if (zona.inundada) return 'inundada'
  if (zona.agua >= CONFIG.nivelInundacion - 2) return 'a punto de inundarse'
  if (zona.agua >= 2) return 'en riesgo'
  return 'tranquila'
}

function simboloEstado(zona: Zona): string {
  if (zona.evacuada) return '✓'
  if (zona.inundada) return '■'
  if (zona.agua >= CONFIG.nivelInundacion - 2) return '▲'
  if (zona.agua >= 2) return '!'
  return '●'
}

function claseZona(zona: Zona): string {
  if (zona.evacuada) return 'zona-evacuada'
  if (zona.inundada) return 'zona-inundada'
  if (zona.agua >= CONFIG.nivelInundacion - 2) return 'zona-critica'
  if (zona.agua >= 2) return 'zona-riesgo'
  return 'zona-tranquila'
}

function dibujarFinal(partida: Estado): void {
  const victoria = partida.resultado === 'victoria'

  aplicacion.innerHTML = `
    <main class="contenedor">
      <header class="encabezado">
        <p class="sobretitulo">El turno de la comunidad</p>
        <h1>Tormenta</h1>
      </header>
      <section class="panel final ${victoria ? 'final-victoria' : 'final-derrota'}">
        <p class="sobretitulo">Partida finalizada</p>
        <h2 id="titulo-final" tabindex="-1" data-foco="titulo-final">${victoria ? 'La comunidad está a salvo' : 'El agua ganó esta vez'}</h2>
        <p>
          ${partida.familiasASalvo} de ${partida.familiasTotales} familias
          a salvo (${partida.porcentajeSalvado.toLocaleString('es', { maximumFractionDigits: 2 })} %).
        </p>
        <p>En riesgo: ${partida.familiasEnRiesgo}. Perdidas: ${partida.familiasPerdidas}.</p>
        <button
          class="boton boton-principal"
          type="button"
          data-accion="nueva"
          data-foco="nueva"
          aria-label="Empezar una partida nueva de Tormenta"
        >
          Jugar de nuevo
        </button>
      </section>
    </main>
  `
}

dibujar()
