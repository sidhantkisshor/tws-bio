// The downloaded QR code is the file that goes onto flyers and slides, so it
// follows the print standard (ISO/IEC 18004) instead of the dialog's themed
// preview: dark modules on white, error correction M, and a 4-module white
// quiet zone. Some scanners (ZXing by default) cannot read light-on-dark codes.

/** Modules of white margin the standard asks for on each side. */
export const QR_QUIET_ZONE = 4

/** Smallest side of a downloaded PNG, so it stays sharp when scaled for print. */
export const QR_MIN_EXPORT_PX = 1024

/**
 * Pixel size of the export for a code of `moduleCount` modules. Each module is
 * a whole number of pixels, so module edges land on pixel edges and the PNG
 * has no blurred or seamed modules.
 */
export function qrExportSize(moduleCount: number): { modulePx: number; sizePx: number } {
  const side = moduleCount + QR_QUIET_ZONE * 2
  const modulePx = Math.ceil(QR_MIN_EXPORT_PX / side)
  return { modulePx, sizePx: modulePx * side }
}

/**
 * The standard SVG for a code. `darkPath` is the path data of the dark modules
 * in module units, as react-qr-code renders it, so this draws the same code on
 * a white field with the quiet zone around it.
 */
export function standardQrSvg(moduleCount: number, darkPath: string): string {
  const side = moduleCount + QR_QUIET_ZONE * 2
  const { sizePx } = qrExportSize(moduleCount)
  const d = darkPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" ` +
    `viewBox="${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${side} ${side}" shape-rendering="crispEdges">` +
    `<rect x="${-QR_QUIET_ZONE}" y="${-QR_QUIET_ZONE}" width="${side}" height="${side}" fill="#FFFFFF"/>` +
    `<path d="${d}" fill="#000000"/>` +
    '</svg>'
  )
}

/** A file name for the download. Resource Drop codes contain '/'. */
export function qrFileName(shortCode: string, extension: 'png' | 'svg'): string {
  const safe = shortCode.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return `qr-${safe || 'link'}.${extension}`
}
