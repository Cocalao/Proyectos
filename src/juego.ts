export const CONFIG = {
  filas: 5, // filas
  columnas: 5, // columnas
  familiasMinimas: 1, // familias por zona
  familiasMaximas: 3, // familias por zona
  aguaInicialMinima: 0, // unidades de agua
  aguaInicialMaxima: 3, // unidades de agua
  nivelInundacion: 6, // unidades de agua
  lluviaNormal: 1, // unidades de agua por turno
  lluviaQuebrada: 2, // unidades de agua por turno
  drenajePropio: 3, // unidades de agua
  drenajeVecinas: 1, // unidades de agua por zona vecina
  accionesPorTurno: 3, // acciones por turno
  turnosTotales: 8, // turnos
  porcentajeMeta: 70, // porcentaje
  porcentajeBase: 100, // porcentaje
} as const

export interface Zona {
  id: number
  fila: number
  columna: number
  familias: number
  agua: number
  evacuada: boolean
  inundada: boolean
}

export type ResultadoPartida = 'enCurso' | 'victoria' | 'derrota'

export interface Estado {
  zonas: Zona[]
  turno: number
  accionesRestantes: number
  familiasTotales: number
  familiasASalvo: number
  familiasEnRiesgo: number
  familiasPerdidas: number
  porcentajeSalvado: number
  resultado: ResultadoPartida
}

export function crearGeneradorAzar(semilla: number): () => number {
  if (!Number.isSafeInteger(semilla)) {
    throw new RangeError('La semilla debe ser un número entero seguro.')
  }

  let estado = semilla >>> 0

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let valor = estado
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1)
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61)
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296
  }
}

export function crearEstado(semilla: number): Estado {
  const azar = crearGeneradorAzar(semilla)
  const zonas: Zona[] = []

  for (let fila = 0; fila < CONFIG.filas; fila += 1) {
    for (let columna = 0; columna < CONFIG.columnas; columna += 1) {
      zonas.push({
        id: zonas.length,
        fila,
        columna,
        familias:
          CONFIG.familiasMinimas +
          Math.floor(
            azar() *
              (CONFIG.familiasMaximas - CONFIG.familiasMinimas + 1),
          ),
        agua:
          CONFIG.aguaInicialMinima +
          Math.floor(
            azar() *
              (CONFIG.aguaInicialMaxima - CONFIG.aguaInicialMinima + 1),
          ),
        evacuada: false,
        inundada: false,
      })
    }
  }

  const estado: Estado = {
    zonas,
    turno: 1,
    accionesRestantes: CONFIG.accionesPorTurno,
    familiasTotales: zonas.reduce((total, zona) => total + zona.familias, 0),
    familiasASalvo: 0,
    familiasEnRiesgo: 0,
    familiasPerdidas: 0,
    porcentajeSalvado: 0,
    resultado: 'enCurso',
  }

  actualizarResumen(estado)
  comprobarImposibilidad(estado)
  return estado
}

export function avisar(estado: Estado, idZona: number): boolean {
  if (!puedeActuar(estado)) return false

  const zona = obtenerZona(estado, idZona)
  if (!zona || zona.inundada || zona.evacuada) return false

  zona.evacuada = true
  estado.accionesRestantes -= 1
  actualizarResumen(estado)
  comprobarImposibilidad(estado)
  return true
}

export function drenar(estado: Estado, idZona: number): boolean {
  if (!puedeActuar(estado)) return false

  const zona = obtenerZona(estado, idZona)
  if (!zona) return false

  for (const idVecina of obtenerVecinas(zona)) {
    const vecina = estado.zonas[idVecina]
    if (vecina) {
      const reduccion =
        idVecina === zona.id ? CONFIG.drenajePropio : CONFIG.drenajeVecinas
      vecina.agua = Math.max(0, vecina.agua - reduccion)
    }
  }

  estado.accionesRestantes -= 1
  actualizarResumen(estado)
  comprobarImposibilidad(estado)
  return true
}

