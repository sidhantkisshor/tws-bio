'use client'

import { useRef, useCallback } from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { getShortUrl } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, Download } from 'lucide-react'

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
      ctx.fillStyle = '#111111'
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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Copied!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code to open the short link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            ref={qrRef}
            className="rounded-xl bg-[#111111] p-6"
          >
            <QRCode
              value={url}
              size={256}
              bgColor="#111111"
              fgColor="#00B03B"
            />
          </div>
          <p className="font-mono text-primary text-center text-sm">
            {url}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="size-4 mr-1.5" />
            Copy Link
          </Button>
          <Button onClick={handleDownload}>
            <Download className="size-4 mr-1.5" />
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
