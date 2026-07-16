'use client'

import { useRef, useCallback } from 'react'
import QRCode from 'react-qr-code'
import { getShortUrl } from '@/lib/utils'
import { TickerChip } from '@/components/TickerChip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

// The QR SVG and download canvas need literal color strings, so the theme
// tokens are resolved from the stylesheet once and cached (hex fallbacks match
// the current globals.css values for the pre-hydration edge case).
let qrColors: { bg: string; fg: string } | null = null
function getQrColors() {
  if (!qrColors) {
    const styles =
      typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
    qrColors = {
      bg: styles?.getPropertyValue('--card').trim() || '#111111',
      fg: styles?.getPropertyValue('--chart-1').trim() || '#00B03B',
    }
  }
  return qrColors
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
  const qrRef = useRef<HTMLDivElement>(null)
  const url = getShortUrl(shortCode)

  const handleDownload = useCallback(() => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // Add padding around the QR code
      const padding = 32
      canvas.width = img.width + padding * 2
      canvas.height = img.height + padding * 2

      // Fill background
      ctx.fillStyle = getQrColors().bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw QR code centered
      ctx.drawImage(img, padding, padding)

      const pngUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `qr-${shortCode}.png`
      downloadLink.href = pngUrl
      downloadLink.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }, [shortCode])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code to open the short link.
          </DialogDescription>
          <TickerChip code={shortCode} className="self-start" />
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            ref={qrRef}
            className="rounded-xl bg-card p-6"
          >
            <QRCode
              value={url}
              size={256}
              bgColor={getQrColors().bg}
              fgColor={getQrColors().fg}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleDownload}>
            <Download className="size-4 mr-1.5" />
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
