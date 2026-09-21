/**
 * Normaliza la imagen antes de mandarla al modelo de visión.
 *
 * No es cosmético: cambia lo que el modelo es capaz de leer. Las imágenes se tokenizan en
 * *patches* de 32×32 px con un tope de 1536, así que:
 *
 * - Una captura pequeña (648×316 = ~210 patches) desaprovecha el presupuesto: cada patch
 *   comprime un trozo grande del dibujo y una multiplicidad de 5 px acaba dentro de un solo
 *   token. Ampliarla no inventa información, pero reparte el mismo dibujo entre muchos más
 *   patches, y el modelo puede resolver el texto chico.
 * - Una foto de móvil (4000 px) supera el tope y la reescala el servidor de todas formas,
 *   mandando megas de más por la red para nada.
 *
 * Medido sobre un diagrama real de 648×316: sin ampliar leía la composición invertida y no
 * veía la relación recursiva; ampliado a 1400 px las acierta.
 */

/** Lado largo objetivo: 1400×1050 son ~1452 patches, justo por debajo del tope de 1536. */
const LADO_LARGO = 1400

/** Por debajo de esto no se toca: ampliar una imagen ya grande no aporta nada. */
const MINIMO_UTIL = 0.95

export type ImagenPreparada = {
  archivo: File
  anchoOriginal: number
  altoOriginal: number
  ancho: number
  alto: number
  /** true si hubo que cambiarle el tamaño. */
  reescalada: boolean
}

function cargar(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()

    imagen.onload = () => {
      URL.revokeObjectURL(url)
      resolve(imagen)
    }
    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo abrir la imagen.'))
    }

    imagen.src = url
  })
}

export async function prepararImagen(archivo: File): Promise<ImagenPreparada> {
  let imagen: HTMLImageElement

  try {
    imagen = await cargar(archivo)
  } catch {
    // Que no se pueda reescalar no es motivo para no intentar leerla.
    return {
      archivo,
      anchoOriginal: 0,
      altoOriginal: 0,
      ancho: 0,
      alto: 0,
      reescalada: false,
    }
  }

  const anchoOriginal = imagen.naturalWidth
  const altoOriginal = imagen.naturalHeight
  const ladoMayor = Math.max(anchoOriginal, altoOriginal)

  const sinCambios: ImagenPreparada = {
    archivo,
    anchoOriginal,
    altoOriginal,
    ancho: anchoOriginal,
    alto: altoOriginal,
    reescalada: false,
  }

  if (ladoMayor === 0) return sinCambios

  const factor = LADO_LARGO / ladoMayor

  // Ya está en el tamaño bueno.
  if (factor > MINIMO_UTIL && factor < 1 / MINIMO_UTIL) return sinCambios

  const ancho = Math.round(anchoOriginal * factor)
  const alto = Math.round(altoOriginal * factor)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto

  const contexto = lienzo.getContext('2d')
  if (!contexto) return sinCambios

  // Suavizado alto: al ampliar, el remuestreo bicúbico conserva los trazos finos mucho
  // mejor que el de vecino más cercano, que los convierte en escalones.
  contexto.imageSmoothingEnabled = true
  contexto.imageSmoothingQuality = 'high'
  contexto.drawImage(imagen, 0, 0, ancho, alto)

  const blob = await new Promise<Blob | null>((resolve) => {
    // PNG y no JPEG: un diagrama es líneas y texto, donde el JPEG mete artefactos justo
    // alrededor de lo más pequeño, que es lo que hay que leer.
    lienzo.toBlob(resolve, 'image/png')
  })

  if (!blob) return sinCambios

  return {
    archivo: new File([blob], `${archivo.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }),
    anchoOriginal,
    altoOriginal,
    ancho,
    alto,
    reescalada: true,
  }
}
