import { Check, Loader2, Mic, MicOff, Phone, PhoneOff, TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useVozAgent, type Estado, type Turno } from '@/voz/useVozAgent'

/**
 * La llamada con el agente, en pantalla.
 *
 * Se lee de reojo mientras hablás, no se estudia: por eso cada turno es una burbuja con su
 * lado —vos a la derecha, el agente a la izquierda— y cada cambio en el diagrama una línea
 * suelta, corta, con su marca. La primera versión volcaba aquí el resultado que recibe el
 * modelo, que para una lectura es el diagrama entero en texto, y no había quien lo leyera.
 *
 * Y el estado importa tanto como el contenido: en una llamada no ves a la otra parte, así
 * que tres segundos de silencio pueden ser que esté pensando, que no te oyó o que se cortó.
 */

const ROTULO: Record<Estado, string> = {
  // En reposo no se rotula nada: ya lo dice el botón de al lado.
  inactivo: '',
  conectando: 'Conectando…',
  escuchando: 'Te escucho',
  hablando: 'Hablando',
  ejecutando: 'Aplicando el cambio',
  error: 'Se cortó la llamada',
}

const COLOR: Record<Estado, string> = {
  inactivo: 'text-slate-400',
  conectando: 'text-amber-600',
  escuchando: 'text-emerald-600',
  hablando: 'text-sky-600',
  ejecutando: 'text-violet-600',
  error: 'text-red-600',
}

const BOTON =
  'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors'

function Indicador({ estado }: { estado: Estado }) {
  if (ROTULO[estado] === '') return null

  return (
    <span className={`flex items-center gap-1.5 text-[11px] ${COLOR[estado]}`}>
      {(estado === 'conectando' || estado === 'ejecutando') && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {estado === 'escuchando' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      )}
      {estado === 'hablando' && (
        <span className="flex items-end gap-0.5">
          {/* Tres barras que suben y bajan: se entiende sin leer que está hablando. */}
          <span className="h-2 w-0.5 animate-pulse rounded-full bg-sky-500" />
          <span className="h-3 w-0.5 animate-pulse rounded-full bg-sky-500 [animation-delay:150ms]" />
          <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-sky-500 [animation-delay:300ms]" />
        </span>
      )}
      {ROTULO[estado]}
    </span>
  )
}

function Burbuja({ turno }: { turno: Turno }) {
  if (turno.de === 'accion') {
    return (
      <li className="flex justify-center px-2 py-0.5">
        <span
          className={`flex items-start gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-tight ${
            turno.fallo === true
              ? 'bg-amber-50 text-amber-800'
              : 'bg-violet-50 text-violet-800'
          }`}
        >
          {turno.fallo === true ? (
            <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
          ) : (
            <Check className="mt-px h-3 w-3 shrink-0" />
          )}
          {turno.texto}
        </span>
      </li>
    )
  }

  const mio = turno.de === 'usuario'

  return (
    <li className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
      <span
        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px] leading-snug ${
          mio
            ? 'rounded-br-sm bg-sky-600 text-white'
            : 'rounded-bl-sm bg-slate-100 text-slate-800'
        }`}
      >
        {turno.texto}
      </span>
    </li>
  )
}

export function VozPanel() {
  const { estado, error, silenciado, turnos, llamar, colgar, silenciar } = useVozAgent()
  const finDeLista = useRef<HTMLDivElement>(null)

  const enLlamada = estado !== 'inactivo' && estado !== 'error'

  // La conversación crece por abajo: sin esto habría que bajar a mano en cada frase.
  useEffect(() => {
    finDeLista.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [turnos])

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {enLlamada ? (
            <>
              <button
                type="button"
                onClick={colgar}
                className={`${BOTON} bg-red-600 text-white hover:bg-red-700`}
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Colgar
              </button>

              <button
                type="button"
                onClick={silenciar}
                title={silenciado ? 'Activar el micrófono' : 'Silenciar el micrófono'}
                className={`${BOTON} ${
                  silenciado
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {silenciado ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {silenciado && 'Silenciado'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void llamar()}
              className={`${BOTON} bg-sky-600 text-white hover:bg-sky-700`}
            >
              <Phone className="h-3.5 w-3.5" />
              Hablar con el agente
            </button>
          )}
        </div>

        <Indicador estado={estado} />
      </div>

      {error !== null && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] leading-snug text-red-700">
          {error}
        </p>
      )}

      {turnos.length === 0 && enLlamada && (
        <p className="px-1 text-[11px] leading-snug text-slate-400">
          Pedile lo que quieras: "agregá un atributo precio a PELICULA", "¿qué relaciones tiene
          SOCIO?", "poné notaAlquiler a la derecha de Ejemplar".
        </p>
      )}

      {turnos.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
          <ul className="flex flex-col gap-1.5">
            {turnos.map((turno) => (
              <Burbuja key={turno.id} turno={turno} />
            ))}
          </ul>
          <div ref={finDeLista} />
        </div>
      )}
    </section>
  )
}