export function terminarTurno(estado: Estado): boolean {
  if (estado.resultado !== 'enCurso') return false

  for (const zona of estado.zonas) {
    const esQuebrada = zona.fila === CONFIG.filas - 1
    zona.agua += esQuebrada ? CONFIG.lluviaQuebrada : CONFIG.lluviaNormal
    if (zona.agua >= CONFIG.nivelInundacion) zona.inundada = true
  }

  if (estado.turno === CONFIG.turnosTotales) {
    actualizarResumen(estado)
    estado.resultado =
      alcanzaMeta(estado.familiasASalvo, estado.familiasTotales)
        ? 'victoria'
        : 'derrota'
    return true
  }

  estado.turno += 1
  estado.accionesRestantes = CONFIG.accionesPorTurno
  actualizarResumen(estado)
  comprobarImposibilidad(estado)
  return true
}

function puedeActuar(estado: Estado): boolean {
  return (
    estado.resultado === 'enCurso' &&
    estado.accionesRestantes > 0
  )
}

function obtenerZona(estado: Estado, idZona: number): Zona | undefined {
  if (!Number.isInteger(idZona) || idZona < 0) return undefined
  return estado.zonas[idZona]
}

function obtenerVecinas(zona: Zona): number[] {
  const vecinas: number[] = []
  const desplazamientos = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ] as const

  for (const [desplazamientoFila, desplazamientoColumna] of desplazamientos) {
    const fila = zona.fila + desplazamientoFila
    const columna = zona.columna + desplazamientoColumna
    if (
      fila >= 0 &&
      fila < CONFIG.filas &&
      columna >= 0 &&
      columna < CONFIG.columnas
    ) {
      vecinas.push(fila * CONFIG.columnas + columna)
    }
  }

  return [zona.id, ...vecinas]
}

function alcanzaMeta(familiasASalvo: number, familiasTotales: number): boolean {
  return (
    familiasASalvo * CONFIG.porcentajeBase >=
    familiasTotales * CONFIG.porcentajeMeta
  )
}

function actualizarResumen(estado: Estado): void {
  estado.familiasASalvo = 0
  estado.familiasEnRiesgo = 0
  estado.familiasPerdidas = 0

  for (const zona of estado.zonas) {
    if (zona.evacuada) {
      estado.familiasASalvo += zona.familias
    } else if (zona.inundada) {
      estado.familiasPerdidas += zona.familias
    } else {
      estado.familiasEnRiesgo += zona.familias
    }
  }

  estado.porcentajeSalvado =
    (estado.familiasASalvo / estado.familiasTotales) *
    CONFIG.porcentajeBase
}

function comprobarImposibilidad(estado: Estado): void {
  if (
    estado.resultado === 'enCurso' &&
    !existePlanGanador(estado)
  ) {
    estado.resultado = 'derrota'
  }
}

