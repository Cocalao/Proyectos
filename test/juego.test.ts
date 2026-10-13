import { describe, expect, it } from 'vitest'
import {
  CONFIG,
  avisar,
  crearEstado,
  crearGeneradorAzar,
  drenar,
  terminarTurno,
  type Estado,
} from '../src/juego'

function crearEstadoControlado(semilla = 123): Estado {
  const estado = crearEstado(semilla)
  estado.resultado = 'enCurso'
  estado.accionesRestantes = CONFIG.accionesPorTurno
  return estado
}

function familiasTotales(estado: Estado): number {
  return estado.zonas.reduce((total, zona) => total + zona.familias, 0)
}

describe('reglas de Tormenta', () => {
  it('debería crear un tablero con 25 zonas en una cuadrícula de 5 por 5', () => {
    const estado = crearEstado(17)

    expect(estado.zonas).toHaveLength(CONFIG.filas * CONFIG.columnas)
    expect(estado.zonas[0]).toMatchObject({ id: 0, fila: 0, columna: 0 })
    expect(estado.zonas[24]).toMatchObject({ id: 24, fila: 4, columna: 4 })
    expect(
      estado.zonas.every(
        (zona) =>
          zona.familias >= CONFIG.familiasMinimas &&
          zona.familias <= CONFIG.familiasMaximas &&
          zona.agua >= CONFIG.aguaInicialMinima &&
          zona.agua <= CONFIG.aguaInicialMaxima,
      ),
    ).toBe(true)
    expect(estado.familiasTotales).toBe(familiasTotales(estado))
  })

  it('debería producir el mismo tablero con la misma semilla y tableros distintos con semillas distintas', () => {
    const primerTablero = crearEstado(2026).zonas
    const tableroRepetido = crearEstado(2026).zonas
    const otroTablero = crearEstado(2027).zonas

    expect(tableroRepetido).toEqual(primerTablero)
    expect(otroTablero).not.toEqual(primerTablero)

    const azarA = crearGeneradorAzar(31)
    const azarB = crearGeneradorAzar(31)
    expect([azarA(), azarA(), azarA()]).toEqual([azarB(), azarB(), azarB()])
  })

  it('debería evacuar una zona avisada y rechazar avisos inválidos o repetidos', () => {
    const estado = crearEstadoControlado()
    const zona = estado.zonas[0]!
    const total = estado.familiasTotales
    const accionesIniciales = estado.accionesRestantes

    expect(avisar(estado, zona.id)).toBe(true)
    expect(zona.evacuada).toBe(true)
    expect(estado.familiasASalvo).toBe(zona.familias)
    expect(estado.familiasEnRiesgo + estado.familiasPerdidas).toBe(
      total - zona.familias,
    )
    expect(estado.accionesRestantes).toBe(accionesIniciales - 1)
    expect(avisar(estado, zona.id)).toBe(false)
    expect(avisar(estado, -1)).toBe(false)
    expect(avisar(estado, estado.zonas.length)).toBe(false)
    expect(estado.familiasTotales).toBe(total)

    const estadoInundado = crearEstadoControlado(124)
    estadoInundado.zonas[0]!.inundada = true
    expect(avisar(estadoInundado, 0)).toBe(false)
  })

  it('debería drenar la zona elegida y sus vecinas, y limitar el agua a cero', () => {
    const estado = crearEstadoControlado()
    const centro = estado.zonas[12]!
    estado.zonas.forEach((zona) => {
      zona.agua = 2
    })
    centro.agua = 3
    const total = estado.familiasTotales
    const accionesIniciales = estado.accionesRestantes

    expect(drenar(estado, centro.id)).toBe(true)
    expect(centro.agua).toBe(0)
    expect(estado.zonas[6]!.agua).toBe(1)
    expect(estado.zonas[11]!.agua).toBe(1)
    expect(estado.zonas[13]!.agua).toBe(1)
    expect(estado.zonas[18]!.agua).toBe(1)
    expect(estado.zonas[0]!.agua).toBe(2)
    expect(estado.accionesRestantes).toBe(accionesIniciales - 1)
    expect(estado.familiasTotales).toBe(total)

    centro.agua = 1
    expect(drenar(estado, centro.id)).toBe(true)
    expect(centro.agua).toBe(0)
    expect(drenar(estado, -1)).toBe(false)
    expect(drenar(estado, estado.zonas.length)).toBe(false)
  })

  it('debería rechazar cualquier acción cuando no quedan acciones disponibles', () => {
    const estado = crearEstadoControlado()
    estado.accionesRestantes = 0

    expect(avisar(estado, 0)).toBe(false)
    expect(drenar(estado, 0)).toBe(false)
    expect(estado.zonas[0]!.evacuada).toBe(false)
  })

  it('debería permitir drenar una zona inundada sin recuperarla', () => {
    const estado = crearEstadoControlado()
    const zona = estado.zonas[12]!
    zona.agua = 6
    zona.inundada = true
    const familiasPerdidas = zona.familias

    expect(drenar(estado, zona.id)).toBe(true)
    expect(zona.agua).toBe(3)
    expect(zona.inundada).toBe(true)
    expect(estado.familiasPerdidas).toBe(familiasPerdidas)
  })

  it('debería aumentar el agua al terminar el turno e inundar las zonas que alcanzan seis', () => {
    const estado = crearEstadoControlado()
    const normal = estado.zonas[0]!
    const quebrada = estado.zonas[20]!
    normal.agua = 5
    quebrada.agua = 4
    const familiasEnRiesgoIniciales = estado.familiasEnRiesgo

    expect(terminarTurno(estado)).toBe(true)
    expect(normal.agua).toBe(6)
    expect(normal.inundada).toBe(true)
    expect(quebrada.agua).toBe(6)
    expect(quebrada.inundada).toBe(true)
    expect(estado.turno).toBe(2)
    expect(estado.accionesRestantes).toBe(CONFIG.accionesPorTurno)
    expect(estado.familiasPerdidas).toBe(normal.familias + quebrada.familias)
    expect(estado.familiasEnRiesgo).toBe(
      familiasEnRiesgoIniciales - normal.familias - quebrada.familias,
    )
  })

  it('debería conservar el total de familias durante toda la partida', () => {
    const estado = crearEstadoControlado(88)
    const total = estado.familiasTotales

    expect(avisar(estado, 0)).toBe(true)
    expect(drenar(estado, 12)).toBe(true)
    expect(terminarTurno(estado)).toBe(true)
    expect(estado.familiasTotales).toBe(total)
    expect(
      estado.familiasASalvo +
        estado.familiasEnRiesgo +
        estado.familiasPerdidas,
    ).toBe(total)
  })

  it('debería ganar una partida completa al evacuar primero las zonas más amenazadas', () => {
    const estado = crearEstado(42)
    const total = estado.familiasTotales
    let accionesDeSeguridad = 0

    while (estado.resultado === 'enCurso') {
      while (
        estado.resultado === 'enCurso' &&
        estado.accionesRestantes > 0
      ) {
        const candidatas = estado.zonas
          .filter((zona) => !zona.evacuada && !zona.inundada)
          .sort((a, b) => {
            const lluviaA =
              a.fila === CONFIG.filas - 1
                ? CONFIG.lluviaQuebrada
                : CONFIG.lluviaNormal
            const lluviaB =
              b.fila === CONFIG.filas - 1
                ? CONFIG.lluviaQuebrada
                : CONFIG.lluviaNormal
            const turnosA = (CONFIG.nivelInundacion - a.agua) / lluviaA
            const turnosB = (CONFIG.nivelInundacion - b.agua) / lluviaB
            return turnosA - turnosB || b.familias - a.familias
          })
        const zona = candidatas[0]
        if (!zona) break

        expect(avisar(estado, zona.id)).toBe(true)
        accionesDeSeguridad += 1
        expect(estado.familiasTotales).toBe(total)
      }

      if (estado.resultado === 'enCurso') {
        expect(terminarTurno(estado)).toBe(true)
      }
      expect(estado.familiasTotales).toBe(total)
    }

    expect(estado.turno).toBe(CONFIG.turnosTotales)
    expect(accionesDeSeguridad).toBeGreaterThan(0)
    expect(estado.resultado).toBe('victoria')
    expect(estado.porcentajeSalvado).toBeGreaterThanOrEqual(
      CONFIG.porcentajeMeta,
    )
  }, 30000)

  it('debería terminar en derrota al no hacer ninguna acción', () => {
    const estado = crearEstado(77)
    expect(estado.resultado).toBe('enCurso')

    while (estado.resultado === 'enCurso') {
      expect(terminarTurno(estado)).toBe(true)
    }

    expect(estado.resultado).toBe('derrota')
    expect(estado.porcentajeSalvado).toBeLessThan(CONFIG.porcentajeMeta)
    expect(terminarTurno(estado)).toBe(false)
  }, 30000)
})
