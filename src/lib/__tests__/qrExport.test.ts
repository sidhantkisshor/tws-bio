import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import QRCode from 'react-qr-code'
import { describe, expect, it } from 'vitest'
import {
  QR_MIN_EXPORT_PX,
  QR_QUIET_ZONE,
  qrExportSize,
  qrFileName,
  standardQrSvg,
} from '@/lib/qrExport'

describe('qrExportSize', () => {
  it('is at least 1024px with a whole number of pixels per module', () => {
    for (const modules of [21, 25, 29, 33, 57, 177]) {
      const { modulePx, sizePx } = qrExportSize(modules)
      expect(sizePx, `${modules} modules`).toBeGreaterThanOrEqual(QR_MIN_EXPORT_PX)
      expect(Number.isInteger(modulePx)).toBe(true)
      expect(sizePx).toBe(modulePx * (modules + QR_QUIET_ZONE * 2))
    }
  })

  it('stays close to the minimum', () => {
    // 25 modules + 8 of quiet zone = 33, at 32px each.
    expect(qrExportSize(25)).toEqual({ modulePx: 32, sizePx: 1056 })
  })
})

describe('standardQrSvg', () => {
  it('draws black modules on white inside a 4-module quiet zone', () => {
    const svg = standardQrSvg(25, 'M 0 0 l 1 0 0 1 -1 0 Z')
    expect(svg).toContain('viewBox="-4 -4 33 33"')
    expect(svg).toContain('width="1056" height="1056"')
    expect(svg).toContain('<rect x="-4" y="-4" width="33" height="33" fill="#FFFFFF"/>')
    expect(svg).toContain('<path d="M 0 0 l 1 0 0 1 -1 0 Z" fill="#000000"/>')
    expect(svg).toContain('shape-rendering="crispEdges"')
    // The white field is drawn before the modules.
    expect(svg.indexOf('<rect')).toBeLessThan(svg.indexOf('<path'))
  })

  it('cannot be broken out of by the path data', () => {
    const svg = standardQrSvg(21, '"/><script>x</script>')
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('d="&quot;/>&lt;script>x&lt;/script>"')
  })
})

describe('react-qr-code markup the dialog reads', () => {
  // The dialog takes the module count from the viewBox and the dark modules
  // from the path filled with the foreground colour. A library upgrade that
  // changes either would break the download, so check both here.
  it('exposes the module count and the dark-module path', () => {
    const markup = renderToStaticMarkup(
      createElement(QRCode, {
        value: 'https://tws.bio/abc123',
        level: 'M',
        bgColor: '#FFFFFF',
        fgColor: '#000000',
      }),
    )
    const viewBox = markup.match(/viewBox="0 0 (\d+) (\d+)"/)
    expect(viewBox).not.toBeNull()
    // 22 bytes fit version 2 at level M: 25 modules.
    expect(viewBox![1]).toBe('25')
    expect(markup).toMatch(/<path d="M [^"]+" fill="#000000"/)
  })
})

describe('qrFileName', () => {
  it('keeps short codes and flattens Resource Drop codes', () => {
    expect(qrFileName('abc123', 'png')).toBe('qr-abc123.png')
    expect(qrFileName('r/options-basics', 'svg')).toBe('qr-r-options-basics.svg')
    expect(qrFileName('///', 'png')).toBe('qr-link.png')
  })
})
