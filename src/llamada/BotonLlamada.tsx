import { Loader2, Phone, PhoneCall } from 'lucide-react'

import { unirseALaLlamada, useLlamadaStore } from '@/llamada/useLlamadaStore'

/**
 * La puerta a la llamada de voz del grupo, en la cabecera del editor.
 *
 * Si ya hay gente hablando se nota desde afuera: el botón se pone verde y dice cuántos son,
 * como el aviso de "llamada en curso" de un grupo de WhatsApp.
 */
export function BotonLlamada() {
  const estado = useLlamadaStore((state) => state.estado)
  const cuantos = useLlamadaStore((state) => state.participantes.length)

  if (estado === 'dentro') {
    return (
      <span
        title="Estás en la llamada del grupo"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-emerald-800"
      >
        <PhoneCall className="h-3 w-3" />
        En llamada · {cuantos}
      </span>
    )
  }

  const hayLlamada = cuantos > 0

  return (
    <button
      type="button"
      onClick={() => void unirseALaLlamada()}
      disabled={estado === 'entrando'}
      title={
        'Llamada de voz con el grupo. Adentro, decí "Jarvis, …" para hablarle a la IA ' +
        '(por ejemplo: "Jarvis, ¿cómo está el proyecto?").'
      }
      className={`flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 text-xs whitespace-nowrap transition-colors disabled:opacity-60 ${
        hayLlamada
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'border-slate-300 text-slate-600 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700'
      }`}
    >
      {estado === 'entrando' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Phone className="h-3.5 w-3.5" />
      )}
      {estado === 'entrando'
        ? 'Uniéndote…'
        : hayLlamada
          ? `Unirse a la llamada (${cuantos})`
          : 'Llamada'}
      {hayLlamada && estado === 'fuera' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      )}
    </button>
  )
}
