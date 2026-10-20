'use client'

import { useRef } from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { getShortUrl } from '@/lib/utils'
import { qrExportSize, qrFileName, standardQrSvg } from '@/lib/qrExport'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// The preview is dark modules on a white plate in both themes, like the
// printed file: a light-on-dark code is an optional feature in QR decoders,
// and some scanners cannot read it. The SVG needs literal colors.
const PREVIEW_LIGHT = '#FFFFFF'
const PREVIEW_DARK = '#1E2528'

const SHORT_DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || 'tws.bio'

// The downloads are built from a hidden second render in print colors. Its
// dark modules are the path with this fill.
const PRINT_DARK = '#000000'
const PRINT_LIGHT = '#FFFFFF'

const PREPARE_FAILED = 'Could not prepare the QR code. Please try again.'

function readPrintCode(container: HTMLElement | null) {
  const svg = container?.querySelector('svg')
  const moduleCount = svg?.viewBox.baseVal?.width
  const darkPath = svg?.querySelector(`path[fill="${PRINT_DARK}"]`)?.getAttribute('d')
  if (!moduleCount || !darkPath) return null
  return { moduleCount, darkPath }
}

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoked later, not at once: Safari can drop a download whose URL is
  // revoked before it has started reading it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function QRCodeDialog({
  shortCode,
  open,
  onOpenChange,
}: {
  shortCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const printRef = useRef<HTMLDivElement>(null)
  const url = getShortUrl(shortCode)

  function handleDownloadSvg() {
    const code = readPrintCode(printRef.current)
    if (!code) {
      toast.error(PREPARE_FAILED)
      return
    }
    const svg = standardQrSvg(code.moduleCount, code.darkPath)
    saveFile(new Blob([svg], { type: 'image/svg+xml' }), qrFileName(shortCode, 'svg'))
  }

  function handleDownloadPng() {
    const code = readPrintCode(printRef.current)
    if (!code) {
      toast.error(PREPARE_FAILED)
      return
    }
    const { sizePx } = qrExportSize(code.moduleCount)
    const svgUrl = URL.createObjectURL(
      new Blob([standardQrSvg(code.moduleCount, code.darkPath)], { type: 'image/svg+xml' }),
    )
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(svgUrl)
      const canvas = document.createElement('canvas')
      canvas.width = sizePx
      canvas.height = sizePx
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast.error(PREPARE_FAILED)
        return
      }
      // The SVG is already sizePx square with whole-pixel modules, so it is
      // drawn 1:1 and stays sharp.
      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = PRINT_LIGHT
      ctx.fillRect(0, 0, sizePx, sizePx)
      ctx.drawImage(img, 0, 0, sizePx, sizePx)
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error(PREPARE_FAILED)
          return
        }
        saveFile(blob, qrFileName(shortCode, 'png'))
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      toast.error(PREPARE_FAILED)
    }
    img.src = svgUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
          <DialogDescription>
            Scan it to open{' '}
            <span className="font-mono text-ink [overflow-wrap:anywhere]">
              {SHORT_DOMAIN}/{shortCode}
            </span>
            . Put it on slides and printouts for live sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          {/* Shrinks below 288px so a 360px phone does not scroll the dialog
              sideways. */}
          <div className="w-full max-w-[288px] rounded-panel border border-rule bg-white p-5">
            {/* Level M here too, so the screen and the printed file carry
                the same code. */}
            <QRCode
              value={url}
              title={`QR code for ${url}`}
              size={256}
              level="M"
              bgColor={PREVIEW_LIGHT}
              fgColor={PREVIEW_DARK}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            />
          </div>
          <p className="text-[13px] text-text-3">
            The download is the same code in black on white, ready to print.
          </p>
          <div ref={printRef} hidden>
            <QRCode value={url} level="M" bgColor={PRINT_LIGHT} fgColor={PRINT_DARK} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDownloadSvg}>
            Download SVG
          </Button>
          <Button onClick={handleDownloadPng}>Download PNG</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