function existePlanGanador(estado: Estado): boolean {
  const aguas = estado.zonas.map((zona) => zona.agua)
  const evacuadas = estado.zonas.map((zona) => zona.evacuada)
  const inundadas = estado.zonas.map((zona) => zona.inundada)
  const familias = estado.zonas.map((zona) => zona.familias)
  const memo = new Set<string>()

  function buscar(turno: number, accionesRestantes: number): boolean {
    let familiasASalvo = 0
    const familiasDisponibles: number[] = []

    for (let id = 0; id < estado.zonas.length; id += 1) {
      const cantidad = familias[id]
      if (cantidad === undefined) continue

      if (evacuadas[id]) {
        familiasASalvo += cantidad
      } else if (!inundadas[id]) {
        familiasDisponibles.push(cantidad)
      }
    }

    if (alcanzaMeta(familiasASalvo, estado.familiasTotales)) return true
    if (turno > CONFIG.turnosTotales) return false

    const accionesFuturas =
      accionesRestantes +
      (CONFIG.turnosTotales - turno) * CONFIG.accionesPorTurno
    familiasDisponibles.sort((a, b) => b - a)
    const familiasMaximas = familiasDisponibles
      .slice(0, accionesFuturas)
      .reduce((total, cantidad) => total + cantidad, familiasASalvo)
    if (!alcanzaMeta(familiasMaximas, estado.familiasTotales)) return false

    const clave = [
      turno,
      accionesRestantes,
      evacuadas.map((valor) => (valor ? '1' : '0')).join(''),
      inundadas.map((valor) => (valor ? '1' : '0')).join(''),
      aguas
        .map((agua, id) =>
          evacuadas[id] || inundadas[id] ? '' : String(agua),
        )
        .join(','),
    ].join('|')
    if (memo.has(clave)) return false

    if (accionesRestantes > 0) {
      const acciones: {
        tipo: 'avisar' | 'drenar'
        id: number
        prioridad: number
      }[] = []

      for (let id = 0; id < estado.zonas.length; id += 1) {
        if (!evacuadas[id] && !inundadas[id]) {
          const cantidad = familias[id] ?? 0
          acciones.push({
            tipo: 'avisar',
            id,
            prioridad: cantidad * 10 + (aguas[id] ?? 0),
          })
        }
      }

      for (let id = 0; id < estado.zonas.length; id += 1) {
        let beneficio = 0
        for (const idAfectado of obtenerVecinas(estado.zonas[id]!)) {
          if (
            !evacuadas[idAfectado] &&
            !inundadas[idAfectado] &&
            (aguas[idAfectado] ?? 0) > 0
          ) {
            beneficio += familias[idAfectado] ?? 0
          }
        }
        if (beneficio > 0) {
          acciones.push({
            tipo: 'drenar',
            id,
            prioridad: beneficio,
          })
        }
      }

      acciones.sort((a, b) => b.prioridad - a.prioridad)
      for (const accion of acciones) {
        if (accion.tipo === 'avisar') {
          evacuadas[accion.id] = true
          if (buscar(turno, accionesRestantes - 1)) return true
          evacuadas[accion.id] = false
        } else {
          const afectados = obtenerVecinas(estado.zonas[accion.id]!)
          const aguasAnteriores = afectados.map((idAfectado) =>
            aguas[idAfectado] ?? 0,
          )
          for (const idAfectado of afectados) {
            const reduccion =
              idAfectado === accion.id
                ? CONFIG.drenajePropio
                : CONFIG.drenajeVecinas
            aguas[idAfectado] = Math.max(
              0,
              (aguas[idAfectado] ?? 0) - reduccion,
            )
          }
          if (buscar(turno, accionesRestantes - 1)) return true
          afectados.forEach((idAfectado, indice) => {
            aguas[idAfectado] = aguasAnteriores[indice] ?? 0
          })
        }
      }
    }

    const aguasAnteriores = aguas.slice()
    const inundadasAnteriores = inundadas.slice()
    for (let id = 0; id < estado.zonas.length; id += 1) {
      const zona = estado.zonas[id]
      if (!zona) continue
      aguas[id] =
        (aguas[id] ?? 0) +
        (zona.fila === CONFIG.filas - 1
          ? CONFIG.lluviaQuebrada
          : CONFIG.lluviaNormal)
      if ((aguas[id] ?? 0) >= CONFIG.nivelInundacion) {
        inundadas[id] = true
      }
    }

    const victoria =
      turno === CONFIG.turnosTotales
        ? alcanzaMeta(familiasASalvo, estado.familiasTotales)
        : buscar(turno + 1, CONFIG.accionesPorTurno)

    aguas.forEach((agua, id) => {
      aguas[id] = aguasAnteriores[id] ?? agua
      inundadas[id] = inundadasAnteriores[id] ?? inundadas[id] ?? false
    })

    if (victoria) return true
    memo.add(clave)
    return false
  }

  return buscar(estado.turno, estado.accionesRestantes)
}
