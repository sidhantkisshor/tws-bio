"use client"

import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { readResolvedTheme, subscribeResolvedTheme, type ResolvedTheme } from "@/components/theme/theme"

const serverTheme = (): ResolvedTheme => "light"

// Toasts follow the page theme (data-theme on <html>), and take their colors
// from the Day Book tokens: surface fill, hairline border, ink text. Status is
// carried by the icon and the words, not by a colored fill.
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(subscribeResolvedTheme, readResolvedTheme, serverTheme)

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-pos" />,
        info: <InfoIcon className="size-4 text-text-2" />,
        warning: <TriangleAlertIcon className="size-4 text-text-2" />,
        error: <OctagonXIcon className="size-4 text-neg" />,
        loading: <Loader2Icon className="size-4 animate-spin text-text-2" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--rule)",
          "--border-radius": "6px",
          fontFamily: "var(--font-sans)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
