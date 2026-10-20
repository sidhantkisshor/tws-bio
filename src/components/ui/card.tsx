import * as React from "react"

import { cn } from "@/lib/utils"

// Day Book has no rounded cards: a section is opened by the 2px ink rule
// (`rule-open`), not boxed. Card stays for callers that still use it and now
// renders as a ruled section: a 2px rule on top, no fill, no ring, no radius.
// Pass `variant="panel"` for one of the two raised panels (create preview,
// sign-in): surface fill, hairline border, 6px radius.
function Card({
  className,
  size = "default",
  variant = "section",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; variant?: "section" | "panel" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        "group/card flex flex-col gap-4 text-sm text-ink has-data-[slot=card-footer]:pb-0 data-[size=sm]:gap-3",
        variant === "section"
          ? "rule-open bg-transparent pt-3.5 pb-1 data-[size=sm]:pt-3"
          : "rounded-panel border border-rule bg-surface py-6 data-[size=sm]:py-4",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 group-data-[variant=panel]/card:px-6 group-data-[size=sm]/card:group-data-[variant=panel]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-serif text-[22px] leading-tight font-medium tracking-[-0.005em] text-ink group-data-[size=sm]/card:text-lg",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[13px] text-text-3", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "group-data-[variant=panel]/card:px-6 group-data-[size=sm]/card:group-data-[variant=panel]/card:px-4",
        className
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center border-t border-rule py-4 group-data-[variant=panel]/card:px-6",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
