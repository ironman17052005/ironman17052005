const MAX_EDGE = 1280
const QUALITY = 0.82

/**
 * A phone photo is several megabytes, and a recap stores it inline. Straight from
 * the file input it would blow the browser storage quota in demo mode and bloat a
 * row in live mode, so shrink it to something a card actually needs before storing.
 * Falls back to the original data URL if the browser cannot decode it.
 */
export async function shrinkImage(file: File): Promise<string> {
  const original = await readAsDataUrl(file)
  try {
    const img = await loadImage(original)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
    if (scale === 1 && file.size < 400_000) return original

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', QUALITY)
  } catch {
    return original
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('could not read that file'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('not an image'))
    img.src = src
  })
}
